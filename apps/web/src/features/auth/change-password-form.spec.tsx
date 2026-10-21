/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { changeOwnPassword } from '@/lib/api-client';
import type { SessionUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));

jest.mock('@/lib/api-client', () => ({
  changeOwnPassword: jest.fn(),
}));

const changeMock = changeOwnPassword as jest.MockedFunction<typeof changeOwnPassword>;

const USER: SessionUser = {
  id: 'user-1',
  name: 'Sokha Sales',
  email: 'sokha.sales@example.com',
  phone: '012345678',
  role: 'SALES',
  depotId: 'depot-1',
  mustChangePassword: true,
};

function renderForm() {
  return render(
    <I18nProvider initialLocale="en">
      <ChangePasswordForm />
    </I18nProvider>,
  );
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      user: USER,
      role: 'SALES',
      depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
      accessToken: 'access-token',
      status: 'authenticated',
      logoutReason: null,
    });
  });

  it('explains why the password change is required', () => {
    renderForm();

    expect(screen.getByText('Change your password to continue')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your password was reset by an owner or administrator. Choose a new password before using the workspace.',
      ),
    ).toBeInTheDocument();
  });

  it('shows required errors before calling the API', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findAllByText('This field is required.')).toHaveLength(3);
    expect(changeMock).not.toHaveBeenCalled();
  });

  it('rejects a new password that matches the current one', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Current password'), 'Password1');
    await user.type(screen.getByLabelText('New password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(
      await screen.findByText('The new password must be different from the current password.'),
    ).toBeInTheDocument();
    expect(changeMock).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Current password'), 'Password1');
    await user.type(screen.getByLabelText('New password'), 'Password2');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password3');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(changeMock).not.toHaveBeenCalled();
  });

  it('changes the password, clears the forced flag, and goes home', async () => {
    const user = userEvent.setup();
    changeMock.mockResolvedValue({ mustChangePassword: false });
    renderForm();

    await user.type(screen.getByLabelText('Current password'), 'Password1');
    await user.type(screen.getByLabelText('New password'), 'Password2');
    await user.type(screen.getByLabelText('Confirm new password'), 'Password2');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => {
      expect(changeMock).toHaveBeenCalledWith({
        currentPassword: 'Password1',
        newPassword: 'Password2',
      });
      expect(useSessionStore.getState().user?.mustChangePassword).toBe(false);
      expect(replace).toHaveBeenCalledWith('/dashboard');
    });
  });
});
