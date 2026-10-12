import { Module } from '@nestjs/common';
import { StorageDemoController } from './storage-demo.controller';

@Module({
  controllers: [StorageDemoController],
})
export class StorageDemoModule {}
