import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DockerService } from './docker.service';

@Controller()
export class DockerController {
  constructor(private readonly dockerService: DockerService) {}

  @Get()
  async overview(@Req() req: Request, @Res() res: Response) {
    const [info, containers] = await Promise.all([
      this.dockerService.systemInfo(),
      this.dockerService.listContainers(),
    ]);
    return res.render('index', {
      title: '总览',
      active: 'overview',
      user: req.session?.user,
      info,
      containers,
      bytes,
    });
  }

  @Get('containers')
  async containers(@Req() req: Request, @Res() res: Response) {
    const containers = await this.dockerService.listContainers();
    return res.render('containers', {
      title: '容器管理',
      active: 'containers',
      user: req.session?.user,
      containers,
      bytes,
    });
  }

  @Get('containers/:id/logs')
  async logs(
    @Param('id') id: string,
    @Query('tail') tail: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const logText = await this.dockerService.getLogs(
      id,
      Number(tail) || 300,
    );
    return res.render('logs', {
      title: '容器日志',
      active: 'containers',
      user: req.session?.user,
      id,
      tail: Number(tail) || 300,
      logText,
    });
  }

  @Post('containers/:id/:action')
  @Redirect('/containers')
  async action(
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    if (action === 'start') {
      await this.dockerService.start(id);
    } else if (action === 'stop') {
      await this.dockerService.stop(id);
    } else if (action === 'restart') {
      await this.dockerService.restart(id);
    }
    return { url: '/containers' };
  }
}

function bytes(value: number): string {
  if (!value) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(value) / Math.log(1024));
  return `${(value / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
