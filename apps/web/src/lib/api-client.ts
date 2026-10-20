'use client';

import { ApiError, networkError, parseErrorResponse } from '@/lib/api-error';
import { refreshAccessToken } from '@/lib/session-client';
import type { DepotAdminView, DepotStatus, Paginated, RegisteredDepot } from '@/lib/types';
import { getAccessToken } from '@/stores/session-store';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1').replace(/\/+$/, '');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildInit(options: RequestOptions, accessToken: string | null): RequestInit {
  const headers: Record<string, string> = { accept: 'application/json' };
  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  if (options.auth !== false && accessToken !== null) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return {
    method: options.method ?? 'GET',
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
  };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const accessToken = getAccessToken();
  let response: Response;

  try {
    response = await fetch(apiUrl(path), buildInit(options, accessToken));
  } catch {
    throw networkError();
  }

  if (response.status === 401 && options.auth !== false && options.retryOnUnauthorized !== false) {
    const refresh = await refreshAccessToken();

    if (refresh.ok) {
      return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }

    throw await parseErrorResponse(response);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (text.trim() === '') {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export interface RegisterDepotInput {
  depotName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
}

export function registerDepot(input: RegisterDepotInput): Promise<RegisteredDepot> {
  return apiRequest<RegisteredDepot>('/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export interface ListDepotsParams {
  status?: DepotStatus | '';
  page?: number;
  pageSize?: number;
}

export function listDepots({ status, page = 1, pageSize = 20 }: ListDepotsParams = {}): Promise<
  Paginated<DepotAdminView>
> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: 'createdAt',
    order: 'desc',
  });

  if (status !== undefined && status !== '') {
    params.set('status', status);
  }

  return apiRequest<Paginated<DepotAdminView>>(`/platform/depots?${params.toString()}`);
}

export function approveDepot(id: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/approve`, { method: 'POST' });
}

export function rejectDepot(id: string, reason: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export function suspendDepot(id: string, reason: string): Promise<DepotAdminView> {
  return apiRequest<DepotAdminView>(`/platform/depots/${id}/suspend`, {
    method: 'POST',
    body: { reason },
  });
}

export { ApiError };
