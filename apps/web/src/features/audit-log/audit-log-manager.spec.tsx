/** @jest-environment jsdom */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { AuditLogManager } from '@/features/audit-log/audit-log-manager';
import { listAuditLog, listPlatformAuditLog, listStaff } from '@/lib/api-client';
import type { AuditLogEntry, Paginated, StaffUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  listAuditLog: jest.fn(),
  listPlatformAuditLog: jest.fn(),
  listStaff: jest.fn(),
}));

const listAuditLogMock = listAuditLog as jest.MockedFunction<typeof listAuditLog>;
const listPlatformAuditLogMock = listPlatformAuditLog as jest.MockedFunction<
  typeof listPlatformAuditLog
>;
const listStaffMock = listStaff as jest.MockedFunction<typeof listStaff>;

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'entry-1',
    action: 'STAFF_CREATED',
    entityType: 'User',
    entityId: 'user-1',
    actor: { id: 'user-1', name: 'Sokha Owner', role: 'OWNER' },
    ipAddress: '203.0.113.10',
    before: null,
    after: { name: 'Sokha', role: 'SALES' },
    metadata: null,
    createdAt: '2026-10-21T08:30:00.000Z',
    ...overrides,
  };
}

function page(entries: AuditLogEntry[], total = entries.length): Paginated<AuditLogEntry> {
  return { data: entries, meta: { page: 1, pageSize: 20, total } };
}

const STAFF: StaffUser = {
  id: 'staff-1',
  name: 'Demo Sales',
  email: 'sales@example.com',
  phone: null,
  role: 'SALES',
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function setRole(role: 'OWNER' | 'PLATFORM_ADMIN') {
  useSessionStore.setState({
    user: {
      id: role === 'OWNER' ? 'owner-1' : 'admin-1',
      name: role === 'OWNER' ? 'Sokha Owner' : 'Platform Admin',
      email: 'user@example.com',
      phone: null,
      role,
      depotId: role === 'OWNER' ? 'depot-1' : null,
      mustChangePassword: false,
    },
    role,
    depot: role === 'OWNER' ? { id: 'depot-1', name: 'Depot A', status: 'APPROVED' } : null,
    accessToken: 'access-token',
    status: 'authenticated',
    logoutReason: null,
  });
}

function renderAuditLog(scope: 'depot' | 'platform' = 'depot') {
  setRole(scope === 'platform' ? 'PLATFORM_ADMIN' : 'OWNER');

  return render(
    <I18nProvider initialLocale="en">
      <AuditLogManager scope={scope} />
    </I18nProvider>,
  );
}

describe('the audit log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listAuditLogMock.mockResolvedValue(page([entry()]));
    listPlatformAuditLogMock.mockResolvedValue(page([entry({ action: 'DEPOT_APPROVED' })]));
    listStaffMock.mockResolvedValue({
      data: [STAFF],
      meta: { page: 1, pageSize: 100, total: 1 },
    });
  });

  it('shows the entries of the depot with the user, the action, and the record', async () => {
    renderAuditLog('depot');

    const details = await screen.findByRole('button', { name: 'View' });
    const row = details.closest('tr');

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Staff account created')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Sokha Owner')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('User')).toBeInTheDocument();
    expect(listAuditLogMock).toHaveBeenCalled();
  });

  it('sends the filters of the user to the API', async () => {
    const user = userEvent.setup();
    renderAuditLog('depot');

    await screen.findByRole('button', { name: 'View' });

    await user.selectOptions(screen.getByLabelText('Action'), 'USER_LOGIN');
    await user.selectOptions(screen.getByLabelText('Record type'), 'Depot');
    await user.click(screen.getByRole('button', { name: 'Apply the filters' }));

    await waitFor(() => {
      expect(listAuditLogMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'USER_LOGIN', entityType: 'Depot' }),
      );
    });
  });

  it('refuses a period where the first day is after the last day', async () => {
    const user = userEvent.setup();
    renderAuditLog('depot');

    await screen.findByRole('button', { name: 'View' });

    await user.type(screen.getByLabelText('From'), '2026-11-01');
    await user.type(screen.getByLabelText('To'), '2026-10-01');

    expect(
      await screen.findByText(/The first day must not be after the last day/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply the filters' })).toBeDisabled();
  });

  it('shows the details of an entry as keys and values', async () => {
    const user = userEvent.setup();
    renderAuditLog('depot');

    await user.click(await screen.findByRole('button', { name: 'View' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('After the change')).toBeInTheDocument();
    expect(within(dialog).getByText('name')).toBeInTheDocument();
    expect(within(dialog).getByText('Sokha')).toBeInTheDocument();
    expect(within(dialog).getByText('role')).toBeInTheDocument();
    expect(within(dialog).getByText('SALES')).toBeInTheDocument();
    expect(dialog.textContent).not.toContain('{');
  });

  it('has no control to change or to remove an entry', async () => {
    renderAuditLog('depot');

    await screen.findByRole('button', { name: 'View' });

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /delete|remove|archive/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the entries of the platform for the platform admin', async () => {
    renderAuditLog('platform');

    expect(await screen.findByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getAllByText('Depot approved').length).toBeGreaterThan(0);
    expect(listPlatformAuditLogMock).toHaveBeenCalled();
    expect(listAuditLogMock).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is no entry', async () => {
    listAuditLogMock.mockResolvedValue(page([]));
    renderAuditLog('depot');

    expect(await screen.findByText('No entry')).toBeInTheDocument();
  });
});
