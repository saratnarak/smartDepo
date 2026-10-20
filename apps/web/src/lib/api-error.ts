export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    details: unknown = null,
    code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
  }

  get detailReason(): string | null {
    if (isRecord(this.details) && typeof this.details.reason === 'string') {
      return this.details.reason;
    }

    return null;
  }

  get fieldErrors(): string[] {
    if (!Array.isArray(this.details)) {
      return [];
    }

    return this.details.filter((entry): entry is string => typeof entry === 'string');
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bodyMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) {
    return fallback;
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return fallback;
}

export async function parseErrorResponse(response: Response): Promise<ApiError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const fallback = response.statusText.trim() === '' ? 'Request failed' : response.statusText;
  const message = bodyMessage(body, fallback);
  const code = isRecord(body) && typeof body.error === 'string' ? body.error : null;
  const details = isRecord(body) && body.details !== undefined ? body.details : null;

  return new ApiError(message, response.status, details, code);
}

export function networkError(): ApiError {
  return new ApiError('Unable to reach the server', 0, null, 'NETWORK_ERROR');
}
