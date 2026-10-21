'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { useI18n } from '@/components/i18n-provider';
import {
  getCustomer,
  getCustomerStatement,
  getDepotSettings,
  listInvoices,
} from '@/lib/api-client';
import { sumDecimals } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import type { Customer, CustomerStatement, Invoice } from '@/lib/types';
import { RecordPaymentDialog } from './record-payment-dialog';

interface CustomerDetailProps {
  customerId: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const { t, locale } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [customerView, statementView, invoicePage, settings] = await Promise.all([
        getCustomer(customerId),
        getCustomerStatement(customerId),
        listInvoices({ customerId, pageSize: 100, sort: 'orderDate', order: 'desc' }),
        getDepotSettings(),
      ]);

      setCustomer(customerView);
      setStatement(statementView);
      setInvoices(invoicePage.data);
      setCurrency(settings.currency);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [customerId, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  const overdueAmount = sumDecimals(
    invoices
      .filter(
        (invoice) =>
          invoice.status === 'COMPLETED' &&
          invoice.paymentStatus !== 'PAID' &&
          invoice.dueDate !== null &&
          invoice.dueDate < today(),
      )
      .map((invoice) => invoice.outstanding),
  );

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{customer?.name ?? t('customers.detailTitle')}</h2>
          <p className="muted">{t('customers.detailSubtitle')}</p>
        </div>
        <div className="row-actions">
          <Link href="/customers" className="button button--quiet">
            {t('customers.backToList')}
          </Link>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setPaymentOpen(true)}
            disabled={loading || customer === null}
          >
            {t('customers.recordPayment')}
          </button>
        </div>
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {loadError !== null ? (
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {customer !== null ? (
        <>
          <section className="summary-grid">
            <article className="summary-card">
              <span className="summary-card__label">{t('customers.balance')}</span>
              <strong className="money">{money(customer.balance)}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-card__label">{t('customers.overdueAmount')}</span>
              <strong className="money">{money(overdueAmount ?? '0')}</strong>
            </article>
            <article className="summary-card">
              <span className="summary-card__label">{t('customers.creditLimit')}</span>
              <strong className="money">
                {customer.creditLimit === null
                  ? t('customers.noLimit')
                  : money(customer.creditLimit)}
              </strong>
            </article>
          </section>

          <section className="panel" aria-labelledby="customer-detail-title">
            <div className="panel__heading">
              <h3 id="customer-detail-title" className="panel__subheading">
                {t('customers.detailsTitle')}
              </h3>
            </div>
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>{t('customers.customerType')}</dt>
                <dd>{t(`customers.types.${customer.type}`)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('customers.phone')}</dt>
                <dd>{customer.phone ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('customers.email')}</dt>
                <dd>{customer.email ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('customers.address')}</dt>
                <dd className="detail-list__multiline">{customer.address ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('customers.paymentTerms')}</dt>
                <dd>
                  {customer.paymentTermDays === null
                    ? t('invoices.dueImmediately')
                    : t('invoices.dueInDays', { days: customer.paymentTermDays })}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel panel--flush" aria-labelledby="customer-statement-title">
            <div className="toolbar toolbar--wrap">
              <h3 id="customer-statement-title" className="toolbar__title">
                {t('customers.statementTitle')}
              </h3>
            </div>

            {statement === null ? null : statement.lines.length === 0 ? (
              <p className="muted">{t('customers.statementEmpty')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table product-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('customers.statementDate')}</th>
                      <th scope="col">{t('customers.statementType')}</th>
                      <th scope="col">{t('customers.statementReference')}</th>
                      <th scope="col">{t('customers.statementDebit')}</th>
                      <th scope="col">{t('customers.statementCredit')}</th>
                      <th scope="col">{t('customers.statementBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((line, index) => (
                      <tr key={`${line.reference}-${index}`}>
                        <td>{line.date}</td>
                        <td>{t(`customers.statementKind.${line.type}`)}</td>
                        <td>{line.reference}</td>
                        <td className="money">{money(line.debit)}</td>
                        <td className="money">{money(line.credit)}</td>
                        <td className="money">{money(line.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel panel--flush" aria-labelledby="customer-invoices-title">
            <div className="toolbar toolbar--wrap">
              <h3 id="customer-invoices-title" className="toolbar__title">
                {t('customers.invoicesTitle')}
              </h3>
            </div>

            {invoices.length === 0 ? (
              <p className="muted">{t('customers.noInvoices')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table product-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('invoices.tableNumber')}</th>
                      <th scope="col">{t('invoices.orderDate')}</th>
                      <th scope="col">{t('invoices.total')}</th>
                      <th scope="col">{t('invoices.outstanding')}</th>
                      <th scope="col">{t('invoices.paymentStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>{formatDate(invoice.orderDate, locale)}</td>
                        <td className="money">{money(invoice.total)}</td>
                        <td className="money">{money(invoice.outstanding)}</td>
                        <td>{t(`paymentStatus.${invoice.paymentStatus}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <RecordPaymentDialog
        open={paymentOpen}
        customer={customer}
        onRecorded={(payment) => {
          setPaymentOpen(false);
          setNotice(
            t('payments.recorded', {
              amount: money(payment.amount),
              method: t(`paymentMethods.${payment.method}`),
            }),
          );
          setReloadKey((value) => value + 1);
        }}
        onClose={() => setPaymentOpen(false)}
      />
    </div>
  );
}
