'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { Modal } from '@/components/modal';
import { listAuditLog, listPlatformAuditLog, listStaff } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { AuditLogEntry, Paginated, StaffUser } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  EMPTY_AUDIT_FILTERS,
  filtersToParams,
  hasActiveFilters,
  hasInvalidPeriod,
  type AuditFilters,
} from './audit-filters';
import { auditValueRows, type AuditValueRow } from './audit-details';

const PAGE_SIZE = 20;

export type AuditLogScope = 'depot' | 'platform';

interface AuditLogManagerProps {
  scope: AuditLogScope;
}

function AuditValueList({ rows }: { rows: AuditValueRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">—</p>;
  }

  return (
    <dl className="audit-values">
      {rows.map((row, index) => (
        <div className="audit-values__row" key={`${row.key}-${String(index)}`}>
          <dt>{row.key === '' ? '—' : row.key}</dt>
          <dd>{row.value !== null ? row.value : <AuditValueList rows={row.children ?? []} />}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The audit log of the depot (owner) or of the platform (Platform Admin). The log is append-only:
 * there is no control to change or to remove an entry anywhere on this page.
 */
export function AuditLogManager({ scope }: AuditLogManagerProps) {
  const { t, locale } = useI18n();
  const currentUser = useSessionStore((state) => state.user);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'createdAt' | 'action' | 'entityType'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [result, setResult] = useState<Paginated<AuditLogEntry> | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditLogEntry | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { ...filtersToParams(applied), page, pageSize: PAGE_SIZE, sort, order };
      const pageResult =
        scope === 'platform' ? await listPlatformAuditLog(params) : await listAuditLog(params);

      setResult(pageResult);
    } catch (caught) {
      setError(getErrorMessage(t, caught));
    } finally {
      setLoading(false);
    }
  }, [applied, order, page, scope, sort, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  // The filter of the user needs the staff of the depot. The owner is the session user.
  useEffect(() => {
    if (scope !== 'depot') {
      return;
    }

    let active = true;

    listStaff({ pageSize: 100 })
      .then((response) => {
        if (active) {
          setStaff(response.data);
        }
      })
      .catch(() => {
        if (active) {
          setStaff([]);
        }
      });

    return () => {
      active = false;
    };
  }, [scope]);

  const users = useMemo(() => {
    const entries = staff.map((member) => ({ id: member.id, name: member.name }));

    if (scope === 'depot' && currentUser !== null) {
      return [{ id: currentUser.id, name: currentUser.name }, ...entries];
    }

    if (scope === 'platform' && currentUser !== null) {
      return [{ id: currentUser.id, name: currentUser.name }];
    }

    return entries;
  }, [currentUser, scope, staff]);

  const update = (field: keyof AuditFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const apply = () => {
    setPage(1);
    setApplied(filters);
  };

  const clear = () => {
    setFilters(EMPTY_AUDIT_FILTERS);
    setApplied(EMPTY_AUDIT_FILTERS);
    setPage(1);
  };

  const toggleSort = (column: 'createdAt' | 'action' | 'entityType') => {
    if (column === sort) {
      setOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSort(column);
    setOrder('desc');
  };

  const rows = result?.data ?? [];
  const total = result?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const invalidPeriod = hasInvalidPeriod(filters);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('auditLog.eyebrow')}</p>
          <h2>{scope === 'platform' ? t('auditLog.platformTitle') : t('auditLog.title')}</h2>
          <p className="muted">
            {scope === 'platform' ? t('auditLog.platformSubtitle') : t('auditLog.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          {t('common.retry')}
        </button>
      </section>

      <section className="panel">
        <div className="catalog-filters">
          <div className="field">
            <label htmlFor="audit-action">{t('auditLog.filterAction')}</label>
            <select
              id="audit-action"
              value={filters.action}
              onChange={(event) => update('action', event.target.value)}
            >
              <option value="">{t('auditLog.allActions')}</option>
              {AUDIT_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {t(`auditLog.action.${action}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="audit-user">{t('auditLog.filterUser')}</label>
            <select
              id="audit-user"
              value={filters.actorUserId}
              onChange={(event) => update('actorUserId', event.target.value)}
            >
              <option value="">{t('auditLog.allUsers')}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="audit-entity">{t('auditLog.filterEntity')}</label>
            <select
              id="audit-entity"
              value={filters.entityType}
              onChange={(event) => update('entityType', event.target.value)}
            >
              <option value="">{t('auditLog.allEntities')}</option>
              {AUDIT_ENTITY_TYPES.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="audit-from">{t('auditLog.filterFrom')}</label>
            <input
              id="audit-from"
              type="date"
              value={filters.from}
              onChange={(event) => update('from', event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="audit-to">{t('auditLog.filterTo')}</label>
            <input
              id="audit-to"
              type="date"
              value={filters.to}
              onChange={(event) => update('to', event.target.value)}
            />
          </div>

          <div className="field">
            <span className="visually-hidden">{t('auditLog.filters')}</span>
            <div className="row-actions">
              <button
                type="button"
                className="button button--primary"
                onClick={apply}
                disabled={invalidPeriod}
              >
                {t('auditLog.applyFilters')}
              </button>
              <button
                type="button"
                className="button button--quiet"
                onClick={clear}
                disabled={!hasActiveFilters(filters)}
              >
                {t('common.clear')}
              </button>
            </div>
          </div>
        </div>

        {invalidPeriod ? (
          <p className="field__error" role="alert">
            {t('auditLog.invalidPeriod')}
          </p>
        ) : null}
      </section>

      {error !== null ? (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="panel panel--flush" aria-labelledby="audit-log-table-title">
        <div className="toolbar">
          <h3 id="audit-log-table-title" className="toolbar__title">
            {t('auditLog.entries')}
          </h3>
          <span className="muted">{t('auditLog.showing', { count: rows.length, total })}</span>
        </div>

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

        {!loading && rows.length === 0 ? (
          <div className="empty-state empty-state--large">
            <span className="empty-state__mark" aria-hidden="true">
              0
            </span>
            <div>
              <strong>{t('auditLog.emptyTitle')}</strong>
              <p>{t('auditLog.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table report-table">
              <caption className="visually-hidden">{t('auditLog.entries')}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <button
                      type="button"
                      className="report-table__sort"
                      onClick={() => toggleSort('createdAt')}
                    >
                      <span>{t('auditLog.columnTime')}</span>
                      <span aria-hidden="true" className="report-table__sort-mark">
                        {sort === 'createdAt' ? (order === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col">{t('auditLog.columnUser')}</th>
                  <th scope="col">
                    <button
                      type="button"
                      className="report-table__sort"
                      onClick={() => toggleSort('action')}
                    >
                      <span>{t('auditLog.columnAction')}</span>
                      <span aria-hidden="true" className="report-table__sort-mark">
                        {sort === 'action' ? (order === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col">
                    <button
                      type="button"
                      className="report-table__sort"
                      onClick={() => toggleSort('entityType')}
                    >
                      <span>{t('auditLog.columnEntity')}</span>
                      <span aria-hidden="true" className="report-table__sort-mark">
                        {sort === 'entityType' ? (order === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="data-table__actions">
                    {t('auditLog.columnDetails')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.createdAt, locale)}</td>
                    <td>
                      {entry.actor === null ? (
                        <span className="muted">{t('auditLog.system')}</span>
                      ) : (
                        <div className="table-primary">
                          <strong>{entry.actor.name}</strong>
                          <small>{entry.actor.role}</small>
                        </div>
                      )}
                    </td>
                    <td>{t(`auditLog.action.${entry.action}`)}</td>
                    <td>
                      <div className="table-primary">
                        <strong>{entry.entityType}</strong>
                        {entry.entityId === null ? null : <small>{entry.entityId}</small>}
                      </div>
                    </td>
                    <td className="data-table__actions">
                      <button
                        type="button"
                        className="button button--small button--quiet"
                        onClick={() => setDetail(entry)}
                      >
                        {t('auditLog.viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <div className="pagination">
            <span className="muted">{t('auditLog.showing', { count: rows.length, total })}</span>
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

      <Modal
        open={detail !== null}
        title={t('auditLog.detailsTitle')}
        onClose={() => setDetail(null)}
      >
        {detail === null ? null : (
          <div className="audit-detail">
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>{t('auditLog.columnTime')}</dt>
                <dd>{formatDate(detail.createdAt, locale)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('auditLog.columnUser')}</dt>
                <dd>{detail.actor?.name ?? t('auditLog.system')}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('auditLog.columnAction')}</dt>
                <dd>{t(`auditLog.action.${detail.action}`)}</dd>
              </div>
              <div className="detail-list__row">
                <dt>{t('auditLog.columnEntity')}</dt>
                <dd>
                  {detail.entityType}
                  {detail.entityId === null ? '' : ` · ${detail.entityId}`}
                </dd>
              </div>
              {detail.ipAddress === null ? null : (
                <div className="detail-list__row">
                  <dt>{t('auditLog.ipAddress')}</dt>
                  <dd>{detail.ipAddress}</dd>
                </div>
              )}
            </dl>

            <h3 className="panel__subheading">{t('auditLog.before')}</h3>
            <AuditValueList rows={auditValueRows(detail.before)} />

            <h3 className="panel__subheading">{t('auditLog.after')}</h3>
            <AuditValueList rows={auditValueRows(detail.after)} />

            <h3 className="panel__subheading">{t('auditLog.metadata')}</h3>
            <AuditValueList rows={auditValueRows(detail.metadata)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
