'use client';

import { useEffect, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { setProductPrice } from '@/lib/api-client';
import { formatUnitPreview, isValidPrice } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { PRICE_TYPES, type PriceType, type Product } from '@/lib/types';
import { PriceHistoryTable } from './price-history-table';

interface PriceEditorProps {
  product: Product;
  currency: string;
  canEdit: boolean;
  onChanged?: () => Promise<void> | void;
  onNotify?: (message: string) => void;
}

function priceKey(unitId: string, type: PriceType): string {
  return `${unitId}:${type}`;
}

export function PriceEditor({ product, currency, canEdit, onChanged, onNotify }: PriceEditorProps) {
  const { t, locale } = useI18n();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });

  useEffect(() => {
    const next: Record<string, string> = {};

    for (const unit of product.units) {
      for (const type of PRICE_TYPES) {
        const price = unit.prices.find((entry) => entry.type === type);
        next[priceKey(unit.id, type)] = price?.amount ?? '';
      }
    }

    setAmounts(next);
  }, [product.id, product.units]);

  const save = async (unitId: string, type: PriceType) => {
    const key = priceKey(unitId, type);
    const amount = (amounts[key] ?? '').trim();

    if (!isValidPrice(amount)) {
      setErrors((current) => ({ ...current, [key]: t('validation.priceAmount') }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setBusyKey(key);

    try {
      const updated = await setProductPrice(product.id, unitId, type, amount);
      setAmounts((current) => ({ ...current, [key]: updated.amount }));
      onNotify?.(t('products.priceSaved'));
      await onChanged?.();
    } catch (error) {
      setErrors((current) => ({ ...current, [key]: getErrorMessage(t, error) }));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="panel" aria-labelledby="price-editor-title">
      <div className="panel__heading">
        <div>
          <h3 id="price-editor-title" className="panel__subheading">
            {t('products.priceTitle')}
          </h3>
          <p className="muted">{t('products.priceSubtitle')}</p>
        </div>
      </div>

      {!canEdit ? <p className="alert alert--info">{t('products.roleReadOnly')}</p> : null}

      <div className="price-grid">
        {product.units
          .filter((unit) => unit.isActive)
          .map((unit) => (
            <article className="price-unit" key={unit.id}>
              <header className="price-unit__header">
                <h4>
                  {unit.isBaseUnit
                    ? `1 ${unit.name}`
                    : formatUnitPreview(
                        unit.name,
                        unit.conversionFactor,
                        product.baseUnit.name,
                        locale === 'en',
                      )}
                </h4>
              </header>

              {PRICE_TYPES.map((type) => {
                const key = priceKey(unit.id, type);
                const price = unit.prices.find((entry) => entry.type === type);
                const label = t('products.priceForUnit', {
                  type: t(`prices.${type}`),
                  unit: unit.name,
                });

                return (
                  <div className="price-row" key={key}>
                    <label htmlFor={`price-${key}`} className="price-row__label">
                      {label}
                    </label>
                    {canEdit ? (
                      <div className="price-row__controls">
                        <input
                          id={`price-${key}`}
                          value={amounts[key] ?? ''}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-invalid={errors[key] !== undefined}
                          onChange={(event) => {
                            setAmounts((current) => ({ ...current, [key]: event.target.value }));
                            setErrors((current) => {
                              const next = { ...current };
                              delete next[key];
                              return next;
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => void save(unit.id, type)}
                          disabled={busyKey !== null}
                        >
                          {busyKey === key ? t('products.priceSaving') : t('products.priceSave')}
                        </button>
                      </div>
                    ) : (
                      <span className="price-row__value money">
                        {price === undefined ? t('products.priceNotSet') : money(price.amount)}
                      </span>
                    )}
                    {errors[key] !== undefined ? (
                      <p className="field__error">{errors[key]}</p>
                    ) : null}
                  </div>
                );
              })}
            </article>
          ))}
      </div>

      <PriceHistoryTable product={product} currency={currency} />
    </section>
  );
}
