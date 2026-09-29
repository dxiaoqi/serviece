import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DownloadRecord } from './download-record.entity';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DownloadRecord])],
  providers: [DownloadsService],
  controllers: [DownloadsController],
})
export class DownloadsModule {}
