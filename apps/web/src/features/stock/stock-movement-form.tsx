'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { createStockAdjustment, createStockDamage } from '@/lib/api-client';
import { isValidQuantity, isValidSignedQuantity } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { StockItem, StockMovementResult } from '@/lib/types';
import { insufficientStockDetail } from './stock-errors';

type MovementMode = 'adjustment' | 'damage';

interface StockMovementFormProps {
  stockItems: StockItem[];
  onRecorded: () => void;
}

interface FormFields {
  productId: string;
  unitId: string;
  quantity: string;
  reason: string;
  batchId: string;
}

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const EMPTY_FIELDS: FormFields = {
  productId: '',
  unitId: '',
  quantity: '',
  reason: '',
  batchId: '',
};

export function StockMovementForm({ stockItems, onRecorded }: StockMovementFormProps) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<MovementMode>('adjustment');
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stockDetail, setStockDetail] = useState<string | null>(null);
  const [result, setResult] = useState<StockMovementResult | null>(null);
  const [busy, setBusy] = useState(false);

  const product = useMemo(
    () => stockItems.find((item) => item.id === fields.productId) ?? null,
    [stockItems, fields.productId],
  );

  const units = useMemo(
    () => (product === null ? [] : product.units.filter((unit) => unit.isActive)),
    [product],
  );

  const update = <K extends keyof FormFields>(field: K, value: FormFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const selectProduct = (productId: string) => {
    const selected = stockItems.find((item) => item.id === productId) ?? null;
    const firstUnit = selected?.units.find((unit) => unit.isActive);

    setFields((current) => ({
      ...current,
      productId,
      unitId: firstUnit?.id ?? '',
      batchId: '',
    }));
    setFieldErrors((current) => ({ ...current, productId: undefined, unitId: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const quantity = fields.quantity.trim();
    const reason = fields.reason.trim();

    if (fields.productId === '') {
      errors.productId = t('validation.required');
    }

    if (fields.unitId === '') {
      errors.unitId = t('validation.required');
    }

    if (quantity === '') {
      errors.quantity = t('validation.required');
    } else if (mode === 'adjustment') {
      if (!isValidSignedQuantity(quantity)) {
        errors.quantity = t('validation.quantity');
      } else if (quantity === '0' || quantity === '-0' || quantity === '0.000') {
        errors.quantity = t('validation.quantityNotZero');
      }
    } else if (!isValidQuantity(quantity)) {
      errors.quantity = t('validation.quantity');
    } else if (quantity === '0' || quantity === '0.000') {
      errors.quantity = t('validation.quantityNotZero');
    }

    if (reason === '') {
      errors.reason = t('validation.required');
    } else if (reason.length < 3 || reason.length > 500) {
      errors.reason = t('validation.reasonLength');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setStockDetail(null);
    setResult(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const payload = {
        productId: fields.productId,
        unitId: fields.unitId,
        quantity: fields.quantity.trim(),
        reason: fields.reason.trim(),
        batchId: fields.batchId === '' ? null : fields.batchId,
      };

      const recorded =
        mode === 'adjustment'
          ? await createStockAdjustment(payload)
          : await createStockDamage(payload);

      setResult(recorded);
      setFields({ ...EMPTY_FIELDS });
      setFieldErrors({});
      onRecorded();
    } catch (error) {
      const detail = insufficientStockDetail(error);
      setStockDetail(detail);
      setFormError(detail === null ? getErrorMessage(t, error) : t('stock.insufficientStock'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="stock-movement-form-title">
      <div className="panel__heading">
        <div>
          <h3 id="stock-movement-form-title" className="panel__subheading">
            {t('stock.formTitle')}
          </h3>
          <p className="muted">{t('stock.formSubtitle')}</p>
        </div>
      </div>

      <div className="filter-tabs" role="group" aria-label={t('stock.formModeLabel')}>
        <button
          type="button"
          className={`filter-tab${mode === 'adjustment' ? ' filter-tab--active' : ''}`}
          aria-pressed={mode === 'adjustment'}
          onClick={() => setMode('adjustment')}
        >
          {t('stock.modeAdjustment')}
        </button>
        <button
          type="button"
          className={`filter-tab${mode === 'damage' ? ' filter-tab--active' : ''}`}
          aria-pressed={mode === 'damage'}
          onClick={() => setMode('damage')}
        >
          {t('stock.modeDamage')}
        </button>
      </div>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
          {stockDetail === null ? null : <span className="muted"> {stockDetail}</span>}
        </p>
      ) : null}

      {result !== null ? (
        <p className="alert alert--success" role="status">
          {t('stock.recorded', {
            quantity: result.quantityReadable,
            stock: result.stockAfterReadable,
          })}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="stock-movement-product">{t('stock.fieldProduct')}</label>
            <select
              id="stock-movement-product"
              value={fields.productId}
              aria-invalid={fieldErrors.productId !== undefined}
              onChange={(event) => selectProduct(event.target.value)}
              disabled={busy}
            >
              <option value="">{t('stock.chooseProduct')}</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
            {fieldErrors.productId !== undefined ? (
              <p className="field__error">{fieldErrors.productId}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="stock-movement-unit">{t('stock.fieldUnit')}</label>
            <select
              id="stock-movement-unit"
              value={fields.unitId}
              aria-invalid={fieldErrors.unitId !== undefined}
              onChange={(event) => update('unitId', event.target.value)}
              disabled={busy || product === null}
            >
              <option value="">{t('stock.chooseUnit')}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {fieldErrors.unitId !== undefined ? (
              <p className="field__error">{fieldErrors.unitId}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="stock-movement-quantity">{t('stock.fieldQuantity')}</label>
            <input
              id="stock-movement-quantity"
              value={fields.quantity}
              inputMode="decimal"
              placeholder={mode === 'adjustment' ? '-2' : '2'}
              aria-invalid={fieldErrors.quantity !== undefined}
              onChange={(event) => update('quantity', event.target.value)}
              disabled={busy}
            />
            <p className="field__hint">
              {mode === 'adjustment'
                ? t('stock.quantityHintAdjustment')
                : t('stock.quantityHintDamage')}
            </p>
            {fieldErrors.quantity !== undefined ? (
              <p className="field__error">{fieldErrors.quantity}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="stock-movement-batch">{t('stock.fieldBatch')}</label>
            <select
              id="stock-movement-batch"
              value={fields.batchId}
              onChange={(event) => update('batchId', event.target.value)}
              disabled={busy || product === null || !product.trackBatches}
            >
              <option value="">{t('stock.noBatch')}</option>
              {product?.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batchNumber}
                  {batch.expiryDate === null
                    ? ''
                    : ` · ${t('stock.batchExpiry', { date: formatDate(batch.expiryDate, locale) })}`}
                </option>
              ))}
            </select>
            <p className="field__hint">
              {product !== null && product.trackBatches
                ? t('stock.batchHintTracked')
                : t('stock.batchHintUntracked')}
            </p>
          </div>

          <div className="field field--wide">
            <label htmlFor="stock-movement-reason">{t('stock.fieldReason')}</label>
            <input
              id="stock-movement-reason"
              value={fields.reason}
              maxLength={500}
              placeholder={t('stock.fieldReasonPlaceholder')}
              aria-invalid={fieldErrors.reason !== undefined}
              onChange={(event) => update('reason', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.reason !== undefined ? (
              <p className="field__error">{fieldErrors.reason}</p>
            ) : null}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy
              ? t('stock.submitting')
              : mode === 'adjustment'
                ? t('stock.submitAdjustment')
                : t('stock.submitDamage')}
          </button>
        </div>
      </form>
    </section>
  );
}
