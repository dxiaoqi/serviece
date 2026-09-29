import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DownloadRecord } from './download-record.entity';
import { TrackDownloadDto } from './dto/track-download.dto';

interface CountQuery {
  appKey?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class DownloadsService {
  constructor(
    @InjectRepository(DownloadRecord)
    private readonly recordRepository: Repository<DownloadRecord>,
  ) {}

  track(
    dto: TrackDownloadDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<DownloadRecord> {
    const record = this.recordRepository.create({
      appKey: dto.appKey,
      platform: dto.platform ?? 'unknown',
      version: dto.version ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });
    return this.recordRepository.save(record);
  }

  async count(query: CountQuery): Promise<{ total: number }> {
    const qb = this.recordRepository
      .createQueryBuilder('r')
      .select('COUNT(*)', 'total');
    this.applyFilters(qb, query);
    const row = await qb.getRawOne<{ total: string }>();
    return { total: Number(row?.total ?? 0) };
  }

  async trend(query: CountQuery, days: number): Promise<
    Array<{ date: string; count: number }>
  > {
    const qb = this.recordRepository
      .createQueryBuilder('r')
      .select(`TO_CHAR(r.created_at, 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count');
    this.applyFilters(qb, query);
    qb.andWhere(`r.created_at >= CURRENT_DATE - INTERVAL '${days - 1} days'`)
      .groupBy('date')
      .orderBy('date', 'ASC');

    const rows = await qb.getRawMany<{ date: string; count: string }>();

    const map = new Map(rows.map((r) => [r.date, Number(r.count)]));
    const result: Array<{ date: string; count: number }> = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: map.get(key) ?? 0 });
    }
    return result;
  }

  async ranking(limit: number): Promise<
    Array<{ appKey: string; count: number }>
  > {
    const rows = await this.recordRepository
      .createQueryBuilder('r')
      .select('r.app_key', 'appKey')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.app_key')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ appKey: string; count: string }>();
    return rows.map((r) => ({ appKey: r.appKey, count: Number(r.count) }));
  }

  async platforms(query: CountQuery): Promise<
    Array<{ platform: string; count: number }>
  > {
    const qb = this.recordRepository
      .createQueryBuilder('r')
      .select('r.platform', 'platform')
      .addSelect('COUNT(*)', 'count');
    this.applyFilters(qb, query);
    const rows = await qb
      .groupBy('r.platform')
      .orderBy('count', 'DESC')
      .getRawMany<{ platform: string; count: string }>();
    return rows.map((r) => ({ platform: r.platform, count: Number(r.count) }));
  }

  private applyFilters(
    qb: ReturnType<Repository<DownloadRecord>['createQueryBuilder']>,
    query: CountQuery,
  ) {
    if (query.appKey) {
      qb.andWhere('r.app_key = :appKey', { appKey: query.appKey });
    }
    if (query.startDate) {
      qb.andWhere('r.created_at >= :startDate', {
        startDate: `${query.startDate} 00:00:00`,
      });
    }
    if (query.endDate) {
      qb.andWhere('r.created_at <= :endDate', {
        endDate: `${query.endDate} 23:59:59`,
      });
    }
  }
}
