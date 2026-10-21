'use client';

import { DepotSettingsForm } from '@/features/depot-settings/depot-settings-form';
import { PlanCard } from '@/features/plans/plan-card';
import { useSessionStore } from '@/stores/session-store';

export default function SettingsPage() {
  const role = useSessionStore((state) => state.role);

  return (
    <div className="page-stack">
      <DepotSettingsForm />
      {role === 'OWNER' ? <PlanCard /> : null}
    </div>
  );
}
