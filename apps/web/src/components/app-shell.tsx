'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Brand } from '@/components/brand';
import { FullPageLoading } from '@/components/full-page-loading';
import { useI18n } from '@/components/i18n-provider';
import { LanguageSwitch } from '@/components/language-switch';
import { initials } from '@/lib/format';
import {
  canAccessPath,
  defaultPathForRole,
  visibleNavItems,
  type NavIconName,
} from '@/lib/navigation';
import { logoutSession } from '@/lib/session-client';
import { useSessionStore } from '@/stores/session-store';

function NavIcon({ name }: { name: NavIconName }) {
  if (name === 'products') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5 12 4l8 4.5v9L12 22l-8-4.5z" />
        <path d="M4 8.5 12 13l8-4.5M12 13v9" />
      </svg>
    );
  }

  if (name === 'categories') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h7l9 9-7 7-9-9z" />
        <circle cx="8" cy="9" r="1.2" />
      </svg>
    );
  }

  if (name === 'stock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 8.5 12 4l8.5 4.5V19H3.5z" />
        <path d="M3.5 12.5h17M9 12.5V19M15 12.5V19" />
      </svg>
    );
  }

  if (name === 'purchases') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h14v16H5z" />
        <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
      </svg>
    );
  }

  if (name === 'suppliers') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 9h18M4.5 9v10h15V9" />
        <path d="M7.5 9V6h9v3" />
        <path d="M9.5 13h5" />
      </svg>
    );
  }

  if (name === 'invoices') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 11h7M9 15h7M9 7h4" />
      </svg>
    );
  }

  if (name === 'customers') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.6 3.2-5.5 7-5.5s6.3 1.9 7 5.5" />
      </svg>
    );
  }

  if (name === 'credit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 14h4" />
      </svg>
    );
  }

  if (name === 'reports') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4v16h16" />
        <path d="M7.5 15.5v-3M12 15.5v-6M16.5 15.5v-4" />
      </svg>
    );
  }

  if (name === 'audit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v4h4" />
        <path d="M9 12h7M9 16h5" />
      </svg>
    );
  }

  if (name === 'depots') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }

  if (name === 'staff') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8" />
        <path d="M17.5 14.2c1.7.7 2.8 2.4 3 4.8" />
      </svg>
    );
  }

  if (name === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }

  if (name === 'key') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9M17 12v3M20 12v2" />
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

    if (user.mustChangePassword) {
      if (pathname !== '/change-password') {
        router.replace('/change-password');
      }
      return;
    }

    if (!canAccessPath(user.role, pathname)) {
      router.replace(user.role === 'PLATFORM_ADMIN' ? defaultPathForRole(user.role) : '/forbidden');
    }
  }, [status, user, pathname, router]);

  const logout = async () => {
    setLoggingOut(true);
    await logoutSession();
    router.replace('/login');
  };

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (status === 'anonymous' || user === null) {
    return <FullPageLoading />;
  }

  if (user.mustChangePassword) {
    if (pathname !== '/change-password') {
      return <FullPageLoading />;
    }

    return (
      <div className="forced-shell">
        <header className="forced-shell__header">
          <Brand />
          <div className="forced-shell__actions">
            <LanguageSwitch compact />
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={logout}
              disabled={loggingOut}
            >
              {t('common.logout')}
            </button>
          </div>
        </header>
        <main className="forced-shell__main">
          <div className="forced-shell__content">{children}</div>
        </main>
      </div>
    );
  }

  if (!canAccessPath(user.role, pathname)) {
    return <FullPageLoading />;
  }

  const home = defaultPathForRole(user.role);
  const visibleItems = visibleNavItems(user.role);
  const current = visibleItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const pageTitle =
    current !== undefined
      ? t(current.labelKey)
      : pathname.startsWith('/forbidden')
        ? t('forbidden.title')
        : t('app.name');

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
