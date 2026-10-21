'use client';

import { useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { createSupplier, updateSupplier } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import type { Supplier } from '@/lib/types';

interface SupplierFields {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof SupplierFields, string>>;

interface SupplierFormProps {
  supplier: Supplier | null;
  onSaved: (supplier: Supplier) => void;
  onCancel: () => void;
}

function toFields(supplier: Supplier | null): SupplierFields {
  return {
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  };
}

export function SupplierForm({ supplier, onSaved, onCancel }: SupplierFormProps) {
  const { t } = useI18n();
  const editing = supplier !== null;
  const [fields, setFields] = useState<SupplierFields>(() => toFields(supplier));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof SupplierFields>(field: K, value: SupplierFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const email = fields.email.trim();

    if (name === '') {
      errors.name = t('validation.required');
    } else if (name.length < 2) {
      errors.name = t('validation.minLength', { min: 2 });
    } else if (name.length > 160) {
      errors.name = t('validation.maxLength', { max: 160 });
    }

    if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('validation.email');
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
      const payload = {
        name: fields.name.trim(),
        contactName: fields.contactName.trim() === '' ? null : fields.contactName.trim(),
        phone: fields.phone.trim() === '' ? null : fields.phone.trim(),
        email: fields.email.trim() === '' ? null : fields.email.trim(),
        address: fields.address.trim() === '' ? null : fields.address.trim(),
        notes: fields.notes.trim() === '' ? null : fields.notes.trim(),
      };

      const saved =
        supplier === null
          ? await createSupplier(payload)
          : await updateSupplier(supplier.id, payload);

      onSaved(saved);
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel supplier-form" aria-labelledby="supplier-form-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2 id="supplier-form-title">
            {editing ? t('suppliers.editTitle') : t('suppliers.newTitle')}
          </h2>
        </div>
        <span className="pill">{editing ? t('common.edit') : t('suppliers.add')}</span>
      </div>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="supplier-name">{t('suppliers.name')}</label>
            <input
              id="supplier-name"
              value={fields.name}
              maxLength={160}
              placeholder={t('suppliers.namePlaceholder')}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(event) => update('name', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.name !== undefined ? (
              <p className="field__error">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="supplier-contact">{t('suppliers.contactName')}</label>
            <input
              id="supplier-contact"
              value={fields.contactName}
              maxLength={160}
              placeholder={t('suppliers.contactPlaceholder')}
              onChange={(event) => update('contactName', event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="supplier-phone">{t('suppliers.phone')}</label>
            <input
              id="supplier-phone"
              value={fields.phone}
              maxLength={40}
              placeholder={t('suppliers.phonePlaceholder')}
              onChange={(event) => update('phone', event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="supplier-email">{t('suppliers.email')}</label>
            <input
              id="supplier-email"
              value={fields.email}
              maxLength={160}
              placeholder={t('suppliers.emailPlaceholder')}
              aria-invalid={fieldErrors.email !== undefined}
              onChange={(event) => update('email', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.email !== undefined ? (
              <p className="field__error">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="field field--wide">
            <label htmlFor="supplier-address">{t('suppliers.address')}</label>
            <input
              id="supplier-address"
              value={fields.address}
              maxLength={500}
              placeholder={t('suppliers.addressPlaceholder')}
              onChange={(event) => update('address', event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field field--wide">
            <label htmlFor="supplier-notes">{t('suppliers.notes')}</label>
            <textarea
              id="supplier-notes"
              rows={3}
              value={fields.notes}
              maxLength={1000}
              placeholder={t('suppliers.notesPlaceholder')}
              onChange={(event) => update('notes', event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t('suppliers.saving') : editing ? t('suppliers.save') : t('suppliers.create')}
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}
