'use client';

import { useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { createCustomer, updateCustomer } from '@/lib/api-client';
import { isValidPrice } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import type { Customer, CustomerType } from '@/lib/types';

interface CustomerFields {
  name: string;
  phone: string;
  email: string;
  address: string;
  type: CustomerType;
  creditLimit: string;
  paymentTermDays: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof CustomerFields, string>>;

interface CustomerFormProps {
  customer: Customer | null;
  onSaved: (customer: Customer) => void;
  onCancel: () => void;
}

function toFields(customer: Customer | null): CustomerFields {
  return {
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    type: customer?.type ?? 'RETAIL',
    creditLimit: customer?.creditLimit ?? '',
    paymentTermDays:
      customer?.paymentTermDays === null ? '' : String(customer?.paymentTermDays ?? ''),
    notes: customer?.notes ?? '',
  };
}

export function CustomerForm({ customer, onSaved, onCancel }: CustomerFormProps) {
  const { t } = useI18n();
  const editing = customer !== null;
  const [fields, setFields] = useState<CustomerFields>(() => toFields(customer));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof CustomerFields>(field: K, value: CustomerFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const email = fields.email.trim();
    const creditLimit = fields.creditLimit.trim();
    const terms = fields.paymentTermDays.trim();

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

    if (creditLimit !== '' && !isValidPrice(creditLimit)) {
      errors.creditLimit = t('validation.priceAmount');
    }

    if (terms !== '' && (!/^\d{1,3}$/.test(terms) || Number(terms) > 365)) {
      errors.paymentTermDays = t('validation.paymentTerms');
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

    const payload = {
      name: fields.name.trim(),
      phone: fields.phone.trim() === '' ? null : fields.phone.trim(),
      email: fields.email.trim() === '' ? null : fields.email.trim(),
      address: fields.address.trim() === '' ? null : fields.address.trim(),
      type: fields.type,
      creditLimit: fields.creditLimit.trim() === '' ? null : fields.creditLimit.trim(),
      paymentTermDays:
        fields.paymentTermDays.trim() === '' ? null : Number(fields.paymentTermDays.trim()),
      notes: fields.notes.trim() === '' ? null : fields.notes.trim(),
    };

    try {
      const saved =
        customer === null
          ? await createCustomer(payload)
          : await updateCustomer(customer.id, payload);
      onSaved(saved);
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel customer-form" aria-labelledby="customer-form-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2 id="customer-form-title">
            {editing ? t('customers.editTitle') : t('customers.newTitle')}
          </h2>
        </div>
        <span className="pill">{editing ? t('common.edit') : t('customers.add')}</span>
      </div>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="customer-name">{t('customers.name')}</label>
            <input
              id="customer-name"
              value={fields.name}
              maxLength={160}
              placeholder={t('customers.namePlaceholder')}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(event) => update('name', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.name !== undefined ? (
              <p className="field__error">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="customer-type">{t('customers.customerType')}</label>
            <select
              id="customer-type"
              value={fields.type}
              onChange={(event) => update('type', event.target.value as CustomerType)}
              disabled={busy}
            >
              <option value="RETAIL">{t('customers.types.RETAIL')}</option>
              <option value="WHOLESALE">{t('customers.types.WHOLESALE')}</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="customer-phone">{t('customers.phone')}</label>
            <input
              id="customer-phone"
              value={fields.phone}
              maxLength={40}
              placeholder={t('customers.phonePlaceholder')}
              onChange={(event) => update('phone', event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="customer-email">{t('customers.email')}</label>
            <input
              id="customer-email"
              value={fields.email}
              maxLength={160}
              placeholder={t('customers.emailPlaceholder')}
              aria-invalid={fieldErrors.email !== undefined}
              onChange={(event) => update('email', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.email !== undefined ? (
              <p className="field__error">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="customer-credit-limit">{t('customers.creditLimit')}</label>
            <input
              id="customer-credit-limit"
              value={fields.creditLimit}
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={fieldErrors.creditLimit !== undefined}
              onChange={(event) => update('creditLimit', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.creditLimit !== undefined ? (
              <p className="field__error">{fieldErrors.creditLimit}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="customer-payment-terms">{t('customers.paymentTerms')}</label>
            <input
              id="customer-payment-terms"
              value={fields.paymentTermDays}
              inputMode="numeric"
              placeholder="30"
              aria-invalid={fieldErrors.paymentTermDays !== undefined}
              onChange={(event) => update('paymentTermDays', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.paymentTermDays !== undefined ? (
              <p className="field__error">{fieldErrors.paymentTermDays}</p>
            ) : null}
          </div>

          <div className="field field--wide">
            <label htmlFor="customer-address">{t('customers.address')}</label>
            <input
              id="customer-address"
              value={fields.address}
              maxLength={500}
              placeholder={t('customers.addressPlaceholder')}
              onChange={(event) => update('address', event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field field--wide">
            <label htmlFor="customer-notes">{t('customers.notes')}</label>
            <textarea
              id="customer-notes"
              rows={3}
              value={fields.notes}
              maxLength={1000}
              placeholder={t('customers.notesPlaceholder')}
              onChange={(event) => update('notes', event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t('customers.saving') : editing ? t('customers.save') : t('customers.create')}
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}
