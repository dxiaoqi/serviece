import { PresignUploadInput, UploadGrant } from './storage.types';

export abstract class StorageProvider {
  abstract readonly driver: string;
  abstract readonly enabled: boolean;

  abstract signedUrl(key: string): Promise<string>;

  abstract createUploadGrant(input: PresignUploadInput): Promise<UploadGrant>;
}
