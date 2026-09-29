import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter, ResponseInterceptor } from '@app/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors();

  const port = Number(process.env.STATS_SERVICE_PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  console.log(`stats-service running on http://0.0.0.0:${port}`);
}

bootstrap();
