import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { configureApp } from './common/bootstrap/configure-app.js';
import { loadEnv } from './common/config/env.js';
import { DEFAULT_WEB_ORIGIN } from './common/constants/api.constants.js';

loadEnv();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  app.use(helmet());
  configureApp(app);
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });

  await app.listen(Number(process.env.API_PORT ?? 3001));
}

await bootstrap();
