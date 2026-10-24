'use client';

import { useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { Modal } from '@/components/modal';
import { changeDepotPlan } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import type { DepotAdminView, Plan } from '@/lib/types';

interface PlanChangeDialogProps {
  /** The depot the plan belongs to, or null when the dialog is closed. */
  depot: DepotAdminView | null;
  /** Every plan of the platform. */
  plans: Plan[];
  /** Called after the plan of the depot was changed. */
  onChanged: () => void;
  onClose: () => void;
}

/**
 * The confirmation of a plan change (FR-4). The Platform Admin picks the plan, sees the limits of
 * that plan, and confirms before the API is called: the change is written to the audit log of the
 * depot, so it is never a silent change.
 */
export function PlanChangeDialog({ depot, plans, onChanged, onClose }: PlanChangeDialogProps) {
  const { t } = useI18n();
  const [picked, setPicked] = useState<{ depotId: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The plan of the depot is the first choice, so the dialog never waits for a second click.
  const planCode =
    picked !== null && picked.depotId === depot?.id
      ? picked.code
      : (depot?.plan?.code ?? plans[0]?.code ?? '');

  const close = () => {
    if (!busy) {
      onClose();
    }
  };

  const save = async () => {
    if (depot === null || planCode === '') {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await changeDepotPlan(depot.id, planCode);
      onChanged();
    } catch (caught) {
      setError(getErrorMessage(t, caught));
    } finally {
      setBusy(false);
    }
  };

  const selected = plans.find((plan) => plan.code === planCode) ?? null;

  return (
    <Modal open={depot !== null} title={t('platform.planDialogTitle')} busy={busy} onClose={close}>
      <div className="panel__body">
        <p className="muted">
          {depot === null ? '' : t('platform.planDialogMessage', { name: depot.name })}
        </p>

        <div className="field">
          <label htmlFor="plan-code">{t('platform.planLabel')}</label>
          <select
            id="plan-code"
            value={planCode}
            onChange={(event) =>
              setPicked(depot === null ? null : { depotId: depot.id, code: event.target.value })
            }
            disabled={busy}
          >
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>

        {selected === null ? null : (
          <p className="muted">
            {t('platform.planLimits', {
              users: String(selected.maxUsers ?? t('plan.unlimited')),
              products: String(selected.maxProducts ?? t('plan.unlimited')),
            })}
          </p>
        )}

        {error !== null ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="row-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void save()}
            disabled={busy || planCode === ''}
          >
            {t('platform.confirmPlanChange')}
          </button>
          <button type="button" className="button button--quiet" onClick={close} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
