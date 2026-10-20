/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { RegisterForm } from '@/features/auth/register-form';
import { registerDepot } from '@/lib/api-client';
import { useSessionStore } from '@/stores/session-store';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('@/lib/api-client', () => ({
  registerDepot: jest.fn(),
}));

const registerMock = registerDepot as jest.MockedFunction<typeof registerDepot>;

function renderRegister() {
  return render(
    <I18nProvider initialLocale="en">
      <RegisterForm />
    </I18nProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Depot name'), 'Boeng Keng Kong Depot');
  await user.type(screen.getByLabelText('Owner name'), 'Sokha Owner');
  await user.type(screen.getByLabelText('Phone number'), '012345678');
  await user.type(screen.getByLabelText('Email address'), 'owner@example.com');
  await user.type(screen.getByLabelText('Password'), 'Password1');
}

describe('RegisterForm', () => {
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

  it('blocks submission when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillForm(user);
    await user.type(screen.getByLabelText('Confirm password'), 'Password2');
    await user.click(screen.getByRole('button', { name: 'Register depot' }));

    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('validates the email and phone fields', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Depot name'), 'Depot A');
    await user.type(screen.getByLabelText('Owner name'), 'Owner A');
    await user.type(screen.getByLabelText('Phone number'), 'not-a-phone');
    await user.type(screen.getByLabelText('Email address'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Register depot' }));

    expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument();
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers the depot and goes to the waiting screen', async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue({
      depot: { id: 'depot-1', name: 'Boeng Keng Kong Depot', status: 'PENDING' },
      owner: {
        id: 'owner-1',
        name: 'Sokha Owner',
        email: 'owner@example.com',
        phone: '012345678',
      },
    });
    renderRegister();

    await fillForm(user);
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Register depot' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        depotName: 'Boeng Keng Kong Depot',
        ownerName: 'Sokha Owner',
        phone: '012345678',
        email: 'owner@example.com',
        password: 'Password1',
      });
      expect(mockPush).toHaveBeenCalledWith('/pending?registered=1');
    });
  });
});
