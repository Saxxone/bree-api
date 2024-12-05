import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExceptionsLoggerFilter } from './health/exceptionsLogger.filter';
import helmet from 'helmet';
import { ui_base_url } from 'utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [ui_base_url, 'http://localhost:8081', '*'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalFilters(new ExceptionsLoggerFilter());

  //TODO enable gaurds and do not require auth for public routes
  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     disableErrorMessages: true,
  //     transform: true,
  //     whitelist: true,
  //     enableDebugMessages: true, //only use in development
  //     stopAtFirstError: true,
  //   }),
  // );

  app.use(helmet());

  await app.listen(3000);

  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
