/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { StaffForm } from '@/features/staff/staff-form';
import { createStaff, updateStaff } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { StaffUser } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  createStaff: jest.fn(),
  updateStaff: jest.fn(),
}));

const createMock = createStaff as jest.MockedFunction<typeof createStaff>;
const updateMock = updateStaff as jest.MockedFunction<typeof updateStaff>;

const STAFF: StaffUser = {
  id: 'staff-1',
  name: 'Sokha Sales',
  email: 'sokha.sales@example.com',
  phone: '012345678',
  role: 'SALES',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
};

function renderForm(staff: StaffUser | null = null) {
  const onSaved = jest.fn();
  const onCancel = jest.fn();

  render(
    <I18nProvider initialLocale="en">
      <StaffForm staff={staff} onSaved={onSaved} onCancel={onCancel} />
    </I18nProvider>,
  );

  return { onSaved, onCancel };
}

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Sokha Sales');
  await user.type(screen.getByLabelText('Email address'), 'sokha.sales@example.com');
  await user.type(screen.getByLabelText('Phone number (optional)'), '012345678');
  await user.selectOptions(screen.getByLabelText('Role'), 'SALES');
  await user.type(screen.getByLabelText('Initial password'), 'Password1');
  await user.type(screen.getByLabelText('Confirm initial password'), 'Password1');
}

describe('StaffForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates required fields before creating a staff account', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Create staff account' }));

    expect(await screen.findAllByText('This field is required.')).toHaveLength(5);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a staff account and returns the saved record', async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(STAFF);
    const { onSaved } = renderForm();

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create staff account' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        name: 'Sokha Sales',
        email: 'sokha.sales@example.com',
        phone: '012345678',
        role: 'SALES',
        password: 'Password1',
      });
      expect(onSaved).toHaveBeenCalledWith(STAFF);
    });
  });

  it('shows the plan user limit clearly', async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(
      new ApiError('Plan limit reached', 409, {
        reason: 'PLAN_USER_LIMIT_REACHED',
        maxUsers: 3,
        activeUsers: 3,
      }),
    );
    renderForm();

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: 'Create staff account' }));

    expect(
      await screen.findByText(
        'Your plan allows at most 3 active users. Deactivate a staff member or upgrade the plan.',
      ),
    ).toBeInTheDocument();
  });

  it('edits an existing account without asking for a password', async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue({ ...STAFF, name: 'Sokha Updated' });
    const { onSaved } = renderForm(STAFF);

    expect(screen.queryByLabelText('Initial password')).not.toBeInTheDocument();

    const name = screen.getByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'Sokha Updated');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith('staff-1', {
        name: 'Sokha Updated',
        email: 'sokha.sales@example.com',
        phone: '012345678',
        role: 'SALES',
      });
      expect(onSaved).toHaveBeenCalled();
    });
  });
});
