import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageModule } from '@app/shared';
import { storageOptionsFromEnv } from '@app/shared';
import { HealthModule } from './health/health.module';
import { StorageDemoModule } from './storage-demo/storage-demo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StorageModule.registerAsync(() => storageOptionsFromEnv()),
    HealthModule,
    StorageDemoModule,
  ],
})
export class AppModule {}
