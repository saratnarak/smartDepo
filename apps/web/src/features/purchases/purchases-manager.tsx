'use client';

import { useCallback, useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import {
  cancelPurchase,
  getDepotSettings,
  listProducts,
  listPurchases,
  listSuppliers,
  receivePurchase,
} from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import type { Paginated, Product, Purchase, PurchaseStatus, Supplier } from '@/lib/types';
import { PurchaseForm } from './purchase-form';

const PAGE_SIZE = 20;

type StatusFilter = '' | PurchaseStatus;

type PendingAction =
  { kind: 'receive'; purchase: Purchase } | { kind: 'cancel'; purchase: Purchase };

export function PurchasesManager() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<StatusFilter>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<Purchase> | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionDialogError, setActionDialogError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listPurchases({
        status: status === '' ? undefined : status,
        search,
        page,
        pageSize: PAGE_SIZE,
        sort: 'createdAt',
        order: 'desc',
      });
      setResult(data);
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [status, search, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  useEffect(() => {
    let active = true;

    void Promise.all([
      listSuppliers({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
      listProducts({ pageSize: 100, isActive: true, sort: 'name', order: 'asc' }),
      getDepotSettings(),
    ])
      .then(([supplierPage, productPage, settings]) => {
        if (active) {
          setSuppliers(supplierPage.data);
          setProducts(productPage.data);
          setCurrency(settings.currency);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = () => {
    setReloadKey((value) => value + 1);
  };

  const money = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale);

  /** A price per unit can carry cents, so it always keeps two decimals. */
  const unitMoney = (amount: string) =>
    currency === '' ? amount : formatMoney(amount, currency, locale, { decimals: 2 });

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setNotice(null);
    setActionError(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (purchase: Purchase) => {
    setNotice(null);
    setActionError(null);
    setEditing(purchase);
    setFormOpen(true);
  };

  const saved = (purchase: Purchase) => {
    setNotice(editing === null ? t('purchases.created') : t('purchases.updated'));
    setEditing(null);
    setFormOpen(false);
    setDetail(purchase);
    reload();
  };

  const confirmAction = async (reason: string) => {
    if (pendingAction === null) {
      return;
    }

    setActionBusy(true);
    setActionDialogError(null);

    try {
      const purchase =
        pendingAction.kind === 'receive'
          ? await receivePurchase(pendingAction.purchase.id)
          : await cancelPurchase(
              pendingAction.purchase.id,
              reason.trim() === '' ? t('purchases.cancelReasonDefault') : reason.trim(),
            );

      setNotice(
        pendingAction.kind === 'receive' ? t('purchases.received') : t('purchases.cancelled'),
      );
      setPendingAction(null);
      setDetail(purchase);
      reload();
    } catch (error) {
      setActionDialogError(getErrorMessage(t, error));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('purchases.title')}</h2>
          <p className="muted">{t('purchases.subtitle')}</p>
        </div>
        <button type="button" className="button button--primary" onClick={openCreate}>
          {t('purchases.add')}
        </button>
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      {actionError !== null ? (
        <p className="alert alert--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {formOpen ? (
        <PurchaseForm
          key={editing?.id ?? 'new'}
          purchase={editing}
          suppliers={suppliers}
          products={products}
          onSaved={saved}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {detail !== null ? (
        <section className="panel" aria-labelledby="purchase-detail-title">
          <div className="panel__heading">
            <div>
              <h2 id="purchase-detail-title" className="panel__subheading">
                {t('purchases.detailTitle', { reference: detail.referenceNumber })}
              </h2>
              <p className="muted">
                {t('purchases.detailStatus', { status: t(`purchaseStatus.${detail.status}`) })}
              </p>
            </div>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setDetail(null)}
            >
              {t('common.close')}
            </button>
          </div>

          <div className="detail-list">
            <div className="detail-list__row">
              <dt>{t('purchases.supplier')}</dt>
              <dd>{detail.supplier.name}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t('purchases.totalAmount')}</dt>
              <dd className="money">{money(detail.total)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t('purchases.createdAt')}</dt>
              <dd>{formatDate(detail.createdAt, locale)}</dd>
            </div>
            <div className="detail-list__row">
              <dt>{t('purchases.receivedAt')}</dt>
              <dd>{detail.receivedAt === null ? '—' : formatDate(detail.receivedAt, locale)}</dd>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('purchases.tableProduct')}</th>
                  <th scope="col">{t('purchases.lineUnit')}</th>
                  <th scope="col">{t('purchases.lineQuantity')}</th>
                  <th scope="col">{t('purchases.lineUnitCost')}</th>
                  <th scope="col">{t('purchases.lineTotal')}</th>
                  <th scope="col">{t('purchases.tableBatch')}</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
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
                      <small className="muted"> ({item.quantityBase})</small>
                    </td>
                    <td>{unitMoney(item.unitCost)}</td>
                    <td>{money(item.lineTotal)}</td>
                    <td>
                      {item.batchNumber === null ? (
                        '—'
                      ) : (
                        <div className="table-primary">
                          <span>{item.batchNumber}</span>
                          <small>{item.expiryDate ?? t('stock.noExpiry')}</small>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel panel--flush" aria-labelledby="purchase-list-title">
        <div className="toolbar toolbar--wrap">
          <h3 id="purchase-list-title" className="toolbar__title">
            {t('purchases.listTitle')}
          </h3>
        </div>

        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="purchase-search">{t('purchases.search')}</label>
            <input
              id="purchase-search"
              value={searchInput}
              placeholder={t('purchases.searchPlaceholder')}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="purchase-status">{t('purchases.filterStatus')}</label>
            <select
              id="purchase-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as StatusFilter);
                setPage(1);
              }}
            >
              <option value="">{t('purchases.allStatuses')}</option>
              <option value="DRAFT">{t('purchaseStatus.DRAFT')}</option>
              <option value="RECEIVED">{t('purchaseStatus.RECEIVED')}</option>
              <option value="CANCELLED">{t('purchaseStatus.CANCELLED')}</option>
            </select>
          </div>
        </div>

        {loadError !== null ? (
          <div className="panel__body">
            <p className="alert alert--error" role="alert">
              {loadError}
            </p>
            <button type="button" className="button button--secondary" onClick={reload}>
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="table-skeleton" role="status" aria-live="polite">
            <span className="visually-hidden">{t('common.loading')}</span>
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton-row">
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && loadError === null && rows.length === 0 ? (
          <div className="empty-state empty-state--large">
            <span className="empty-state__mark" aria-hidden="true">
              0
            </span>
            <div>
              <strong>{t('purchases.emptyTitle')}</strong>
              <p>{t('purchases.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table product-table">
              <thead>
                <tr>
                  <th scope="col">{t('purchases.tableReference')}</th>
                  <th scope="col">{t('purchases.supplier')}</th>
                  <th scope="col">{t('purchases.tableStatus')}</th>
                  <th scope="col">{t('purchases.totalAmount')}</th>
                  <th scope="col">{t('purchases.createdAt')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('purchases.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{purchase.referenceNumber}</strong>
                        <small>{t('purchases.lineCount', { count: purchase.items.length })}</small>
                      </div>
                    </td>
                    <td>{purchase.supplier.name}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          purchase.status === 'RECEIVED'
                            ? 'status-badge--approved'
                            : purchase.status === 'CANCELLED'
                              ? 'status-badge--rejected'
                              : 'status-badge--pending'
                        }`}
                      >
                        <span className="status-badge__dot" aria-hidden="true" />
                        {t(`purchaseStatus.${purchase.status}`)}
                      </span>
                    </td>
                    <td className="money">{money(purchase.total)}</td>
                    <td>{formatDate(purchase.createdAt, locale)}</td>
                    <td className="data-table__actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => setDetail(purchase)}
                        >
                          {t('purchases.view')}
                        </button>
                        {purchase.status === 'DRAFT' ? (
                          <>
                            <button
                              type="button"
                              className="button button--small button--secondary"
                              onClick={() => openEdit(purchase)}
                            >
                              {t('common.edit')}
                            </button>
                            <button
                              type="button"
                              className="button button--small button--primary"
                              onClick={() => {
                                setActionError(null);
                                setActionDialogError(null);
                                setPendingAction({ kind: 'receive', purchase });
                              }}
                            >
                              {t('purchases.receive')}
                            </button>
                            <button
                              type="button"
                              className="button button--small button--danger-ghost"
                              onClick={() => {
                                setActionError(null);
                                setActionDialogError(null);
                                setPendingAction({ kind: 'cancel', purchase });
                              }}
                            >
                              {t('purchases.cancel')}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && loadError === null ? (
          <div className="pagination">
            <span className="muted">{t('purchases.showing', { count: rows.length, total })}</span>
            {totalPages > 1 ? (
              <div className="pagination__controls">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                >
                  {t('common.previous')}
                </button>
                <span>{t('common.pageOf', { page, pages: totalPages })}</span>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                >
                  {t('common.next')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === 'cancel'
            ? t('purchases.cancelTitle')
            : t('purchases.receiveTitle')
        }
        description={
          pendingAction === null
            ? ''
            : pendingAction.kind === 'cancel'
              ? t('purchases.cancelMessage', {
                  reference: pendingAction.purchase.referenceNumber,
                })
              : t('purchases.receiveMessage', {
                  reference: pendingAction.purchase.referenceNumber,
                })
        }
        confirmLabel={
          pendingAction?.kind === 'cancel'
            ? t('purchases.confirmCancel')
            : t('purchases.confirmReceive')
        }
        tone={pendingAction?.kind === 'cancel' ? 'danger' : 'primary'}
        busy={actionBusy}
        error={actionDialogError}
        reason={
          pendingAction?.kind === 'cancel'
            ? {
                label: t('purchases.cancelReasonLabel'),
                placeholder: t('purchases.cancelReasonPlaceholder'),
              }
            : undefined
        }
        onConfirm={(reason) => void confirmAction(reason)}
        onClose={() => {
          if (!actionBusy) {
            setPendingAction(null);
            setActionDialogError(null);
          }
        }}
      />
    </div>
  );
}
