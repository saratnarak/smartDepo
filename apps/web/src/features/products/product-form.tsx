'use client';

import { useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { ImageUpload } from '@/components/image-upload';
import { createProduct, updateProduct } from '@/lib/api-client';
import { isValidQuantity } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import type { Category, Product } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import { PriceEditor } from './price-editor';
import { UnitEditor } from './unit-editor';
import {
  emptyUnitValue,
  toCreateUnitPayload,
  validateUnitValue,
  type UnitDraftErrors,
  type UnitDraftValue,
} from './unit-drafts';

interface ProductFields {
  name: string;
  sku: string;
  description: string;
  categoryId: string;
  reorderLevel: string;
  trackBatches: boolean;
}

type FieldErrors = Partial<Record<keyof ProductFields, string>>;

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
  currency: string;
  onSaved: (product: Product) => void;
  onCancel: () => void;
  onRefresh: () => Promise<Product | null>;
  onNotify: (message: string) => void;
}

function toFields(product: Product | null): ProductFields {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    description: product?.description ?? '',
    categoryId: product?.category?.id ?? '',
    reorderLevel: product?.reorderLevel ?? '0',
    trackBatches: product?.trackBatches ?? false,
  };
}

export function ProductForm({
  product,
  categories,
  currency,
  onSaved,
  onCancel,
  onRefresh,
  onNotify,
}: ProductFormProps) {
  const { t } = useI18n();
  const role = useSessionStore((state) => state.role);
  const editing = product !== null;
  const [fields, setFields] = useState<ProductFields>(() => toFields(product));
  const [unitValue, setUnitValue] = useState<UnitDraftValue>(() => emptyUnitValue());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [unitErrors, setUnitErrors] = useState<UnitDraftErrors | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEditPrices = role === 'OWNER';

  const update = <K extends keyof ProductFields>(field: K, value: ProductFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const sku = fields.sku.trim().toUpperCase();
    const description = fields.description.trim();
    const reorderLevel = fields.reorderLevel.trim();

    if (name === '') {
      errors.name = t('validation.required');
    } else if (name.length < 2) {
      errors.name = t('validation.minLength', { min: 2 });
    } else if (name.length > 160) {
      errors.name = t('validation.maxLength', { max: 160 });
    }

    if (sku === '') {
      errors.sku = t('validation.required');
    } else if (!/^[A-Z0-9][A-Z0-9._-]{0,63}$/.test(sku)) {
      errors.sku = t('validation.sku');
    }

    if (description.length > 1000) {
      errors.description = t('validation.maxLength', { max: 1000 });
    }

    if (reorderLevel !== '' && !isValidQuantity(reorderLevel)) {
      errors.reorderLevel = t('validation.quantity');
    }

    setFieldErrors(errors);

    let unitsValid = true;

    if (!editing) {
      const checked = validateUnitValue(unitValue, t);
      setUnitErrors(checked);
      unitsValid = !checked.hasErrors;
    }

    return Object.keys(errors).length === 0 && unitsValid;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const sku = fields.sku.trim().toUpperCase();
      const description = fields.description.trim();
      const reorderLevel = fields.reorderLevel.trim() === '' ? '0' : fields.reorderLevel.trim();
      const categoryId = fields.categoryId === '' ? null : fields.categoryId;

      const saved =
        product === null
          ? await createProduct({
              sku,
              name: fields.name.trim(),
              description: description === '' ? null : description,
              categoryId,
              reorderLevel,
              trackBatches: fields.trackBatches,
              ...toCreateUnitPayload(unitValue),
            })
          : await updateProduct(product.id, {
              sku,
              name: fields.name.trim(),
              description: description === '' ? null : description,
              categoryId,
              reorderLevel,
              trackBatches: fields.trackBatches,
            });

      onSaved(saved);
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel product-form" aria-labelledby="product-form-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2 id="product-form-title">
            {editing ? t('products.editTitle') : t('products.newTitle')}
          </h2>
        </div>
        <span className="pill">{editing ? t('common.edit') : t('products.add')}</span>
      </div>

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="product-name">{t('products.name')}</label>
            <input
              id="product-name"
              value={fields.name}
              maxLength={160}
              placeholder={t('products.namePlaceholder')}
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(event) => update('name', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.name !== undefined ? (
              <p className="field__error">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="product-sku">{t('products.sku')}</label>
            <input
              id="product-sku"
              value={fields.sku}
              maxLength={64}
              placeholder={t('products.skuPlaceholder')}
              aria-invalid={fieldErrors.sku !== undefined}
              onChange={(event) => update('sku', event.target.value.toUpperCase())}
              disabled={busy}
            />
            {fieldErrors.sku !== undefined ? (
              <p className="field__error">{fieldErrors.sku}</p>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor="product-description">{t('products.description')}</label>
          <textarea
            id="product-description"
            value={fields.description}
            rows={2}
            maxLength={1000}
            placeholder={t('products.descriptionPlaceholder')}
            aria-invalid={fieldErrors.description !== undefined}
            onChange={(event) => update('description', event.target.value)}
            disabled={busy}
          />
          {fieldErrors.description !== undefined ? (
            <p className="field__error">{fieldErrors.description}</p>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="product-category">{t('products.category')}</label>
            <select
              id="product-category"
              value={fields.categoryId}
              onChange={(event) => update('categoryId', event.target.value)}
              disabled={busy}
            >
              <option value="">{t('products.categoryPlaceholder')}</option>
              {categories
                .filter((category) => category.isActive)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="product-reorder">{t('products.reorderLevel')}</label>
            <input
              id="product-reorder"
              value={fields.reorderLevel}
              inputMode="decimal"
              placeholder={t('products.reorderLevelPlaceholder')}
              aria-invalid={fieldErrors.reorderLevel !== undefined}
              onChange={(event) => update('reorderLevel', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.reorderLevel !== undefined ? (
              <p className="field__error">{fieldErrors.reorderLevel}</p>
            ) : null}
          </div>
        </div>

        <label className="checkbox-field" htmlFor="product-track-batches">
          <input
            id="product-track-batches"
            type="checkbox"
            checked={fields.trackBatches}
            onChange={(event) => update('trackBatches', event.target.checked)}
            disabled={busy}
          />
          <span>
            <strong>{t('products.trackBatches')}</strong>
            <small className="muted">{t('products.trackBatchesHint')}</small>
          </span>
        </label>

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
                ? t('products.saving')
                : t('products.creating')
              : editing
                ? t('products.save')
                : t('products.create')}
          </button>
        </div>
      </form>

      {editing ? (
        <section className="product-form__section" aria-labelledby="product-image-title">
          <h3 id="product-image-title" className="panel__subheading">
            {t('products.imageTitle')}
          </h3>
          <ImageUpload
            kind="product"
            productId={product.id}
            hasStoredImage
            label={t('products.imageTitle')}
            onUploaded={() => onNotify(t('products.updated'))}
          />
        </section>
      ) : (
        <p className="alert alert--info">{t('products.imageCreateHint')}</p>
      )}

      <UnitEditor
        mode={editing ? 'edit' : 'create'}
        product={product}
        value={unitValue}
        onChange={(next) => {
          setUnitValue(next);
          setUnitErrors(null);
        }}
        errors={unitErrors ?? undefined}
        onChanged={async () => {
          await onRefresh();
        }}
        onNotify={onNotify}
      />

      {editing ? (
        <PriceEditor
          product={product}
          currency={currency}
          canEdit={canEditPrices && product.isActive}
          onChanged={async () => {
            await onRefresh();
          }}
          onNotify={onNotify}
        />
      ) : null}
    </section>
  );
}
