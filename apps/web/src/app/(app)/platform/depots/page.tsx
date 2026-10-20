'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { StatusBadge } from '@/components/status-badge';
import { approveDepot, listDepots, rejectDepot, suspendDepot } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { DEPOT_STATUSES, type DepotAdminView, type DepotStatus, type Paginated } from '@/lib/types';

const PAGE_SIZE = 10;

type DepotAction = 'approve' | 'reject' | 'suspend';

interface PendingAction {
  type: DepotAction;
  depot: DepotAdminView;
}

export default function PlatformDepotsPage() {
  const { t, locale } = useI18n();
  const [statusFilter, setStatusFilter] = useState<DepotStatus | ''>('PENDING');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<DepotAdminView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listDepots({ status: statusFilter, page, pageSize: PAGE_SIZE });

      if (requestId.current === currentRequest) {
        setResult(data);
      }
    } catch (error) {
      if (requestId.current === currentRequest) {
        setLoadError(getErrorMessage(t, error));
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [statusFilter, page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const reload = () => {
    setNotice(null);
    setReloadKey((value) => value + 1);
  };

  const changeFilter = (value: DepotStatus | '') => {
    setStatusFilter(value);
    setPage(1);
    setNotice(null);
  };

  const closeAction = () => {
    if (!actionBusy) {
      setAction(null);
      setActionError(null);
    }
  };

  const runAction = async (reason: string) => {
    if (action === null) {
      return;
    }

    setActionBusy(true);
    setActionError(null);

    try {
      if (action.type === 'approve') {
        await approveDepot(action.depot.id);
      } else if (action.type === 'reject') {
        await rejectDepot(action.depot.id, reason);
      } else {
        await suspendDepot(action.depot.id, reason);
      }

      setAction(null);
      setNotice(t('platform.actionSuccess'));
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(getErrorMessage(t, error));
    } finally {
      setActionBusy(false);
    }
  };

  const total = result?.meta.total ?? 0;
  const rows = result?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = action?.depot;
  const dialogTitle =
    action?.type === 'approve'
      ? t('platform.approveTitle')
      : action?.type === 'reject'
        ? t('platform.rejectTitle')
        : t('platform.suspendTitle');
  const dialogDescription =
    selected === undefined
      ? ''
      : action?.type === 'approve'
        ? t('platform.approveMessage', { name: selected.name })
        : action?.type === 'reject'
          ? t('platform.rejectMessage', { name: selected.name })
          : t('platform.suspendMessage', { name: selected.name });
  const dialogConfirm =
    action?.type === 'approve'
      ? t('platform.confirmApprove')
      : action?.type === 'reject'
        ? t('platform.confirmReject')
        : t('platform.confirmSuspend');

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.name')}</p>
          <h2>{t('platform.title')}</h2>
          <p className="muted">{t('platform.subtitle')}</p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={reload}
          disabled={loading}
        >
          {t('platform.refresh')}
        </button>
      </section>

      {notice !== null ? (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      ) : null}

      <section className="panel panel--flush" aria-labelledby="depot-list-title">
        <div className="toolbar">
          <h3 id="depot-list-title" className="toolbar__title">
            {t('platform.title')}
          </h3>
          <div className="filter-tabs" role="group" aria-label={t('platform.filterStatus')}>
            <button
              type="button"
              className={`filter-tab${statusFilter === '' ? ' filter-tab--active' : ''}`}
              aria-pressed={statusFilter === ''}
              onClick={() => changeFilter('')}
            >
              {t('platform.allStatuses')}
            </button>
            {DEPOT_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`filter-tab${statusFilter === status ? ' filter-tab--active' : ''}`}
                aria-pressed={statusFilter === status}
                onClick={() => changeFilter(status)}
              >
                {t(`status.${status}`)}
              </button>
            ))}
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
              <strong>{t('platform.emptyTitle')}</strong>
              <p>{t('platform.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('platform.depot')}</th>
                  <th scope="col">{t('platform.ownerContact')}</th>
                  <th scope="col">{t('platform.createdAt')}</th>
                  <th scope="col">{t('platform.status')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('platform.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((depot) => (
                  <tr key={depot.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{depot.name}</strong>
                        <small>{depot.slug}</small>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary">
                        <span>{depot.email}</span>
                        <small>{depot.phone}</small>
                      </div>
                    </td>
                    <td>{formatDate(depot.createdAt, locale)}</td>
                    <td>
                      <StatusBadge status={depot.status} />
                    </td>
                    <td className="data-table__actions">
                      <div className="row-actions">
                        {depot.status === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              className="button button--small button--primary"
                              onClick={() => {
                                setActionError(null);
                                setAction({ type: 'approve', depot });
                              }}
                            >
                              {t('platform.approve')}
                            </button>
                            <button
                              type="button"
                              className="button button--small button--danger-ghost"
                              onClick={() => {
                                setActionError(null);
                                setAction({ type: 'reject', depot });
                              }}
                            >
                              {t('platform.reject')}
                            </button>
                          </>
                        ) : null}

                        {depot.status === 'APPROVED' ? (
                          <button
                            type="button"
                            className="button button--small button--danger-ghost"
                            onClick={() => {
                              setActionError(null);
                              setAction({ type: 'suspend', depot });
                            }}
                          >
                            {t('platform.suspend')}
                          </button>
                        ) : null}

                        {depot.status === 'REJECTED' ? (
                          <button
                            type="button"
                            className="button button--small button--primary"
                            onClick={() => {
                              setActionError(null);
                              setAction({ type: 'approve', depot });
                            }}
                          >
                            {t('platform.approve')}
                          </button>
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
            <span className="muted">{t('platform.showing', { count: rows.length, total })}</span>
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
        open={action !== null}
        title={dialogTitle}
        description={dialogDescription}
        confirmLabel={dialogConfirm}
        tone={action?.type === 'approve' ? 'primary' : 'danger'}
        busy={actionBusy}
        error={actionError}
        reason={
          action?.type === 'reject' || action?.type === 'suspend'
            ? { label: t('platform.reason'), placeholder: t('platform.reasonPlaceholder') }
            : undefined
        }
        onConfirm={runAction}
        onClose={closeAction}
      />
    </div>
  );
}
