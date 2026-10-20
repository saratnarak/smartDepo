'use client';

import { useI18n } from '@/components/i18n-provider';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useI18n();

  return (
    <section className="auth-card" aria-labelledby="auth-card-title">
      <div className="auth-card__heading">
        <p className="eyebrow">{t('app.workspace')}</p>
        <h1 id="auth-card-title">{title}</h1>
        {subtitle !== undefined ? <p className="auth-card__subtitle">{subtitle}</p> : null}
      </div>
      {children}
      {footer !== undefined ? <div className="auth-card__footer">{footer}</div> : null}
    </section>
  );
}
