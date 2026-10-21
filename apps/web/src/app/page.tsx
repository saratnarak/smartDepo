'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { FullPageLoading } from '@/components/full-page-loading';
import { defaultPathForRole } from '@/lib/navigation';
import { useSessionStore } from '@/stores/session-store';

export default function HomePage() {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/login');
      return;
    }

    if (status === 'authenticated' && user !== null) {
      router.replace(user.mustChangePassword ? '/change-password' : defaultPathForRole(user.role));
    }
  }, [status, user, router]);

  return <FullPageLoading />;
}
