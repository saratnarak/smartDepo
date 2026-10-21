'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { createPurchase, updatePurchase, type PurchaseLineInput } from '@/lib/api-client';
import { toBaseUnitCost, toMoneyString } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import type { Product, Purchase, Supplier } from '@/lib/types';
import {
  draftLineTotal,
  draftTotal,
  emptyLineDraft,
  hasErrors,
  validateLineDraft,
  type LineErrors,
  type PurchaseLineDraft,
} from './purchase-drafts';

interface PurchaseFormProps {
  purchase: Purchase | null;
  suppliers: Supplier[];
  products: Product[];
  onSaved: (purchase: Purchase) => void;
  onCancel: () => void;
}

function toDrafts(purchase: Purchase | null): PurchaseLineDraft[] {
  if (purchase === null) {
    return [emptyLineDraft()];
  }

  return purchase.items.map((item) => {
    return {
      productId: item.productId,
      unitId: item.productUnitId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      batchNumber: item.batchNumber ?? '',
      expiryDate: item.expiryDate === null ? '' : item.expiryDate.slice(0, 10),
    };
  });
}

export function PurchaseForm({
  purchase,
  suppliers,
  products,
  onSaved,
  onCancel,
}: PurchaseFormProps) {
  const { t } = useI18n();
  const editing = purchase !== null;
  const [supplierId, setSupplierId] = useState(purchase?.supplier.id ?? '');
  const [notes, setNotes] = useState(purchase?.notes ?? '');
  const [drafts, setDrafts] = useState<PurchaseLineDraft[]>(() => toDrafts(purchase));
  const [lineErrors, setLineErrors] = useState<Record<number, LineErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => draftTotal(drafts), [drafts]);

  const productFor = (productId: string): Product | null =>
    products.find((product) => product.id === productId) ?? null;

  const updateDraft = <K extends keyof PurchaseLineDraft>(
    index: number,
    field: K,
    value: PurchaseLineDraft[K],
  ) => {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, [field]: value } : draft)),
    );
    setLineErrors((current) => {
      const next = { ...current };
      const errors = next[index];

      if (errors !== undefined) {
        const rest = { ...errors };
        delete rest[field];
        next[index] = rest;
      }

      return next;
    });
  };

  const selectProduct = (index: number, productId: string) => {
    const product = productFor(productId);
    const firstUnit = product?.units.find((unit) => unit.isActive);

    setDrafts((current) =>
      current.map((draft, position) =>
        position === index
          ? {
              ...draft,
              productId,
              unitId: firstUnit?.id ?? '',
              batchNumber: product?.trackBatches === true ? draft.batchNumber : '',
              expiryDate: product?.trackBatches === true ? draft.expiryDate : '',
            }
          : draft,
      ),
    );
  };

  const addLine = () => {
    setDrafts((current) => [...current, emptyLineDraft()]);
  };

  const removeLine = (index: number) => {
    setDrafts((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
    setLineErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const validate = (): boolean => {
    let valid = supplierId !== '';

    if (!valid) {
      setFormError(t('validation.required'));
    }

    const errors: Record<number, LineErrors> = {};

    drafts.forEach((draft, index) => {
      const product = productFor(draft.productId);
      const checked = validateLineDraft(
        draft,
        {
          product,
          units: product?.units.filter((unit) => unit.isActive) ?? [],
          trackBatches: product?.trackBatches === true,
        },
        t,
      );

      if (hasErrors(checked)) {
        errors[index] = checked;
        valid = false;
      }
    });

    setLineErrors(errors);
    return valid;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const lines: PurchaseLineInput[] = drafts.map((draft) => {
        const product = productFor(draft.productId);
        const trackBatches = product?.trackBatches === true;

        return {
          productId: draft.productId,
          unitId: draft.unitId,
          quantity: draft.quantity.trim(),
          unitCost: draft.unitCost.trim(),
          batchNumber: trackBatches ? draft.batchNumber.trim() : null,
          expiryDate: trackBatches ? draft.expiryDate.trim() : null,
        };
      });

      const saved =
        purchase === null
          ? await createPurchase({
              supplierId,
              notes: notes.trim() === '' ? null : notes.trim(),
              lines,
            })
          : await updatePurchase(purchase.id, {
              supplierId,
              notes: notes.trim() === '' ? null : notes.trim(),
              lines,
            });

      onSaved(saved);
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel purchase-form" aria-labelledby="purchase-form-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2 id="purchase-form-title">
            {editing ? t('purchases.editTitle') : t('purchases.newTitle')}
          </h2>
          <p className="muted">{t('purchases.formSubtitle')}</p>
        </div>
        <span className="pill">{editing ? t('common.edit') : t('purchases.add')}</span>
      </div>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="purchase-supplier">{t('purchases.supplier')}</label>
            <select
              id="purchase-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              disabled={busy}
            >
              <option value="">{t('purchases.chooseSupplier')}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="purchase-notes">{t('purchases.notes')}</label>
            <input
              id="purchase-notes"
              value={notes}
              maxLength={1000}
              placeholder={t('purchases.notesPlaceholder')}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <h4 className="panel__subheading">{t('purchases.linesTitle')}</h4>

        {drafts.map((draft, index) => {
          const product = productFor(draft.productId);
          const units = product?.units.filter((unit) => unit.isActive) ?? [];
          const trackBatches = product?.trackBatches === true;
          const lineTotal = draftLineTotal(draft);
          const lineTotalText = lineTotal === null ? null : toMoneyString(lineTotal);
          const unit = units.find((candidate) => candidate.id === draft.unitId) ?? null;
          const baseCost =
            unit === null || unit === undefined
              ? null
              : toBaseUnitCost(draft.unitCost.trim(), unit.conversionFactor);
          const errors = lineErrors[index];

          return (
            <div className="purchase-line" key={index}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor={`purchase-line-product-${index}`}>
                    {t('purchases.lineProduct')}
                  </label>
                  <select
                    id={`purchase-line-product-${index}`}
                    value={draft.productId}
                    aria-invalid={errors?.productId !== undefined}
                    onChange={(event) => selectProduct(index, event.target.value)}
                    disabled={busy}
                  >
                    <option value="">{t('purchases.chooseProduct')}</option>
                    {products.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name} ({entry.sku})
                      </option>
                    ))}
                  </select>
                  {errors?.productId !== undefined ? (
                    <p className="field__error">{errors.productId}</p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor={`purchase-line-unit-${index}`}>{t('purchases.lineUnit')}</label>
                  <select
                    id={`purchase-line-unit-${index}`}
                    value={draft.unitId}
                    aria-invalid={errors?.unitId !== undefined}
                    onChange={(event) => updateDraft(index, 'unitId', event.target.value)}
                    disabled={busy || product === null}
                  >
                    <option value="">{t('purchases.chooseUnit')}</option>
                    {units.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  {errors?.unitId !== undefined ? (
                    <p className="field__error">{errors.unitId}</p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor={`purchase-line-quantity-${index}`}>
                    {t('purchases.lineQuantity')}
                  </label>
                  <input
                    id={`purchase-line-quantity-${index}`}
                    value={draft.quantity}
                    inputMode="decimal"
                    placeholder="12"
                    aria-invalid={errors?.quantity !== undefined}
                    onChange={(event) => updateDraft(index, 'quantity', event.target.value)}
                    disabled={busy}
                  />
                  {errors?.quantity !== undefined ? (
                    <p className="field__error">{errors.quantity}</p>
                  ) : null}
                </div>

                <div className="field">
                  <label htmlFor={`purchase-line-cost-${index}`}>
                    {t('purchases.lineUnitCost')}
                  </label>
                  <input
                    id={`purchase-line-cost-${index}`}
                    value={draft.unitCost}
                    inputMode="decimal"
                    placeholder="24.00"
                    aria-invalid={errors?.unitCost !== undefined}
                    onChange={(event) => updateDraft(index, 'unitCost', event.target.value)}
                    disabled={busy}
                  />
                  {errors?.unitCost !== undefined ? (
                    <p className="field__error">{errors.unitCost}</p>
                  ) : null}
                  {baseCost !== null ? (
                    <p className="field__hint">{t('purchases.baseUnitCost', { cost: baseCost })}</p>
                  ) : null}
                </div>

                {trackBatches ? (
                  <>
                    <div className="field">
                      <label htmlFor={`purchase-line-batch-${index}`}>
                        {t('purchases.lineBatchNumber')}
                      </label>
                      <input
                        id={`purchase-line-batch-${index}`}
                        value={draft.batchNumber}
                        maxLength={80}
                        placeholder="LOT-2026-01"
                        aria-invalid={errors?.batchNumber !== undefined}
                        onChange={(event) => updateDraft(index, 'batchNumber', event.target.value)}
                        disabled={busy}
                      />
                      {errors?.batchNumber !== undefined ? (
                        <p className="field__error">{errors.batchNumber}</p>
                      ) : null}
                    </div>

                    <div className="field">
                      <label htmlFor={`purchase-line-expiry-${index}`}>
                        {t('purchases.lineExpiry')}
                      </label>
                      <input
                        id={`purchase-line-expiry-${index}`}
                        type="date"
                        value={draft.expiryDate}
                        aria-invalid={errors?.expiryDate !== undefined}
                        onChange={(event) => updateDraft(index, 'expiryDate', event.target.value)}
                        disabled={busy}
                      />
                      {errors?.expiryDate !== undefined ? (
                        <p className="field__error">{errors.expiryDate}</p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="field">
                  <span className="field__label">{t('purchases.lineTotal')}</span>
                  <p className="money purchase-line__total">
                    {lineTotalText === null ? '—' : lineTotalText}
                  </p>
                </div>
              </div>

              <div className="row-actions">
                <button
                  type="button"
                  className="button button--small button--danger-ghost"
                  onClick={() => removeLine(index)}
                  disabled={busy || drafts.length === 1}
                >
                  {t('purchases.removeLine')}
                </button>
              </div>
            </div>
          );
        })}

        <div className="row-actions">
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={addLine}
            disabled={busy}
          >
            {t('purchases.addLine')}
          </button>
        </div>

        <div className="detail-list">
          <div className="detail-list__row">
            <dt>{t('purchases.totalAmount')}</dt>
            <dd className="money">{total === null ? '—' : (toMoneyString(total) ?? total)}</dd>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t('purchases.saving') : editing ? t('purchases.save') : t('purchases.create')}
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </section>
  );
}
