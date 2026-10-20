import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

import { API_PREFIX } from '../constants/api.constants.js';
import { HttpExceptionFilter } from '../filters/http-exception.filter.js';
import { configureSwagger } from './configure-swagger.js';

/**
 * Shared application configuration so tests exercise the same validation and error format as the
 * running API.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  configureSwagger(app);
}
