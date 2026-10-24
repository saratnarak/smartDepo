'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { getDepotPlan, getDepotSettings } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import type { DepotPlan } from '@/lib/types';
import { planUsageBars, reachedLimit, type LimitKind } from './plan-usage';

/**
 * The plan of the depot with the usage against the limits (FR-4). The owner sees it on the
 * settings page; the API refuses the endpoint for every other role.
 */
export function PlanCard() {
  const { t, locale } = useI18n();
  const [plan, setPlan] = useState<DepotPlan | null>(null);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [depotPlan, settings] = await Promise.all([getDepotPlan(), getDepotSettings()]);

      setPlan(depotPlan);
      setCurrency(settings.currency);
    } catch (caught) {
      setError(getErrorMessage(t, caught));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const bars = useMemo(
    () => (plan === null ? null : planUsageBars(plan.usage, plan.limits)),
    [plan],
  );
  const limit = bars === null ? null : reachedLimit(bars);

  if (loading) {
    return (
      <section className="panel">
        <p className="muted inline-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          {t('common.loading')}
        </p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="panel panel__body">
        <p className="alert alert--error" role="alert">
          {error}
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          {t('common.retry')}
        </button>
      </section>
    );
  }

  if (plan === null || bars === null) {
    return null;
  }

  const price =
    plan.plan === null
      ? null
      : currency === ''
        ? plan.plan.priceMonthly
        : formatMoney(plan.plan.priceMonthly, currency, locale);

  return (
    <section className="panel plan-card" aria-labelledby="plan-card-title">
      <div className="panel__heading">
        <h2 id="plan-card-title">{t('plan.title')}</h2>
        <span className="pill">{t('plan.ownerOnly')}</span>
      </div>

      {plan.plan === null ? (
        <p className="muted">{t('plan.noPlan')}</p>
      ) : (
        <>
          <div className="plan-card__head">
            <div>
              <strong className="plan-card__name">{plan.plan.name}</strong>
              <span className="muted">{t('plan.priceLabel', { price: price ?? '' })}</span>
            </div>
            {plan.overLimit ? (
              <span className="status-badge status-badge--warning">{t('plan.overLimit')}</span>
            ) : null}
          </div>

          <p className="muted">{t('plan.billingNote')}</p>

          {limit !== null ? (
            <p className="alert alert--warning" role="status">
              {limitMessage(t, limit, plan)}
            </p>
          ) : null}

          <UsageRow
            label={t('plan.users')}
            used={plan.usage.users}
            limit={plan.limits.users}
            bar={bars.users}
            limitText={
              bars.users.unlimited
                ? t('plan.noLimit')
                : t('plan.ofLimit', { limit: String(plan.limits.users ?? 0) })
            }
          />

          <UsageRow
            label={t('plan.products')}
            used={plan.usage.products}
            limit={plan.limits.products}
            bar={bars.products}
            limitText={
              bars.products.unlimited
                ? t('plan.noLimit')
                : t('plan.ofLimit', { limit: String(plan.limits.products ?? 0) })
            }
          />
        </>
      )}
    </section>
  );
}

function UsageRow({
  label,
  used,
  limit,
  bar,
  limitText,
}: {
  label: string;
  used: number;
  limit: number | null;
  bar: {
    percent: number;
    remaining: number | null;
    reached: boolean;
    over: boolean;
    unlimited: boolean;
  };
  limitText: string;
}) {
  const { t } = useI18n();

  return (
    <div className="usage-row">
      <div className="usage-row__head">
        <span>{label}</span>
        <span
          className={bar.reached ? 'usage-row__value usage-row__value--full' : 'usage-row__value'}
        >
          {used} {limitText}
        </span>
      </div>
      <div
        className={`usage-bar${bar.reached ? ' usage-bar--full' : ''}`}
        role="progressbar"
        aria-label={label}
        aria-valuenow={bar.unlimited ? undefined : used}
        aria-valuemin={bar.unlimited ? undefined : 0}
        aria-valuemax={bar.unlimited ? undefined : (limit ?? undefined)}
        aria-valuetext={bar.unlimited ? t('plan.noLimit') : `${String(used)} ${limitText}`}
      >
        <span className="usage-bar__fill" style={{ width: `${String(bar.percent)}%` }} />
      </div>
      {bar.remaining !== null && !bar.reached ? (
        <p className="usage-row__remaining muted">
          {t('plan.remaining', { count: bar.remaining })}
        </p>
      ) : null}
    </div>
  );
}

function limitMessage(
  t: ReturnType<typeof useI18n>['t'],
  limit: LimitKind,
  plan: DepotPlan,
): string {
  if (limit === 'users') {
    return t('plan.limitUsers', { max: String(plan.limits.users ?? 0) });
  }

  return t('plan.limitProducts', { max: String(plan.limits.products ?? 0) });
}
