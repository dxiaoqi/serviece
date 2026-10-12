export type StorageDriver = 'local' | 'oss';

export interface StorageModuleOptions {
  driver: StorageDriver;
  oss?: OssStorageOptions;
}

export interface OssStorageOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  cdnDomain?: string;
  roleArn?: string;
  signExpiresSec?: number;
  uploadExpiresSec?: number;
}

export interface PresignUploadInput {
  category: string;
  filename: string;
  contentType?: string;
}

export interface UploadGrant {
  driver: StorageDriver;
  bucket: string | null;
  region: string | null;
  endpoint: string;
  cdnDomain: string | null;
  key: string;
  contentType: string;
  uploadUrl: string;
  publicUrl: string;
  expiresIn: number;
}
