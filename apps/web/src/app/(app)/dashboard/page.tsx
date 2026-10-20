'use client';

import { useI18n } from '@/components/i18n-provider';
import { StatusBadge } from '@/components/status-badge';
import { useSessionStore } from '@/stores/session-store';

export default function DashboardPage() {
  const { t } = useI18n();
  const user = useSessionStore((state) => state.user);
  const depot = useSessionStore((state) => state.depot);

  if (user === null) {
    return null;
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">{t('dashboard.title')}</p>
          <h2>{t('dashboard.welcome', { name: user.name })}</h2>
          <p>{t('dashboard.subtitle')}</p>
        </div>
        {depot !== null ? <StatusBadge status={depot.status} /> : null}
      </section>

      <section className="summary-grid" aria-label={t('dashboard.title')}>
        <article className="summary-card">
          <span className="summary-card__label">{t('dashboard.role')}</span>
          <strong>{t(`roles.${user.role}`)}</strong>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">{t('dashboard.depot')}</span>
          <strong>{depot?.name ?? t('common.notAvailable')}</strong>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">{t('dashboard.status')}</span>
          <strong>
            {depot !== null ? <StatusBadge status={depot.status} /> : t('common.notAvailable')}
          </strong>
        </article>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel__heading">
            <h2>{t('dashboard.workspaceReady')}</h2>
          </div>
          <p className="muted">{t('dashboard.workspaceReadyBody')}</p>
          <div className="empty-state">
            <span className="empty-state__mark" aria-hidden="true">
              SD
            </span>
            <div>
              <strong>{t('dashboard.emptyTitle')}</strong>
              <p>{t('dashboard.emptyBody')}</p>
            </div>
          </div>
        </section>

        <aside className="panel panel--soft">
          <div className="panel__heading">
            <h2>{t('dashboard.upcoming')}</h2>
          </div>
          <p className="muted">{t('dashboard.upcomingBody')}</p>
          <div className="panel__divider" />
          <h3 className="panel__subheading">{t('dashboard.quickActions')}</h3>
          <p className="muted">{t('dashboard.quickActionsEmpty')}</p>
        </aside>
      </div>
    </div>
  );
}
