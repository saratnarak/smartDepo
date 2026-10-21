/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { LoginForm } from '@/features/auth/login-form';
import { ApiError } from '@/lib/api-error';
import { loginWithPassword } from '@/lib/session-client';
import type { AuthSession } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('@/lib/session-client', () => ({
  loginWithPassword: jest.fn(),
}));

const loginMock = loginWithPassword as jest.MockedFunction<typeof loginWithPassword>;

const SESSION: AuthSession = {
  accessToken: 'access-token',
  user: {
    id: 'user-1',
    name: 'Owner',
    email: 'owner@example.com',
    phone: '012345678',
    role: 'OWNER',
    depotId: 'depot-1',
    mustChangePassword: false,
  },
  depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
};

function renderLogin() {
  return render(
    <I18nProvider initialLocale="en">
      <LoginForm />
    </I18nProvider>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      user: null,
      role: null,
      depot: null,
      accessToken: null,
      status: 'anonymous',
      logoutReason: null,
    });
  });

  it('shows required-field errors before calling the API', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('signs in and redirects a depot user to the dashboard', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue(SESSION);
    renderLogin();

    await user.type(screen.getByLabelText('Email or phone'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('owner@example.com', 'Password1');
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('sends a user with a reset password to the password form first', async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      ...SESSION,
      user: { ...SESSION.user, mustChangePassword: true },
    });
    renderLogin();

    await user.type(screen.getByLabelText('Email or phone'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/change-password'));
  });

  it('sends a pending depot to the waiting screen', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(
      new ApiError('Invalid credentials', 401, { reason: 'DEPOT_PENDING' }, 'Unauthorized'),
    );
    renderLogin();

    await user.type(screen.getByLabelText('Email or phone'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/pending'));
  });

  it('shows a readable error for invalid credentials', async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new ApiError('Invalid credentials', 401, null, 'Unauthorized'));
    renderLogin();

    await user.type(screen.getByLabelText('Email or phone'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPassword1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('We could not sign you in. Check your details and try again.'),
    ).toBeInTheDocument();
  });
});
