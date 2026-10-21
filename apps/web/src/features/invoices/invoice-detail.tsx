'use client';

import { useI18n } from '@/components/i18n-provider';
import { formatDate, formatMoney } from '@/lib/format';
import type { Invoice } from '@/lib/types';

interface InvoiceDetailProps {
  invoice: Invoice;
  currency: string;
  canVoid: boolean;
  onVoid: (invoice: Invoice) => void;
}

/** The detail of one invoice: lines, discounts, totals, payments, and the status. */
export function InvoiceDetail({ invoice, currency, canVoid, onVoid }: InvoiceDetailProps) {
  const { t, locale } = useI18n();

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  const unitMoney = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });

  const isVoided = invoice.status === 'VOIDED';

  return (
    <section className="panel" aria-labelledby="invoice-detail-title">
      <div className="panel__heading">
        <div>
          <h2 id="invoice-detail-title" className="panel__subheading">
            {t('invoices.detailTitle', { reference: invoice.invoiceNumber })}
          </h2>
          <p className="muted">{invoice.customerName}</p>
        </div>
        <span
          className={`status-badge ${
            isVoided
              ? 'status-badge--rejected'
              : invoice.paymentStatus === 'PAID'
                ? 'status-badge--approved'
                : 'status-badge--pending'
          }`}
        >
          <span className="status-badge__dot" aria-hidden="true" />
          {isVoided ? t('invoices.statusVoided') : t(`paymentStatus.${invoice.paymentStatus}`)}
        </span>
      </div>

      {isVoided ? (
        <p className="alert alert--info">
          {t('invoices.voidedNote')}
          {invoice.refundDue !== '0.00' ? (
            <> {t('invoices.refundDue', { amount: money(invoice.refundDue) })}</>
          ) : null}
        </p>
      ) : null}

      <dl className="detail-list">
        <div className="detail-list__row">
          <dt>{t('invoices.orderDate')}</dt>
          <dd>{formatDate(invoice.orderDate, locale)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.dueDate')}</dt>
          <dd>{invoice.dueDate === null ? '—' : formatDate(invoice.dueDate, locale)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.createdBy')}</dt>
          <dd>{invoice.createdBy}</dd>
        </div>
        {invoice.voidReason !== null ? (
          <div className="detail-list__row">
            <dt>{t('invoices.voidReason')}</dt>
            <dd className="detail-list__multiline">{invoice.voidReason}</dd>
          </div>
        ) : null}
      </dl>

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
              <th scope="col">{t('invoices.tableBatch')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="table-primary">
                    <strong>{item.productName}</strong>
                    <small>{item.productSku}</small>
                  </div>
                </td>
                <td>{item.productUnitName}</td>
                <td>
                  {item.quantity}
                  <small className="muted"> ({item.quantityReadable})</small>
                </td>
                <td className="money">{unitMoney(item.unitPrice)}</td>
                <td className="money">
                  {item.discountAmount === '0.00' || item.discountAmount === '0'
                    ? '—'
                    : item.discountType === 'PERCENT'
                      ? `${item.discountValue}% (${unitMoney(item.discountAmount)})`
                      : unitMoney(item.discountAmount)}
                </td>
                <td className="money">{money(item.lineTotal)}</td>
                <td>
                  {item.batches.length === 0 ? (
                    '—'
                  ) : (
                    <div className="table-primary">
                      {item.batches.map((batch) => (
                        <span key={batch.id}>
                          {batch.batchNumber} · {batch.quantity}
                          {batch.expiryDate === null
                            ? ''
                            : ` · ${formatDate(batch.expiryDate, locale)}`}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="detail-list">
        <div className="detail-list__row">
          <dt>{t('invoices.subtotal')}</dt>
          <dd className="money">{money(invoice.subtotal)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.discountTotal')}</dt>
          <dd className="money">{money(invoice.discountTotal)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.total')}</dt>
          <dd className="money">{money(invoice.total)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.paidAmount')}</dt>
          <dd className="money">{money(invoice.paidAmount)}</dd>
        </div>
        <div className="detail-list__row">
          <dt>{t('invoices.outstanding')}</dt>
          <dd className="money">{money(invoice.outstanding)}</dd>
        </div>
        {invoice.refundDue !== '0.00' && invoice.refundDue !== '0' ? (
          <div className="detail-list__row">
            <dt>{t('invoices.refundDueLabel')}</dt>
            <dd className="money">{money(invoice.refundDue)}</dd>
          </div>
        ) : null}
      </dl>

      <h4 className="panel__subheading">{t('invoices.paymentsTitle')}</h4>
      {invoice.payments.length === 0 ? (
        <p className="muted">{t('invoices.noPayments')}</p>
      ) : (
        <ul className="plain-list">
          {invoice.payments.map((payment) => (
            <li key={payment.id}>
              {formatDate(payment.paidAt, locale)} · {t(`paymentMethods.${payment.method}`)} ·{' '}
              <span className="money">{money(payment.amount)}</span>
              {payment.reference === null ? '' : ` · ${payment.reference}`}
            </li>
          ))}
        </ul>
      )}

      {canVoid && !isVoided ? (
        <div className="form-actions">
          <button type="button" className="button button--danger" onClick={() => onVoid(invoice)}>
            {t('invoices.void')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
