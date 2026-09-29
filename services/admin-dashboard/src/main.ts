import 'reflect-metadata';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import session from 'express-session';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.use(
    session({
      secret:
        process.env.DASHBOARD_SESSION_SECRET ||
        process.env.JWT_SECRET ||
        'dashboard-dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8,
      },
    }),
  );

  const port = Number(process.env.DASHBOARD_PORT ?? 3100);
  await app.listen(port, '0.0.0.0');
  new Logger('admin-dashboard').log(`管理台运行于 http://0.0.0.0:${port}`);
}

bootstrap();
