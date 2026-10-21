'use client';

import { useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { PasswordField } from '@/components/password-field';
import { createStaff, updateStaff } from '@/lib/api-client';
import { STAFF_ROLES, type StaffRole, type StaffUser } from '@/lib/types';
import { staffErrorMessage } from '@/features/staff/staff-errors';

interface StaffFields {
  name: string;
  email: string;
  phone: string;
  role: StaffRole | '';
  password: string;
  confirmPassword: string;
}

type FieldErrors = Partial<Record<keyof StaffFields, string>>;

interface StaffFormProps {
  staff: StaffUser | null;
  onSaved: (staff: StaffUser) => void;
  onCancel: () => void;
}

function initialFields(staff: StaffUser | null): StaffFields {
  return {
    name: staff?.name ?? '',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    role: staff?.role ?? '',
    password: '',
    confirmPassword: '',
  };
}

export function StaffForm({ staff, onSaved, onCancel }: StaffFormProps) {
  const { t } = useI18n();
  const editing = staff !== null;
  const [fields, setFields] = useState<StaffFields>(() => initialFields(staff));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof StaffFields>(field: K, value: StaffFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const email = fields.email.trim();
    const phone = fields.phone.trim();

    if (name === '') {
      errors.name = t('validation.required');
    } else if (name.length < 2) {
      errors.name = t('validation.minLength', { min: 2 });
    } else if (name.length > 120) {
      errors.name = t('validation.maxLength', { max: 120 });
    }

    if (email === '') {
      errors.email = t('validation.required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      errors.email = t('validation.email');
    }

    if (phone !== '') {
      if (!/^\+?[0-9() -]{7,20}$/.test(phone)) {
        errors.phone = t('validation.phone');
      } else if (phone.length > 20) {
        errors.phone = t('validation.maxLength', { max: 20 });
      }
    }

    if (fields.role === '') {
      errors.role = t('validation.required');
    }

    if (!editing) {
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
      const phone = fields.phone.trim();
      const result =
        staff === null
          ? await createStaff({
              name: fields.name.trim(),
              email: fields.email.trim(),
              ...(phone === '' ? {} : { phone }),
              role: fields.role as StaffRole,
              password: fields.password,
            })
          : await updateStaff(staff.id, {
              name: fields.name.trim(),
              email: fields.email.trim(),
              phone: phone === '' ? null : phone,
              role: fields.role as StaffRole,
            });

      onSaved(result);
    } catch (error) {
      setFormError(staffErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="staff-form-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('staff.title')}</p>
          <h2 id="staff-form-title">{editing ? t('staff.editTitle') : t('staff.newTitle')}</h2>
        </div>
      </div>
      <p className="muted">{editing ? t('staff.editSubtitle') : t('staff.newSubtitle')}</p>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="staff-name">{t('staff.name')}</label>
            <input
              id="staff-name"
              name="name"
              type="text"
              autoComplete="name"
              value={fields.name}
              placeholder={t('staff.namePlaceholder')}
              aria-invalid={fieldErrors.name !== undefined}
              aria-describedby={fieldErrors.name !== undefined ? 'staff-name-error' : undefined}
              onChange={(event) => update('name', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.name !== undefined ? (
              <p className="field__error" id="staff-name-error">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="staff-email">{t('staff.email')}</label>
            <input
              id="staff-email"
              name="email"
              type="email"
              autoComplete="email"
              value={fields.email}
              placeholder={t('staff.emailPlaceholder')}
              aria-invalid={fieldErrors.email !== undefined}
              aria-describedby={fieldErrors.email !== undefined ? 'staff-email-error' : undefined}
              onChange={(event) => update('email', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.email !== undefined ? (
              <p className="field__error" id="staff-email-error">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="staff-phone">{t('staff.phone')}</label>
            <input
              id="staff-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={fields.phone}
              placeholder={t('staff.phonePlaceholder')}
              aria-invalid={fieldErrors.phone !== undefined}
              aria-describedby={fieldErrors.phone !== undefined ? 'staff-phone-error' : undefined}
              onChange={(event) => update('phone', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.phone !== undefined ? (
              <p className="field__error" id="staff-phone-error">
                {fieldErrors.phone}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="staff-role">{t('staff.role')}</label>
            <select
              id="staff-role"
              name="role"
              value={fields.role}
              aria-invalid={fieldErrors.role !== undefined}
              aria-describedby={fieldErrors.role !== undefined ? 'staff-role-error' : undefined}
              onChange={(event) =>
                update('role', event.target.value === '' ? '' : (event.target.value as StaffRole))
              }
              disabled={busy}
            >
              <option value="">{t('staff.rolePlaceholder')}</option>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </select>
            <p className="field__hint">{t('staff.roleHint')}</p>
            {fieldErrors.role !== undefined ? (
              <p className="field__error" id="staff-role-error">
                {fieldErrors.role}
              </p>
            ) : null}
          </div>
        </div>

        {!editing ? (
          <div className="form-grid">
            <PasswordField
              id="staff-password"
              label={t('staff.password')}
              value={fields.password}
              autoComplete="new-password"
              placeholder={t('staff.passwordPlaceholder')}
              hint={t('staff.passwordHint')}
              error={fieldErrors.password}
              onChange={(value) => update('password', value)}
              disabled={busy}
            />
            <PasswordField
              id="staff-confirm-password"
              label={t('staff.confirmPassword')}
              value={fields.confirmPassword}
              autoComplete="new-password"
              placeholder={t('staff.confirmPasswordPlaceholder')}
              error={fieldErrors.confirmPassword}
              onChange={(value) => update('confirmPassword', value)}
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="form-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {t('common.cancel')}
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy
              ? editing
                ? t('staff.saving')
                : t('staff.creating')
              : editing
                ? t('staff.save')
                : t('staff.create')}
          </button>
        </div>
      </form>
    </section>
  );
}
