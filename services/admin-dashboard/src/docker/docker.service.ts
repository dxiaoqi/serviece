import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Docker from 'dockerode';

export interface ContainerView {
  id: string;
  shortId: string;
  name: string;
  image: string;
  status: string;
  state: string;
  running: boolean;
  ports: string;
  cpuPercent: number;
  memPercent: number;
  memUsage: number;
  memLimit: number;
}

interface SingleStats {
  cpu_stats?: any;
  precpu_stats?: any;
  memory_stats?: any;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private readonly logger = new Logger(DockerService.name);
  private docker: Docker;

  onModuleInit() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async ping(): Promise<string> {
    return this.docker.ping();
  }

  async systemInfo() {
    const [info, version, df] = await Promise.all([
      this.docker.info(),
      this.docker.version(),
      this.docker.df(),
    ]);

    const images = (df as any).Images || [];
    const containers = (df as any).Containers || [];
    const imagesDisk = images.reduce(
      (sum: number, img: any) => sum + (img.Size || 0),
      0,
    );
    const containersDisk = containers.reduce(
      (sum: number, c: any) =>
        sum + (c.SizeRw || 0) + (c.SizeRootFs || 0),
      0,
    );

    return {
      name: info.Name,
      os: info.OperatingSystem,
      osType: info.OSType,
      arch: info.Architecture,
      kernel: info.KernelVersion,
      dockerVersion: version.Version,
      apiVersion: version.ApiVersion,
      cpus: info.NCPU,
      memTotal: info.MemTotal,
      containersTotal: info.Containers,
      containersRunning: info.ContainersRunning,
      containersPaused: info.ContainersPaused,
      containersStopped: info.ContainersStopped,
      imagesCount: images.length,
      imagesDisk,
      containersDisk,
    };
  }

  async listContainers(): Promise<ContainerView[]> {
    const containers = await this.docker.listContainers({ all: true });
    const views = await Promise.all(
      containers.map(async (c) => {
        const stats = await this.safeStats(c.Id);
        const { cpuPercent, memPercent, memUsage, memLimit } =
          this.computeStats(stats);
        return {
          id: c.Id,
          shortId: c.Id.slice(0, 12),
          name: (c.Names && c.Names[0] ? c.Names[0] : '').replace(/^\//, ''),
          image: c.Image,
          status: c.Status,
          state: c.State,
          running: c.State === 'running',
          ports: this.formatPorts(c.Ports),
          cpuPercent,
          memPercent,
          memUsage,
          memLimit,
        };
      }),
    );
    return views;
  }

  private async safeStats(id: string): Promise<SingleStats | null> {
    try {
      const stream: any = await this.docker
        .getContainer(id)
        .stats({ stream: false });
      if (!stream) {
        return null;
      }
      if (Buffer.isBuffer(stream)) {
        return JSON.parse(stream.toString('utf8'));
      }
      return await new Promise<SingleStats>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (d: Buffer) => chunks.push(d));
        stream.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
        stream.on('error', reject);
      });
    } catch {
      return null;
    }
  }

  private computeStats(stats: SingleStats | null) {
    if (!stats || !stats.cpu_stats || !stats.precpu_stats) {
      return {
        cpuPercent: 0,
        memPercent: 0,
        memUsage: 0,
        memLimit: 0,
      };
    }

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      (stats.cpu_stats.system_cpu_usage || 0) -
      (stats.precpu_stats.system_cpu_usage || 0);
    const onlineCpus =
      stats.cpu_stats.online_cpus ||
      stats.cpu_stats.cpu_usage.percpu_usage?.length ||
      1;
    const cpuPercent =
      systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

    const memLimit = stats.memory_stats?.limit || 0;
    const inactive =
      stats.memory_stats?.stats?.inactive_file ||
      stats.memory_stats?.stats?.total_inactive_file ||
      0;
    const memUsage = Math.max((stats.memory_stats?.usage || 0) - inactive, 0);
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

    return { cpuPercent, memPercent, memUsage, memLimit };
  }

  private formatPorts(ports: any[]): string {
    if (!ports || ports.length === 0) {
      return '—';
    }
    return ports
      .map((p) => {
        const publicPort = p.PublicPort ? `${p.IP || '0.0.0.0'}:${p.PublicPort}->` : '';
        return `${publicPort}${p.PrivatePort}/${p.Type}`;
      })
      .join(', ');
  }

  async getLogs(id: string, tail = 300): Promise<string> {
    const container = this.docker.getContainer(id);
    const inspect = await container.inspect();
    const buf: Buffer = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail,
      follow: false,
    });
    if (inspect.Config.Tty) {
      return buf.toString('utf8');
    }
    return this.demuxBuffer(buf);
  }

  private demuxBuffer(buf: Buffer): string {
    let offset = 0;
    let output = '';
    while (offset + 8 <= buf.length) {
      const length = buf.readUInt32BE(offset + 4);
      offset += 8;
      if (offset + length > buf.length) {
        break;
      }
      output += buf.slice(offset, offset + length).toString('utf8');
      offset += length;
    }
    return output || buf.toString('utf8');
  }

  async start(id: string) {
    await this.docker.getContainer(id).start();
  }

  async stop(id: string) {
    await this.docker.getContainer(id).stop();
  }

  async restart(id: string) {
    await this.docker.getContainer(id).restart();
  }
}
