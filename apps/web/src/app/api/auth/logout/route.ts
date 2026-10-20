import { NextResponse } from 'next/server';

import { clearRefreshCookie } from '@/lib/server-auth';

export function POST(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  clearRefreshCookie(response);
  return response;
}
