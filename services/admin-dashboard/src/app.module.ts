import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { AuthRedirectFilter } from './auth/auth-redirect.filter';
import { DockerModule } from './docker/docker.module';
import { DatabaseModule } from './database/database.module';
import { ApiCenterModule } from './api-center/api-center.module';

@Module({
  imports: [AuthModule, DockerModule, DatabaseModule, ApiCenterModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AuthRedirectFilter,
    },
  ],
})
export class AppModule {}
