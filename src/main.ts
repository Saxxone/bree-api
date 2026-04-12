import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ExceptionsLoggerFilter } from './health/exceptionsLogger.filter';
import { ui_base_url } from './utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Avoid origin: '*' with credentials: true (invalid in browsers for credentialed requests).
  const corsOrigins = [
    ui_base_url,
    'http://localhost:4000',
    'http://localhost:4000',
  ];
  app.enableCors({
    origin: [...new Set(corsOrigins)],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // Browsers send `Range` for cross-origin <video> seek/progressive play; reflect it on preflight.
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Range',
      'Accept',
      'Accept-Language',
      'Origin',
    ],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new ExceptionsLoggerFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      disableErrorMessages: false,
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  await app.listen(3000);

  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
