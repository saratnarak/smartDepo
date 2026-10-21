'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { PasswordField } from '@/components/password-field';
import { ApiError } from '@/lib/api-error';
import { changeOwnPassword } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { defaultPathForRole } from '@/lib/navigation';
import { useSessionStore } from '@/stores/session-store';

interface PasswordFields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof PasswordFields, string>>;

const EMPTY_FIELDS: PasswordFields = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ChangePasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const updateUser = useSessionStore((state) => state.updateUser);
  const [fields, setFields] = useState<PasswordFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const forced = user?.mustChangePassword === true;

  const update = (field: keyof PasswordFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (fields.currentPassword === '') {
      errors.currentPassword = t('validation.required');
    } else if (fields.currentPassword.length > 72) {
      errors.currentPassword = t('validation.maxLength', { max: 72 });
    }

    if (fields.newPassword === '') {
      errors.newPassword = t('validation.required');
    } else if (fields.newPassword.length < 8 || fields.newPassword.length > 72) {
      errors.newPassword = t('validation.passwordLength');
    } else if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(fields.newPassword)) {
      errors.newPassword = t('validation.passwordComplexity');
    } else if (fields.newPassword === fields.currentPassword) {
      errors.newPassword = t('password.samePassword');
    }

    if (fields.confirmPassword === '') {
      errors.confirmPassword = t('validation.required');
    } else if (fields.confirmPassword !== fields.newPassword) {
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
      await changeOwnPassword({
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
      });
      updateUser({ mustChangePassword: false });
      router.replace(user === null ? '/login' : defaultPathForRole(user.role));
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setFormError(t('password.currentIncorrect'));
      } else {
        setFormError(getErrorMessage(t, error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel auth-panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('nav.changePassword')}</p>
          <h2>{forced ? t('password.forcedTitle') : t('password.title')}</h2>
        </div>
      </div>
      <p className="muted">{t('password.subtitle')}</p>

      {forced ? (
        <p className="alert alert--info" role="status">
          {t('password.forcedNote')}
        </p>
      ) : null}

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <PasswordField
          id="change-password-current"
          label={t('password.current')}
          value={fields.currentPassword}
          autoComplete="current-password"
          placeholder={t('password.currentPlaceholder')}
          error={fieldErrors.currentPassword}
          onChange={(value) => update('currentPassword', value)}
          disabled={busy}
        />

        <div className="form-grid">
          <PasswordField
            id="change-password-new"
            label={t('password.new')}
            value={fields.newPassword}
            autoComplete="new-password"
            placeholder={t('password.newPlaceholder')}
            hint={t('password.hint')}
            error={fieldErrors.newPassword}
            onChange={(value) => update('newPassword', value)}
            disabled={busy}
          />
          <PasswordField
            id="change-password-confirm"
            label={t('password.confirm')}
            value={fields.confirmPassword}
            autoComplete="new-password"
            placeholder={t('password.confirmPlaceholder')}
            error={fieldErrors.confirmPassword}
            onChange={(value) => update('confirmPassword', value)}
            disabled={busy}
          />
        </div>

        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? t('password.submitting') : t('password.submit')}
        </button>
      </form>
    </section>
  );
}
