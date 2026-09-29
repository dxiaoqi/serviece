export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function buildTypeOrmConfig(
  database: string,
): DatabaseConfig {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'app_user',
    password: process.env.DB_PASSWORD ?? 'app_pass_2026',
    database,
  };
}
