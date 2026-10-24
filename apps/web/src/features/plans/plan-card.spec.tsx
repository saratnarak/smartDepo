/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/components/i18n-provider';
import { PlanCard } from '@/features/plans/plan-card';
import { getDepotPlan, getDepotSettings } from '@/lib/api-client';
import type { DepotPlan, DepotSettings } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

jest.mock('@/lib/api-client', () => ({
  getDepotPlan: jest.fn(),
  getDepotSettings: jest.fn(),
}));

const getDepotPlanMock = getDepotPlan as jest.MockedFunction<typeof getDepotPlan>;
const getSettingsMock = getDepotSettings as jest.MockedFunction<typeof getDepotSettings>;

const SETTINGS: DepotSettings = {
  id: 'depot-1',
  name: 'Depot A',
  address: null,
  currency: 'KHR',
  locale: 'EN',
  invoiceFooter: null,
  logoKey: null,
};

function plan(overrides: Partial<DepotPlan> = {}): DepotPlan {
  return {
    plan: {
      id: 'plan-1',
      code: 'FREE_TRIAL',
      name: 'Free Trial',
      priceMonthly: '0.00',
      maxUsers: 5,
      maxProducts: 10,
      isActive: true,
    },
    usage: { users: 3, products: 4 },
    limits: { users: 5, products: 10 },
    overLimit: false,
    ...overrides,
  };
}

function setRole() {
  useSessionStore.setState({
    user: {
      id: 'owner-1',
      name: 'Sokha Owner',
      email: 'owner@example.com',
      phone: null,
      role: 'OWNER',
      depotId: 'depot-1',
      mustChangePassword: false,
    },
    role: 'OWNER',
    depot: { id: 'depot-1', name: 'Depot A', status: 'APPROVED' },
    accessToken: 'access-token',
    status: 'authenticated',
    logoutReason: null,
  });
}

function renderCard() {
  setRole();

  return render(
    <I18nProvider initialLocale="en">
      <PlanCard />
    </I18nProvider>,
  );
}

describe('the plan card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDepotPlanMock.mockResolvedValue(plan());
    getSettingsMock.mockResolvedValue(SETTINGS);
  });

  it('shows the plan of the depot with the usage against the limits', async () => {
    renderCard();

    expect(await screen.findByText('Free Trial')).toBeInTheDocument();
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
    expect(screen.getByText('4 of 10')).toBeInTheDocument();

    const userBar = screen.getByRole('progressbar', { name: 'Staff accounts' });

    expect(userBar).toHaveAttribute('aria-valuenow', '3');
    expect(userBar).toHaveAttribute('aria-valuemax', '5');
  });

  it('shows how many places are left before the limit is reached', async () => {
    renderCard();

    expect(await screen.findByText('2 left')).toBeInTheDocument();
    expect(screen.getByText('6 left')).toBeInTheDocument();
  });

  it('shows a clear message when the limit of the users is reached', async () => {
    getDepotPlanMock.mockResolvedValue(
      plan({ usage: { users: 5, products: 4 }, limits: { users: 5, products: 10 } }),
    );
    renderCard();

    expect(
      await screen.findByText(/Your plan allows at most 5 staff accounts/),
    ).toBeInTheDocument();
  });

  it('shows a clear message when the limit of the products is reached', async () => {
    getDepotPlanMock.mockResolvedValue(
      plan({ usage: { users: 1, products: 10 }, limits: { users: 5, products: 10 } }),
    );
    renderCard();

    expect(await screen.findByText(/Your plan allows at most 10 products/)).toBeInTheDocument();
  });

  it('says when the depot has no plan', async () => {
    getDepotPlanMock.mockResolvedValue(plan({ plan: null }));
    renderCard();

    expect(await screen.findByText('This depot has no plan yet.')).toBeInTheDocument();
  });

  it('shows the error of the API', async () => {
    getDepotPlanMock.mockRejectedValue(new Error('boom'));
    renderCard();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
