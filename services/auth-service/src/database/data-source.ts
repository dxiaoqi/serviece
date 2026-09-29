import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'app_user',
  password: process.env.DB_PASSWORD ?? 'app_pass_2026',
  database: process.env.AUTH_DB_NAME ?? 'auth_db',
  entities: [User],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
