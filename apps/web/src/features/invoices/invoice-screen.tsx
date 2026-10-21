'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import {
  createInvoice,
  getDepotSettings,
  listCustomers,
  listStock,
  type CreateInvoiceInput,
} from '@/lib/api-client';
import { isValidPrice, isValidQuantity } from '@/lib/decimal';
import { formatMoney } from '@/lib/format';
import type {
  Customer,
  DiscountType,
  Invoice,
  PaymentMethod,
  ProductUnit,
  StockItem,
} from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import {
  compareDecimals,
  draftTotals,
  keyForAttempt,
  lineBaseQuantity,
  lineTotal,
  newIdempotencyKey,
  usableBatchQuantity,
  type InvoiceLineDraft,
} from './invoice-draft';
import { translateInvoiceError } from './invoice-error';

interface SearchRow {
  item: StockItem;
  unit: ProductUnit;
  price: string | null;
}

interface InvoiceScreenProps {
  onSaved: (invoice: Invoice, currency: string) => void;
  onCancel: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'OTHER'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceScreen({ onSaved, onCancel }: InvoiceScreenProps) {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canOverridePrice = role === 'OWNER';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [currency, setCurrency] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StockItem[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string | null } | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listCustomers({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
      getDepotSettings(),
    ])
      .then(([customerPage, settings]) => {
        if (!active) {
          return;
        }

        setCustomers(customerPage.data);
        setCurrency(settings.currency);

        const walkIn = customerPage.data.find((customer) => customer.isWalkIn);

        if (walkIn !== undefined) {
          setCustomerId(walkIn.id);
        } else if (customerPage.data.length > 0) {
          setCustomerId(customerPage.data[0].id);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      void listStock({ search, pageSize: 50, sort: 'name', order: 'asc' })
        .then((page) => {
          if (active) {
            setResults(page.data);
            setResultIndex(0);
          }
        })
        .catch(() => undefined);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const customer = useMemo(
    () => customers.find((entry) => entry.id === customerId) ?? null,
    [customers, customerId],
  );

  const priceType = customer?.type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL';

  const rows = useMemo<SearchRow[]>(
    () =>
      results.flatMap((item) =>
        item.units
          .filter((unit) => unit.isActive)
          .map((unit) => ({
            item,
            unit,
            price: unit.prices.find((price) => price.type === priceType)?.amount ?? null,
          })),
      ),
    [results, priceType],
  );

  const visibleCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();

    if (needle === '') {
      return customers;
    }

    return customers.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        (entry.phone ?? '').toLowerCase().includes(needle),
    );
  }, [customers, customerSearch]);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, StockItem>();

    for (const item of results) {
      map.set(item.id, item);
    }

    return map;
  }, [results]);

  const totals = useMemo(
    () => draftTotals(lines, discountType, discountValue),
    [lines, discountType, discountValue],
  );

  const draftSignature = useMemo(
    () => JSON.stringify({ customerId, lines, discountType, discountValue, payNow, paymentAmount }),
    [customerId, lines, discountType, discountValue, payNow, paymentAmount],
  );
  const lastSignature = useRef(draftSignature);

  useEffect(() => {
    if (lastSignature.current === draftSignature) {
      return;
    }

    lastSignature.current = draftSignature;

    if (hasSubmitted) {
      setHasSubmitted(false);
      setIdempotencyKey(newIdempotencyKey());
    }
  }, [draftSignature, hasSubmitted]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  const unitMoney = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });

  const addRow = useCallback((row: SearchRow) => {
    const price = row.price;

    if (price === null) {
      return;
    }

    setLines((current) => [
      ...current,
      {
        productId: row.item.id,
        productSku: row.item.sku,
        productName: row.item.name,
        unitId: row.unit.id,
        unitName: row.unit.name,
        conversionFactor: row.unit.conversionFactor,
        quantity: '1',
        unitPrice: price,
        priceOverridden: false,
        discountType: null,
        discountValue: '',
        trackBatches: row.item.trackBatches,
      },
    ]);
    setSearch('');
    setResultIndex(0);
    window.setTimeout(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    }, 0);
  }, []);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (rows.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setResultIndex((index) => Math.min(index + 1, rows.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setResultIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[resultIndex];

      if (row !== undefined) {
        addRow(row);
      }
    }
  };

  const updateLine = <K extends keyof InvoiceLineDraft>(
    index: number,
    field: K,
    value: InvoiceLineDraft[K],
  ) => {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, [field]: value } : line)),
    );
    setLineErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  };

  const changeUnit = (index: number, unitId: string) => {
    const line = lines[index];
    const item = stockByProduct.get(line.productId);
    const unit = item?.units.find((candidate) => candidate.id === unitId);

    if (unit === undefined) {
      updateLine(index, 'unitId', unitId);
      return;
    }

    const price = unit.prices.find((entry) => entry.type === priceType)?.amount ?? line.unitPrice;

    setLines((current) =>
      current.map((entry, position) =>
        position === index
          ? {
              ...entry,
              unitId: unit.id,
              unitName: unit.name,
              conversionFactor: unit.conversionFactor,
              unitPrice: entry.priceOverridden ? entry.unitPrice : price,
            }
          : entry,
      ),
    );
  };

  const removeLine = (index: number) => {
    setLines((current) => current.filter((_, position) => position !== index));
  };

  const validate = (): boolean => {
    const errors: Record<number, string> = {};
    let valid = true;

    if (customerId === '') {
      setError({ title: t('invoices.errorCustomerRequired'), detail: null });
      valid = false;
    }

    if (lines.length === 0) {
      setError({ title: t('invoices.errorNoLines'), detail: null });
      valid = false;
    }

    lines.forEach((line, index) => {
      if (!isValidQuantity(line.quantity) || line.quantity.trim() === '0') {
        errors[index] = t('validation.quantity');
        valid = false;
      } else if (!isValidPrice(line.unitPrice)) {
        errors[index] = t('validation.priceAmount');
        valid = false;
      }
    });

    if (payNow && !isValidPrice(paymentAmount)) {
      errors[-1] = t('validation.priceAmount');
      valid = false;
    }

    setLineErrors(errors);
    return valid;
  };

  const submit = async () => {
    setError(null);

    if (!validate()) {
      return;
    }

    const key = keyForAttempt(idempotencyKey, hasSubmitted);
    setIdempotencyKey(key);
    setBusy(true);

    const payload: CreateInvoiceInput = {
      customerId,
      lines: lines.map((line) => ({
        productId: line.productId,
        unitId: line.unitId,
        quantity: line.quantity.trim(),
        unitPrice: line.priceOverridden ? line.unitPrice.trim() : null,
        discount:
          line.discountType === null
            ? null
            : { type: line.discountType, value: line.discountValue.trim() },
      })),
      discount: discountType === null ? null : { type: discountType, value: discountValue.trim() },
      notes: notes.trim() === '' ? null : notes.trim(),
      payment:
        payNow && paymentAmount.trim() !== '0'
          ? {
              amount: paymentAmount.trim(),
              method: paymentMethod,
              reference: paymentReference.trim() === '' ? null : paymentReference.trim(),
            }
          : null,
      idempotencyKey: key,
    };

    try {
      const invoice = await createInvoice(payload);
      onSaved(invoice, currency);
    } catch (caught) {
      setHasSubmitted(true);
      setError(translateInvoiceError(t, caught));
    } finally {
      setBusy(false);
    }
  };

  const stockWarning = (line: InvoiceLineDraft): string | null => {
    const item = stockByProduct.get(line.productId);

    if (item === undefined) {
      return null;
    }

    const needed = lineBaseQuantity(line);

    if (item.trackBatches) {
      const usable = usableBatchQuantity(
        item.batches.map((batch) => ({
          quantity: batch.currentStock,
          expiryDate: batch.expiryDate,
        })),
        today(),
      );

      if (compareDecimals(needed, usable) > 0) {
        return t('invoices.warnBatches', { needed, available: usable });
      }

      return null;
    }

    if (compareDecimals(needed, item.currentStock) > 0) {
      return t('invoices.warnStock', { needed, available: item.currentStock });
    }

    return null;
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('invoices.newTitle')}</h2>
          <p className="muted">{t('invoices.newSubtitle')}</p>
        </div>
        <div className="row-actions">
          <button type="button" className="button button--quiet" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void submit()}
            disabled={busy || loading}
          >
            {busy ? t('invoices.saving') : t('invoices.saveInvoice')}
          </button>
        </div>
      </section>

      {error !== null ? (
        <p className="alert alert--error" role="alert">
          {error.title}
          {error.detail === null ? null : <span className="muted"> {error.detail}</span>}
        </p>
      ) : null}

      <div className="invoice-layout">
        <section className="panel" aria-labelledby="invoice-customer-title">
          <div className="panel__heading">
            <h3 id="invoice-customer-title" className="panel__subheading">
              {t('invoices.customerAndProducts')}
            </h3>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-customer-search">{t('invoices.customerSearch')}</label>
              <input
                id="invoice-customer-search"
                value={customerSearch}
                placeholder={t('invoices.customerSearchPlaceholder')}
                onChange={(event) => setCustomerSearch(event.target.value)}
                disabled={busy}
              />
            </div>

            <div className="field">
              <label htmlFor="invoice-customer">{t('invoices.customer')}</label>
              <select
                id="invoice-customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                disabled={busy}
              >
                {visibleCustomers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.isWalkIn && entry.name !== t('customers.walkIn')
                      ? ` (${t('customers.walkIn')})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {customer !== null ? (
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>{t('invoices.customerType')}</dt>
                <dd>{t(`customers.types.${customer.type}`)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('invoices.customerBalance')}</dt>
                <dd className="money">{money(customer.balance)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('invoices.customerTerms')}</dt>
                <dd>
                  {customer.paymentTermDays === null
                    ? t('invoices.dueImmediately')
                    : t('invoices.dueInDays', { days: customer.paymentTermDays })}
                </dd>
              </div>
              {customer.creditLimit !== null ? (
                <div className="detail-list__row">
                  <dt>{t('invoices.customerCreditLimit')}</dt>
                  <dd className="money">{money(customer.creditLimit)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="field">
            <label htmlFor="invoice-search">{t('invoices.productSearch')}</label>
            <input
              id="invoice-search"
              value={search}
              placeholder={t('invoices.productSearchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onSearchKeyDown}
              disabled={busy}
              autoComplete="off"
            />
            <p className="field__hint">{t('invoices.searchHint')}</p>
          </div>

          <div className="product-results" role="listbox" aria-label={t('invoices.searchResults')}>
            {rows.map((row, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === resultIndex}
                key={`${row.item.id}-${row.unit.id}`}
                className={`product-result${index === resultIndex ? ' product-result--active' : ''}`}
                onClick={() => addRow(row)}
                onMouseEnter={() => setResultIndex(index)}
                disabled={row.price === null}
              >
                <span className="product-result__name">
                  <strong>{row.item.name}</strong>
                  <small>
                    {row.item.sku} · {row.unit.name}
                  </small>
                </span>
                <span className="product-result__meta">
                  <span className="money">
                    {row.price === null ? t('invoices.noPrice') : unitMoney(row.price)}
                  </span>
                  <small>
                    {t('invoices.stock')}: {row.item.currentStockReadable}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="invoice-lines-title">
          <div className="panel__heading">
            <h3 id="invoice-lines-title" className="panel__subheading">
              {t('invoices.linesTitle')}
            </h3>
            <span className="pill">{t('invoices.lineCount', { count: lines.length })}</span>
          </div>

          {lines.length === 0 ? (
            <p className="muted">{t('invoices.emptyLines')}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th scope="col">{t('invoices.tableProduct')}</th>
                    <th scope="col">{t('invoices.tableUnit')}</th>
                    <th scope="col">{t('invoices.tableQuantity')}</th>
                    <th scope="col">{t('invoices.tableUnitPrice')}</th>
                    <th scope="col">{t('invoices.tableDiscount')}</th>
                    <th scope="col">{t('invoices.tableLineTotal')}</th>
                    <th scope="col" className="data-table__actions">
                      {t('invoices.tableActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const item = stockByProduct.get(line.productId);
                    const warning = stockWarning(line);

                    return (
                      <tr key={`${line.productId}-${index}`}>
                        <td>
                          <div className="table-primary">
                            <strong>{line.productName}</strong>
                            <small>{line.productSku}</small>
                          </div>
                        </td>
                        <td>
                          <select
                            aria-label={t('invoices.tableUnit')}
                            value={line.unitId}
                            onChange={(event) => changeUnit(index, event.target.value)}
                            disabled={busy}
                          >
                            {(item?.units ?? []).map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            ref={index === lines.length - 1 ? quantityRef : undefined}
                            aria-label={t('invoices.tableQuantity')}
                            value={line.quantity}
                            inputMode="decimal"
                            onChange={(event) => updateLine(index, 'quantity', event.target.value)}
                            disabled={busy}
                          />
                          {warning === null ? null : (
                            <small className="field__error">{warning}</small>
                          )}
                        </td>
                        <td>
                          <input
                            aria-label={t('invoices.tableUnitPrice')}
                            value={line.unitPrice}
                            inputMode="decimal"
                            disabled={busy || !canOverridePrice}
                            title={
                              canOverridePrice ? undefined : t('invoices.priceOverrideOwnerOnly')
                            }
                            onChange={(event) => updateLine(index, 'unitPrice', event.target.value)}
                            onFocus={() => {
                              if (!line.priceOverridden) {
                                updateLine(index, 'priceOverridden', true);
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="row-actions">
                            <select
                              aria-label={t('invoices.discountType')}
                              value={line.discountType ?? ''}
                              onChange={(event) =>
                                updateLine(
                                  index,
                                  'discountType',
                                  event.target.value === ''
                                    ? null
                                    : (event.target.value as DiscountType),
                                )
                              }
                              disabled={busy}
                            >
                              <option value="">{t('common.noDiscount')}</option>
                              <option value="AMOUNT">{t('invoices.discountAmount')}</option>
                              <option value="PERCENT">{t('invoices.discountPercent')}</option>
                            </select>
                            {line.discountType === null ? null : (
                              <input
                                aria-label={t('invoices.discountValue')}
                                value={line.discountValue}
                                inputMode="decimal"
                                onChange={(event) =>
                                  updateLine(index, 'discountValue', event.target.value)
                                }
                                disabled={busy}
                              />
                            )}
                          </div>
                        </td>
                        <td className="money">{money(lineTotal(line))}</td>
                        <td className="data-table__actions">
                          <button
                            type="button"
                            className="button button--small button--danger-ghost"
                            onClick={() => removeLine(index)}
                            disabled={busy}
                          >
                            {t('common.remove')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label htmlFor="invoice-discount-type">{t('invoices.invoiceDiscount')}</label>
              <select
                id="invoice-discount-type"
                value={discountType ?? ''}
                onChange={(event) =>
                  setDiscountType(
                    event.target.value === '' ? null : (event.target.value as DiscountType),
                  )
                }
                disabled={busy}
              >
                <option value="">{t('common.noDiscount')}</option>
                <option value="AMOUNT">{t('invoices.discountAmount')}</option>
                <option value="PERCENT">{t('invoices.discountPercent')}</option>
              </select>
            </div>

            {discountType === null ? null : (
              <div className="field">
                <label htmlFor="invoice-discount-value">{t('invoices.discountValue')}</label>
                <input
                  id="invoice-discount-value"
                  value={discountValue}
                  inputMode="decimal"
                  onChange={(event) => setDiscountValue(event.target.value)}
                  disabled={busy}
                />
              </div>
            )}

            <div className="field field--wide">
              <label htmlFor="invoice-notes">{t('invoices.notes')}</label>
              <input
                id="invoice-notes"
                value={notes}
                maxLength={1000}
                placeholder={t('invoices.notesPlaceholder')}
                onChange={(event) => setNotes(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>{t('invoices.subtotal')}</dt>
              <dd className="money">{money(totals.subtotal)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t('invoices.discountTotal')}</dt>
              <dd className="money">{money(totals.discountTotal)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t('invoices.total')}</dt>
              <dd className="money">{money(totals.total)}</dd>
            </div>
          </dl>

          <div className="form-grid">
            <div className="field">
              <span className="field__label">{t('invoices.checkoutTitle')}</span>
              <label className="checkbox-field" htmlFor="invoice-pay-now">
                <input
                  id="invoice-pay-now"
                  type="checkbox"
                  checked={payNow}
                  onChange={(event) => setPayNow(event.target.checked)}
                  disabled={busy}
                />
                <span>{t('invoices.payNow')}</span>
              </label>
            </div>

            {payNow ? (
              <>
                <div className="field">
                  <label htmlFor="invoice-payment-amount">{t('invoices.paymentAmount')}</label>
                  <input
                    id="invoice-payment-amount"
                    value={paymentAmount}
                    inputMode="decimal"
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    disabled={busy}
                  />
                </div>

                <div className="field">
                  <label htmlFor="invoice-payment-method">{t('invoices.paymentMethod')}</label>
                  <select
                    id="invoice-payment-method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                    disabled={busy}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {t(`paymentMethods.${method}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="invoice-payment-reference">
                    {t('invoices.paymentReference')}
                  </label>
                  <input
                    id="invoice-payment-reference"
                    value={paymentReference}
                    maxLength={120}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    disabled={busy}
                  />
                </div>
              </>
            ) : (
              <p className="muted">{t('invoices.onCredit')}</p>
            )}
          </div>

          {lineErrors[-1] !== undefined ? <p className="field__error">{lineErrors[-1]}</p> : null}
        </section>
      </div>
    </div>
  );
}
