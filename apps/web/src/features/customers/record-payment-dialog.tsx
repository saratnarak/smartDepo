'use client';

import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/modal';
import { useI18n } from '@/components/i18n-provider';
import { listInvoices, recordPayment } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { isValidPrice, compareDecimal, sumDecimals } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import type { Customer, Invoice, Payment, PaymentMethod } from '@/lib/types';

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'OTHER'];

type AllocationMode = 'auto' | 'manual';

interface RecordPaymentDialogProps {
  open: boolean;
  customer: Customer | null;
  onRecorded: (payment: Payment) => void;
  onClose: () => void;
}

export function RecordPaymentDialog({
  open,
  customer,
  onRecorded,
  onClose,
}: RecordPaymentDialogProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<AllocationMode>('auto');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || customer === null) {
      return;
    }

    let active = true;

    void listInvoices({
      customerId: customer.id,
      paymentStatus: 'UNPAID',
      pageSize: 100,
      sort: 'orderDate',
      order: 'asc',
    })
      .then((page) => {
        if (active) {
          setInvoices(page.data);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [open, customer]);

  useEffect(() => {
    if (!open) {
      setAmount('');
      setMethod('CASH');
      setReference('');
      setNotes('');
      setMode('auto');
      setAllocations({});
      setError(null);
    }
  }, [open]);

  const allocatedTotal = useMemo(() => {
    const values = Object.values(allocations)
      .filter((value) => value.trim() !== '')
      .map((value) => value.trim());
    const sum = sumDecimals(values);
    return sum === null ? '0' : sum;
  }, [allocations]);

  const submit = async () => {
    if (customer === null) {
      return;
    }

    setError(null);

    if (!isValidPrice(amount) || amount.trim() === '0' || amount.trim() === '0.00') {
      setError(t('validation.priceAmount'));
      return;
    }

    const manual = Object.entries(allocations)
      .filter(([, value]) => value.trim() !== '')
      .map(([invoiceId, value]) => ({ invoiceId, amount: value.trim() }));

    if (mode === 'manual') {
      const sum = sumDecimals(manual.map((entry) => entry.amount));

      if (sum === null) {
        setError(t('payments.errorAllocationsTooBig'));
        return;
      }

      const comparison = compareDecimal(sum, amount.trim());

      if (comparison === null || comparison > 0) {
        setError(t('payments.errorAllocationsTooBig'));
        return;
      }
    }

    setBusy(true);

    try {
      const payment = await recordPayment({
        customerId: customer.id,
        amount: amount.trim(),
        method,
        reference: reference.trim() === '' ? null : reference.trim(),
        notes: notes.trim() === '' ? null : notes.trim(),
        allocations: mode === 'manual' && manual.length > 0 ? manual : undefined,
      });

      onRecorded(payment);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 400 && caught.message.trim() !== ''
          ? caught.message
          : getErrorMessage(t, caught),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('payments.recordTitle')}
      onClose={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div className="dialog__body">
        {error !== null ? (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="payment-amount">{t('payments.amount')}</label>
            <input
              id="payment-amount"
              value={amount}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field">
            <label htmlFor="payment-method">{t('payments.method')}</label>
            <select
              id="payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              disabled={busy}
            >
              {PAYMENT_METHODS.map((entry) => (
                <option key={entry} value={entry}>
                  {t(`paymentMethods.${entry}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="payment-reference">{t('payments.reference')}</label>
            <input
              id="payment-reference"
              value={reference}
              maxLength={120}
              onChange={(event) => setReference(event.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field field--wide">
            <label htmlFor="payment-notes">{t('payments.notes')}</label>
            <input
              id="payment-notes"
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <span className="field__label">{t('payments.allocationTitle')}</span>
        <div className="filter-tabs" role="group" aria-label={t('payments.allocationTitle')}>
          <button
            type="button"
            className={`filter-tab${mode === 'auto' ? ' filter-tab--active' : ''}`}
            aria-pressed={mode === 'auto'}
            onClick={() => setMode('auto')}
            disabled={busy}
          >
            {t('payments.allocationAuto')}
          </button>
          <button
            type="button"
            className={`filter-tab${mode === 'manual' ? ' filter-tab--active' : ''}`}
            aria-pressed={mode === 'manual'}
            onClick={() => setMode('manual')}
            disabled={busy}
          >
            {t('payments.allocationManual')}
          </button>
        </div>

        {mode === 'manual' ? (
          invoices.length === 0 ? (
            <p className="muted">{t('payments.noOpenInvoices')}</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th scope="col">{t('payments.tableInvoice')}</th>
                    <th scope="col">{t('payments.tableOutstanding')}</th>
                    <th scope="col">{t('payments.tableAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <div className="table-primary">
                          <strong>{invoice.invoiceNumber}</strong>
                          <small>{invoice.orderDate.slice(0, 10)}</small>
                        </div>
                      </td>
                      <td className="money">{invoice.outstanding}</td>
                      <td>
                        <input
                          aria-label={t('payments.allocationAmount')}
                          value={allocations[invoice.id] ?? ''}
                          inputMode="decimal"
                          onChange={(event) =>
                            setAllocations((current) => ({
                              ...current,
                              [invoice.id]: event.target.value,
                            }))
                          }
                          disabled={busy}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted">{t('payments.allocatedTotal', { amount: allocatedTotal })}</p>
            </div>
          )
        ) : (
          <p className="muted">{t('payments.allocationAutoHint')}</p>
        )}
      </div>

      <div className="dialog__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
          disabled={busy}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void submit()}
          disabled={busy}
        >
          {busy ? t('common.loading') : t('payments.save')}
        </button>
      </div>
    </Modal>
  );
}
