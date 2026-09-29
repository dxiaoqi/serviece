import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '@app/shared';
import { DownloadsService } from './downloads.service';
import { TrackDownloadDto } from './dto/track-download.dto';

@Public()
@Controller('stats/downloads')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Post('track')
  track(@Body() dto: TrackDownloadDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip;
    return this.downloadsService.track(dto, {
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('count')
  count(
    @Query('appKey') appKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.downloadsService.count({ appKey, startDate, endDate });
  }

  @Get('trend')
  trend(
    @Query('appKey') appKey: string | undefined,
    @Query('days') days?: string,
  ) {
    const d = Math.min(Math.max(Number(days ?? 7) || 7, 1), 90);
    return this.downloadsService.trend({ appKey }, d);
  }

  @Get('ranking')
  ranking(@Query('limit') limit?: string) {
    const l = Math.min(Math.max(Number(limit ?? 10) || 10, 1), 100);
    return this.downloadsService.ranking(l);
  }

  @Get('platforms')
  platforms(@Query('appKey') appKey?: string) {
    return this.downloadsService.platforms({ appKey });
  }
}
