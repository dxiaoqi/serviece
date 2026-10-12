import {
  StorageDriver,
  StorageModuleOptions,
} from './storage.types';

function env(key: string): string {
  return (process.env[key] ?? '').trim();
}

export function storageOptionsFromEnv(): StorageModuleOptions {
  const driver: StorageDriver = env('STORAGE_DRIVER') === 'oss' ? 'oss' : 'local';

  const region = env('OSS_REGION');
  const bucket = env('OSS_BUCKET');
  const accessKeyId = env('OSS_ACCESS_KEY_ID');
  const accessKeySecret = env('OSS_ACCESS_KEY_SECRET');

  const ossConfigured = Boolean(region && bucket && accessKeyId && accessKeySecret);
  const effectiveDriver: StorageDriver = driver === 'oss' && ossConfigured ? 'oss' : 'local';

  return {
    driver: effectiveDriver,
    oss: {
      region,
      bucket,
      accessKeyId,
      accessKeySecret,
      cdnDomain: env('OSS_CDN_DOMAIN') || undefined,
      roleArn: env('OSS_STS_ROLE_ARN') || undefined,
      signExpiresSec: env('OSS_SIGN_EXPIRES_SEC') ? Number(env('OSS_SIGN_EXPIRES_SEC')) : undefined,
      uploadExpiresSec: env('OSS_UPLOAD_EXPIRES_SEC') ? Number(env('OSS_UPLOAD_EXPIRES_SEC')) : undefined,
    },
  };
}
