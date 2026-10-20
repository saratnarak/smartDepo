'use client';

import { useEffect } from 'react';

import { refreshAccessToken } from '@/lib/session-client';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void refreshAccessToken();
  }, []);

  return children;
}
