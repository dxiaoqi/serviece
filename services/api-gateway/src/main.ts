import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GatewayAuthMiddleware } from './middleware/auth.middleware';
import { createServiceProxy } from './proxy/proxy.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        code: 42900,
        message: '请求过于频繁，请稍后再试',
        data: null,
      },
    }),
  );

  const authMiddleware = new GatewayAuthMiddleware();
  app.use(authMiddleware.use.bind(authMiddleware));

  const authTarget = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
  const statsTarget = process.env.STATS_SERVICE_URL ?? 'http://localhost:3002';

  app.use(createServiceProxy('/api/auth', authTarget));
  app.use(createServiceProxy('/api/stats', statsTarget));

  const port = Number(process.env.GATEWAY_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`api-gateway running on http://0.0.0.0:${port}`);
}

bootstrap();
