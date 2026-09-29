import { Module } from '@nestjs/common';
import { ApiCenterController } from './api-center.controller';
import { ApiCatalogService } from './api-catalog.service';

@Module({
  controllers: [ApiCenterController],
  providers: [ApiCatalogService],
})
export class ApiCenterModule {}
