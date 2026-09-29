import { DataSource } from 'typeorm';
import { DownloadRecord } from '../downloads/download-record.entity';

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'app_user',
  password: process.env.DB_PASSWORD ?? 'app_pass_2026',
  database: process.env.STATS_DB_NAME ?? 'stats_db',
  entities: [DownloadRecord],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
