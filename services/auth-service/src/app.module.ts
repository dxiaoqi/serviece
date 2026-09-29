import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'app_user',
      password: process.env.DB_PASSWORD ?? 'app_pass_2026',
      database: process.env.AUTH_DB_NAME ?? 'auth_db',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      migrationsRun: false,
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
