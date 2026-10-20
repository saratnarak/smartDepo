import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';
export const SWAGGER_YAML_PATH = 'api/docs-yaml';
export const SWAGGER_SECURITY_SCHEME = 'access-token';

/**
 * Swagger is available by default outside production. Production deployments must opt in with
 * SWAGGER_ENABLED=true; the JSON document and UI contain no secrets but expose the API surface.
 */
export function isSwaggerEnabled(): boolean {
  const configured = process.env.SWAGGER_ENABLED?.trim().toLowerCase();

  if (configured === 'true') {
    return true;
  }

  if (configured === 'false') {
    return false;
  }

  return process.env.NODE_ENV !== 'production';
}

export function configureSwagger(app: INestApplication): boolean {
  if (!isSwaggerEnabled()) {
    return false;
  }

  const config = new DocumentBuilder()
    .setTitle('SmartDepo API')
    .setDescription(
      [
        'Multi-tenant depot management API.',
        '',
        'All endpoints use the `/api/v1` prefix. The depot is always taken from the access token,',
        'never from a request body, query, or URL. Platform Admin endpoints are the only',
        'cross-depot paths and require the PLATFORM_ADMIN role.',
        '',
        'Sign in through `POST /api/v1/auth/login`, then send the access token as',
        '`Authorization: Bearer <accessToken>`. Access tokens last 15 minutes by default; use the',
        'refresh token to get a new pair. The web app keeps the refresh token in an httpOnly cookie',
        'through its Next.js BFF routes and the access token in memory.',
        '',
        'When a password is correct but the depot is PENDING, REJECTED, or SUSPENDED, login and',
        'refresh return 401 with `details.reason` and `details.depotStatus` so the UI can show the',
        'right status screen. Wrong passwords keep the generic response.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived access token returned by POST /api/v1/auth/login.',
      },
      SWAGGER_SECURITY_SCHEME,
    )
    .addTag('health', 'Public service health check')
    .addTag('auth', 'Depot registration, login, refresh, and current session')
    .addTag('platform-admin', 'Platform Admin depot review endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'SmartDepo API documentation',
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    yamlDocumentUrl: SWAGGER_YAML_PATH,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  return true;
}
