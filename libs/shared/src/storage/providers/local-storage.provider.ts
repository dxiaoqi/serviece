import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_OPTIONS } from '../storage.constants';
import {
  PresignUploadInput,
  StorageModuleOptions,
  UploadGrant,
} from '../storage.types';
import { StorageProvider } from '../storage.provider';

@Injectable()
export class LocalStorageProvider extends StorageProvider {
  readonly driver = 'local';
  readonly enabled = true;

  private readonly baseUrl: string;

  constructor(@Inject(STORAGE_OPTIONS) options: StorageModuleOptions) {
    super();
    this.baseUrl = (process.env.STORAGE_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  }

  async signedUrl(key: string): Promise<string> {
    const clean = key.replace(/^\/+/, '');
    return this.baseUrl ? `${this.baseUrl}/${clean}` : `/${clean}`;
  }

  async createUploadGrant(input: PresignUploadInput): Promise<UploadGrant> {
    const key = `${this.normalizeCategory(input.category)}/${this.datePath()}-${this.sanitizeFilename(input.filename)}`;
    const contentType = (input.contentType ?? this.guessContentType(key)).toLowerCase();
    const publicUrl = await this.signedUrl(key);
    return {
      driver: 'local',
      bucket: null,
      region: null,
      endpoint: this.baseUrl || 'local',
      cdnDomain: null,
      key,
      contentType,
      uploadUrl: publicUrl,
      publicUrl,
      expiresIn: 0,
    };
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
