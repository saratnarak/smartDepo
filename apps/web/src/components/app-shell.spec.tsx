/** @jest-environment jsdom */

import { render, screen, within } from '@testing-library/react';

import { AppShell } from '@/components/app-shell';
import { I18nProvider } from '@/components/i18n-provider';
import type { SessionUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

let pathname = '/dashboard';
const replace = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace, push }),
}));

jest.mock('@/components/brand', () => ({
  Brand: () => <span>SmartDepo</span>,
}));

jest.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => <span>EN</span>,
}));

jest.mock('@/lib/session-client', () => ({
  logoutSession: jest.fn(),
}));

const USER: SessionUser = {
  id: 'user-1',
  name: 'Sokha Sales',
  email: 'sokha.sales@example.com',
  phone: '012345678',
  role: 'SALES',
  depotId: 'depot-1',
  mustChangePassword: true,
};

function renderShell() {
  return render(
    <I18nProvider initialLocale="en">
      <AppShell>
        <p>Password page content</p>
      </AppShell>
    </I18nProvider>,
  );
}

describe('AppShell forced password change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = '/dashboard';
    useSessionStore.setState({
      user: USER,
      role: 'SALES',
      depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
      accessToken: 'access-token',
      status: 'authenticated',
      logoutReason: null,
    });
  });

  it('redirects every other screen to the password form and hides navigation', () => {
    const { rerender } = renderShell();

    expect(replace).toHaveBeenCalledWith('/change-password');
    expect(screen.queryByText('Password page content')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    pathname = '/change-password';
    rerender(
      <I18nProvider initialLocale="en">
        <AppShell>
          <p>Password page content</p>
        </AppShell>
      </I18nProvider>,
    );

    expect(screen.getByText('Password page content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the normal navigation after the password is changed', () => {
    pathname = '/staff';
    useSessionStore.setState({
      user: { ...USER, role: 'OWNER', mustChangePassword: false },
      role: 'OWNER',
    });

    renderShell();

    expect(replace).not.toHaveBeenCalled();
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByText('Dashboard')).toBeInTheDocument();
    expect(nav.getByText('Staff')).toBeInTheDocument();
    expect(nav.getByText('Settings')).toBeInTheDocument();
    expect(nav.getByText('Change password')).toBeInTheDocument();
  });

  it('shows the audit log to the owner and not to the other depot roles', () => {
    pathname = '/dashboard';
    useSessionStore.setState({
      user: { ...USER, role: 'OWNER', mustChangePassword: false },
      role: 'OWNER',
    });

    renderShell();

    const ownerNav = within(screen.getByRole('navigation'));

    expect(ownerNav.getByText('Audit log')).toBeInTheDocument();
    expect(ownerNav.queryByText('Platform audit log')).not.toBeInTheDocument();

    useSessionStore.setState({
      user: { ...USER, role: 'SALES', mustChangePassword: false },
      role: 'SALES',
    });

    renderShell();

    const salesNav = within(screen.getAllByRole('navigation')[1] as HTMLElement);

    expect(salesNav.queryByText('Audit log')).not.toBeInTheDocument();
    expect(salesNav.queryByText('Platform audit log')).not.toBeInTheDocument();
  });

  it('keeps the platform admin away from the audit log of a depot', () => {
    pathname = '/platform/dashboard';
    useSessionStore.setState({
      user: {
        ...USER,
        role: 'PLATFORM_ADMIN',
        depotId: null,
        mustChangePassword: false,
      },
      role: 'PLATFORM_ADMIN',
      depot: null,
    });

    renderShell();

    const nav = within(screen.getByRole('navigation'));

    expect(nav.getByText('Platform audit log')).toBeInTheDocument();
    expect(nav.queryByText('Audit log')).not.toBeInTheDocument();
  });
});
