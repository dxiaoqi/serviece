import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import OSS from 'ali-oss';
import Sts20150401, { AssumeRoleRequest } from '@alicloud/sts20150401';
import { $OpenApiUtil } from '@alicloud/openapi-core';
import { STORAGE_OPTIONS } from '../storage.constants';
import { StorageProvider } from '../storage.provider';
import {
  OssStorageOptions,
  PresignUploadInput,
  StorageModuleOptions,
  UploadGrant,
} from '../storage.types';

interface StsCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
}

@Injectable()
export class OssStorageProvider extends StorageProvider {
  readonly driver = 'oss';
  private readonly logger = new Logger(OssStorageProvider.name);
  private readonly cfg: OssStorageOptions;

  constructor(@Inject(STORAGE_OPTIONS) options: StorageModuleOptions) {
    super();
    this.cfg = options.oss ?? {
      region: '',
      bucket: '',
      accessKeyId: '',
      accessKeySecret: '',
    };
  }

  get enabled(): boolean {
    return Boolean(this.cfg.region && this.cfg.bucket && this.cfg.accessKeyId && this.cfg.accessKeySecret);
  }

  private get playExpires(): number {
    return Number(this.cfg.signExpiresSec ?? 600);
  }

  private get uploadExpires(): number {
    return Number(this.cfg.uploadExpiresSec ?? 900);
  }

  private get cdnDomain(): string {
    return (this.cfg.cdnDomain ?? '').trim();
  }

  private buildReadClient(): OSS {
    if (this.cdnDomain) {
      return new OSS({
        accessKeyId: this.cfg.accessKeyId,
        accessKeySecret: this.cfg.accessKeySecret,
        endpoint: this.normalizeDomain(this.cdnDomain),
        cname: true,
        secure: true,
      });
    }
    return new OSS({
      accessKeyId: this.cfg.accessKeyId,
      accessKeySecret: this.cfg.accessKeySecret,
      region: this.cfg.region,
      bucket: this.cfg.bucket,
      secure: true,
    });
  }

  async signedUrl(key: string): Promise<string> {
    const objectKey = this.toObjectKey(key);
    if (!objectKey) throw new BadGatewayException('无效的对象地址');
    if (!this.enabled) throw new BadGatewayException('对象存储未配置');
    try {
      return this.buildReadClient().signatureUrl(objectKey, { expires: this.playExpires });
    } catch (err) {
      this.logger.error(`生成签名失败: ${(err as Error).message}`);
      throw new BadGatewayException('文件地址生成失败');
    }
  }

  async createUploadGrant(input: PresignUploadInput): Promise<UploadGrant> {
    if (!this.enabled) throw new BadGatewayException('对象存储未配置，无法签发上传凭证');
    if (!this.cfg.roleArn) throw new BadGatewayException('缺少 roleArn，无法签发 STS 凭证');

    const key = `${this.normalizeCategory(input.category)}/${this.datePath()}-${this.sanitizeFilename(input.filename)}`;
    const contentType = (input.contentType ?? this.guessContentType(key)).toLowerCase();
    const credentials = await this.assumeRole(key);

    const putClient = new OSS({
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.accessKeySecret,
      stsToken: credentials.securityToken,
      region: this.cfg.region,
      bucket: this.cfg.bucket,
      secure: true,
    });

    const uploadUrl = putClient.signatureUrl(key, {
      expires: this.uploadExpires,
      method: 'PUT',
      'Content-Type': contentType,
    });

    const endpoint = `https://${this.cfg.bucket}.${this.cfg.region}.aliyuncs.com`;
    const domain = this.cdnDomain ? this.normalizeDomain(this.cdnDomain) : null;

    return {
      driver: 'oss',
      bucket: this.cfg.bucket,
      region: this.cfg.region,
      endpoint,
      cdnDomain: domain,
      key,
      contentType,
      uploadUrl,
      publicUrl: domain ? `https://${domain}/${key}` : `${endpoint}/${key}`,
      expiresIn: this.uploadExpires,
    };
  }

  private async assumeRole(key: string): Promise<StsCredentials> {
    const client = new Sts20150401(
      new $OpenApiUtil.Config({
        accessKeyId: this.cfg.accessKeyId,
        accessKeySecret: this.cfg.accessKeySecret,
        endpoint: `sts.${this.cfg.region}.aliyuncs.com`,
      }),
    );

    const policy = JSON.stringify({
      Version: '1',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'oss:PutObject',
          Resource: `acs:oss:*:*:${this.cfg.bucket}/${key}`,
        },
      ],
    });

    const request = new AssumeRoleRequest({
      roleArn: this.cfg.roleArn,
      roleSessionName: 'storage-upload',
      durationSeconds: this.uploadExpires,
      policy,
    });

    try {
      const response = await client.assumeRole(request);
      const creds = response.body?.credentials;
      if (!creds || !creds.accessKeyId || !creds.accessKeySecret || !creds.securityToken) {
        throw new Error('STS 未返回有效凭证');
      }
      return {
        accessKeyId: creds.accessKeyId,
        accessKeySecret: creds.accessKeySecret,
        securityToken: creds.securityToken,
        expiration: creds.expiration ?? '',
      };
    } catch (err) {
      this.logger.error(`STS 签发失败: ${(err as Error).message}`);
      throw new BadGatewayException('上传凭证签发失败');
    }
  }

  private toObjectKey(value: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const url = new URL(trimmed);
        const path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        return path || null;
      } catch {
        return null;
      }
    }
    return trimmed.replace(/^\/+/, '');
  }

  private normalizeCategory(category: string): string {
    const c = (category || 'files').toLowerCase().replace(/[^a-z0-9._/-]+/g, '-');
    return c.replace(/^\/+|\/+$/g, '') || 'files';
  }

  private sanitizeFilename(filename: string): string {
    const base = filename.split(/[\\/]/).pop() ?? filename;
    const cleaned = base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '');
    return cleaned || 'file';
  }

  private datePath(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private normalizeDomain(domain: string): string {
    return domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }

  private guessContentType(key: string): string {
    const lower = key.toLowerCase();
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/octet-stream';
  }
}
