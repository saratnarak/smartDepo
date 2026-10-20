import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalises every error to { statusCode, error, message, details? } (AGENTS.md section 9).
 * Validation details are arrays from class-validator; unexpected errors never expose internals.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { json(body: ErrorBody): void };
    }>();

    if (!(exception instanceof HttpException)) {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      return;
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    let message = exception.message;
    let error = exception.name.replace(/Exception$/, '');
    let details: unknown;

    if (typeof payload === 'string') {
      message = payload;
    } else if (isRecord(payload)) {
      if (typeof payload.error === 'string') {
        error = payload.error;
      }

      if (Array.isArray(payload.message)) {
        message = 'Validation failed';
        details = payload.message;
      } else if (typeof payload.message === 'string') {
        message = payload.message;
      }

      if (payload.details !== undefined) {
        details = payload.details;
      }
    }

    const body: ErrorBody = { statusCode, error, message };

    if (details !== undefined) {
      body.details = details;
    }

    response.status(statusCode).json(body);
  }
}
