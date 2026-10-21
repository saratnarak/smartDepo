'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { Modal } from '@/components/modal';
import { PasswordField } from '@/components/password-field';
import { resetStaffPassword } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import type { StaffUser } from '@/lib/types';

interface ResetPasswordDialogProps {
  staff: StaffUser | null;
  onClose: () => void;
  onReset: () => void;
}

interface ResetFields {
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof ResetFields, string>>;

const EMPTY_FIELDS: ResetFields = { password: '', confirmPassword: '' };

export function ResetPasswordDialog({ staff, onClose, onReset }: ResetPasswordDialogProps) {
  const { t } = useI18n();
  const [fields, setFields] = useState<ResetFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (staff !== null) {
      setFields(EMPTY_FIELDS);
      setFieldErrors({});
      setFormError(null);
    }
  }, [staff]);

  const update = (field: keyof ResetFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

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

    if (staff === null || !validate()) {
      return;
    }

    setBusy(true);

    try {
      await resetStaffPassword(staff.id, fields.password);
      onReset();
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={staff !== null} title={t('staff.resetTitle')} busy={busy} onClose={onClose}>
      <p className="dialog__description">
        {staff === null ? '' : t('staff.resetMessage', { name: staff.name })}
      </p>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <PasswordField
          id="reset-staff-password"
          label={t('staff.resetPasswordLabel')}
          value={fields.password}
          autoComplete="new-password"
          hint={t('staff.passwordHint')}
          error={fieldErrors.password}
          onChange={(value) => update('password', value)}
          disabled={busy}
        />
        <PasswordField
          id="reset-staff-confirm-password"
          label={t('staff.resetConfirmLabel')}
          value={fields.confirmPassword}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          onChange={(value) => update('confirmPassword', value)}
          disabled={busy}
        />

        <div className="dialog__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t('staff.resetting') : t('staff.resetSubmit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
