import { Inject, Injectable } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.constants';
import { StorageProvider } from './storage.provider';
import { PresignUploadInput, UploadGrant } from './storage.types';

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly provider: StorageProvider) {}

  get driver(): string {
    return this.provider.driver;
  }

  get enabled(): boolean {
    return this.provider.enabled;
  }

  signedUrl(key: string): Promise<string> {
    return this.provider.signedUrl(key);
  }

  createUploadGrant(input: PresignUploadInput): Promise<UploadGrant> {
    return this.provider.createUploadGrant(input);
  }
}
