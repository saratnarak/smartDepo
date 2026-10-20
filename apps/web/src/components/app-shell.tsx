'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Brand } from '@/components/brand';
import { FullPageLoading } from '@/components/full-page-loading';
import { useI18n } from '@/components/i18n-provider';
import { LanguageSwitch } from '@/components/language-switch';
import { initials } from '@/lib/format';
import { logoutSession } from '@/lib/session-client';
import type { UserRole } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const DEPOT_ROLES: UserRole[] = ['OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'];

interface NavItem {
  href: string;
  labelKey: string;
  roles: UserRole[];
  icon: 'dashboard' | 'depots';
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    labelKey: 'nav.dashboard',
    roles: DEPOT_ROLES,
    icon: 'dashboard',
  },
  {
    href: '/platform/depots',
    labelKey: 'nav.platformDepots',
    roles: ['PLATFORM_ADMIN'],
    icon: 'depots',
  },
];

function NavIcon({ name }: { name: NavItem['icon'] }) {
  if (name === 'depots') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const depot = useSessionStore((state) => state.depot);
  const logoutReason = useSessionStore((state) => state.logoutReason);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== 'anonymous') {
      return;
    }

    if (logoutReason === 'depot-suspended') {
      router.replace('/suspended');
      return;
    }

    if (logoutReason === 'depot-rejected') {
      router.replace('/rejected');
      return;
    }

    if (logoutReason === 'depot-pending') {
      router.replace('/pending');
      return;
    }

    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, logoutReason, pathname, router]);

  useEffect(() => {
    if (status !== 'authenticated' || user === null) {
      return;
    }

    if (user.role === 'PLATFORM_ADMIN' && !pathname.startsWith('/platform')) {
      router.replace('/platform/depots');
      return;
    }

    if (user.role !== 'PLATFORM_ADMIN' && pathname.startsWith('/platform')) {
      router.replace('/forbidden');
    }
  }, [status, user, pathname, router]);

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'anonymous' || user === null) {
    return <FullPageLoading />;
  }

  const home = user.role === 'PLATFORM_ADMIN' ? '/platform/depots' : '/dashboard';
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const current = visibleItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pageTitle =
    current !== undefined
      ? t(current.labelKey)
      : pathname.startsWith('/forbidden')
        ? t('forbidden.title')
        : t('app.name');

  const logout = async () => {
    setLoggingOut(true);
    await logoutSession();
    router.replace('/login');
  };

  return (
    <div className="app-shell">
      <aside
        id="app-sidebar"
        className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}
        aria-label={t('nav.main')}
      >
        <div className="sidebar__brand">
          <Brand href={home} />
        </div>

        <nav className="sidebar__nav">
          <ul>
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-item${active ? ' nav-item--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <NavIcon name={item.icon} />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar__account">
          <div className="account-card">
            <span className="avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span className="account-card__text">
              <strong>{user.name}</strong>
              <small>{t(`roles.${user.role}`)}</small>
            </span>
          </div>
          <button
            type="button"
            className="button button--ghost button--wide"
            onClick={logout}
            disabled={loggingOut}
          >
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('common.closeMenu')}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="icon-button topbar__menu"
              aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <div>
              <p className="topbar__eyebrow">{t('app.workspace')}</p>
              <h1>{pageTitle}</h1>
            </div>
          </div>

          <div className="topbar__right">
            {depot !== null ? <span className="topbar__depot">{depot.name}</span> : null}
            <LanguageSwitch compact />
            <span className="topbar__user" title={user.name}>
              <span className="avatar avatar--small" aria-hidden="true">
                {initials(user.name)}
              </span>
              <span className="topbar__user-name">{user.name}</span>
            </span>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
