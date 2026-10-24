/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { I18nProvider } from '@/components/i18n-provider';
import { PlanChangeDialog } from '@/features/platform-depots/plan-change-dialog';
import { changeDepotPlan } from '@/lib/api-client';
import type { DepotAdminView, Plan } from '@/lib/types';

jest.mock('@/lib/api-client', () => ({
  changeDepotPlan: jest.fn(),
}));

const changeDepotPlanMock = changeDepotPlan as jest.MockedFunction<typeof changeDepotPlan>;

const DEPOT: DepotAdminView = {
  id: 'depot-1',
  name: 'Beer Depot',
  slug: 'beer-depot',
  phone: '012345678',
  email: 'owner@example.com',
  status: 'APPROVED',
  statusReason: null,
  approvedAt: '2026-10-01T00:00:00.000Z',
  plan: { code: 'BASIC', name: 'Basic' },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const PLANS: Plan[] = [
  {
    id: 'plan-1',
    code: 'FREE_TRIAL',
    name: 'Free Trial',
    priceMonthly: '0.00',
    maxUsers: 5,
    maxProducts: 10,
    isActive: true,
  },
  {
    id: 'plan-2',
    code: 'BASIC',
    name: 'Basic',
    priceMonthly: '19.00',
    maxUsers: 15,
    maxProducts: 100,
    isActive: true,
  },
  {
    id: 'plan-3',
    code: 'PRO',
    name: 'Pro',
    priceMonthly: '49.00',
    maxUsers: 50,
    maxProducts: 1000,
    isActive: true,
  },
];

function renderDialog(onChanged = jest.fn()) {
  return render(
    <I18nProvider initialLocale="en">
      <PlanChangeDialog depot={DEPOT} plans={PLANS} onChanged={onChanged} onClose={jest.fn()} />
    </I18nProvider>,
  );
}

describe('the confirmation of a plan change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    changeDepotPlanMock.mockResolvedValue({
      plan: PLANS[2] ?? null,
      usage: { users: 3, products: 4 },
      limits: { users: 50, products: 1000 },
      overLimit: false,
    });
  });

  it('shows the depot, the plans, and the limits of the picked plan', () => {
    renderDialog();

    expect(screen.getByText(/Beer Depot/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Free Trial' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pro' })).toBeInTheDocument();
    expect(
      screen.getByText(/The limits of this plan: 15 staff accounts and 100 products/),
    ).toBeInTheDocument();
  });

  it('asks before it changes the plan and calls the API of the platform', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn();
    renderDialog(onChanged);

    await user.selectOptions(screen.getByLabelText('The new plan'), 'PRO');
    await user.click(screen.getByRole('button', { name: 'Confirm the plan change' }));

    expect(changeDepotPlanMock).toHaveBeenCalledWith('depot-1', 'PRO');
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not change anything before the Platform Admin confirms', () => {
    renderDialog();

    expect(changeDepotPlanMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm the plan change' })).toBeInTheDocument();
  });

  it('shows the error of the API and keeps the dialog open', async () => {
    const user = userEvent.setup();
    changeDepotPlanMock.mockRejectedValue(new Error('boom'));
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Confirm the plan change' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
