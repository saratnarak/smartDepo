'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

import { AuthCard } from '@/components/auth-card';
import { useI18n } from '@/components/i18n-provider';
import { ApiError } from '@/lib/api-error';
import { registerDepot } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { defaultPathForRole } from '@/lib/navigation';
import { useSessionStore } from '@/stores/session-store';

interface RegisterFields {
  depotName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof RegisterFields, string>>;

const EMPTY_FIELDS: RegisterFields = {
  depotName: '',
  ownerName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const [fields, setFields] = useState<RegisterFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user !== null) {
      router.replace(user.mustChangePassword ? '/change-password' : defaultPathForRole(user.role));
    }
  }, [status, user, router]);

  const update = (field: keyof RegisterFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const depotName = fields.depotName.trim();
    const ownerName = fields.ownerName.trim();
    const phone = fields.phone.trim();
    const email = fields.email.trim();

    if (depotName === '') {
      errors.depotName = t('validation.required');
    } else if (depotName.length < 2) {
      errors.depotName = t('validation.minLength', { min: 2 });
    } else if (depotName.length > 120) {
      errors.depotName = t('validation.maxLength', { max: 120 });
    }

    if (ownerName === '') {
      errors.ownerName = t('validation.required');
    } else if (ownerName.length < 2) {
      errors.ownerName = t('validation.minLength', { min: 2 });
    } else if (ownerName.length > 120) {
      errors.ownerName = t('validation.maxLength', { max: 120 });
    }

    if (phone === '') {
      errors.phone = t('validation.required');
    } else if (!/^\+?[0-9() -]{7,20}$/.test(phone)) {
      errors.phone = t('validation.phone');
    }

    if (email === '') {
      errors.email = t('validation.required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      errors.email = t('validation.email');
    }

    if (fields.password === '') {
      errors.password = t('validation.required');
    } else if (fields.password.length < 8 || fields.password.length > 72) {
      errors.password = t('validation.passwordLength');
    } else if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(fields.password)) {
      errors.password = t('validation.passwordComplexity');
    }

    if (fields.confirmPassword === '') {
      errors.confirmPassword = t('validation.required');
    } else if (fields.confirmPassword !== fields.password) {
      errors.confirmPassword = t('validation.passwordMismatch');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      await registerDepot({
        depotName: fields.depotName.trim(),
        ownerName: fields.ownerName.trim(),
        phone: fields.phone.trim(),
        email: fields.email.trim(),
        password: fields.password,
      });
      router.push('/pending?registered=1');
    } catch (error) {
      if (error instanceof ApiError && error.detailReason === 'IDENTIFIER_TAKEN') {
        setFormError(t('errors.identifierTaken'));
      } else {
        setFormError(getErrorMessage(t, error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <p>
          {t('auth.haveAccount')} <Link href="/login">{t('auth.goToLogin')}</Link>
        </p>
      }
    >
      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="register-depot-name">{t('auth.depotName')}</label>
          <input
            id="register-depot-name"
            name="depotName"
            type="text"
            autoComplete="organization"
            value={fields.depotName}
            placeholder={t('auth.depotNamePlaceholder')}
            aria-invalid={fieldErrors.depotName !== undefined}
            aria-describedby={
              fieldErrors.depotName !== undefined ? 'register-depot-name-error' : undefined
            }
            onChange={(event) => update('depotName', event.target.value)}
            disabled={busy}
          />
          {fieldErrors.depotName !== undefined ? (
            <p className="field__error" id="register-depot-name-error">
              {fieldErrors.depotName}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="register-owner-name">{t('auth.ownerName')}</label>
          <input
            id="register-owner-name"
            name="ownerName"
            type="text"
            autoComplete="name"
            value={fields.ownerName}
            placeholder={t('auth.ownerNamePlaceholder')}
            aria-invalid={fieldErrors.ownerName !== undefined}
            aria-describedby={
              fieldErrors.ownerName !== undefined ? 'register-owner-name-error' : undefined
            }
            onChange={(event) => update('ownerName', event.target.value)}
            disabled={busy}
          />
          {fieldErrors.ownerName !== undefined ? (
            <p className="field__error" id="register-owner-name-error">
              {fieldErrors.ownerName}
            </p>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="register-phone">{t('auth.phone')}</label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={fields.phone}
              placeholder={t('auth.phonePlaceholder')}
              aria-invalid={fieldErrors.phone !== undefined}
              aria-describedby={
                fieldErrors.phone !== undefined ? 'register-phone-error' : undefined
              }
              onChange={(event) => update('phone', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.phone !== undefined ? (
              <p className="field__error" id="register-phone-error">
                {fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="register-email">{t('auth.email')}</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={fields.email}
              placeholder={t('auth.emailPlaceholder')}
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={
                fieldErrors.email !== undefined ? 'register-email-error' : undefined
              }
              onChange={(event) => update('email', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.email !== undefined ? (
              <p className="field__error" id="register-email-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="register-password">{t('auth.password')}</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={fields.password}
              placeholder={t('auth.passwordPlaceholder')}
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={
                fieldErrors.password !== undefined
                  ? 'register-password-error'
                  : 'register-password-hint'
              }
              onChange={(event) => update('password', event.target.value)}
              disabled={busy}
            />
            <p className="field__hint" id="register-password-hint">
              {t('auth.passwordHint')}
            </p>
            {fieldErrors.password !== undefined ? (
              <p className="field__error" id="register-password-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="register-confirm-password">{t('auth.confirmPassword')}</label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={fields.confirmPassword}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              aria-invalid={fieldErrors.confirmPassword !== undefined}
              aria-describedby={
                fieldErrors.confirmPassword !== undefined
                  ? 'register-confirm-password-error'
                  : undefined
              }
              onChange={(event) => update('confirmPassword', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.confirmPassword !== undefined ? (
              <p className="field__error" id="register-confirm-password-error">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>
        </div>

        <button type="submit" className="button button--primary button--wide" disabled={busy}>
          {busy ? t('auth.registering') : t('auth.register')}
        </button>
      </form>
    </AuthCard>
  );
}
