'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { ResetPasswordDialog } from '@/features/staff/reset-password-dialog';
import { StaffForm } from '@/features/staff/staff-form';
import { deactivateStaff, listStaff, updateStaff } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Paginated, StaffUser } from '@/lib/types';

const PAGE_SIZE = 10;

type FormMode = 'closed' | 'create' | 'edit';

export default function StaffPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<StaffUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<StaffUser | null>(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setLoadError(null);

    try {
      const data = await listStaff({ page, pageSize: PAGE_SIZE });

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
  }, [page, t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const reload = () => {
    setReloadKey((value) => value + 1);
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditing(null);
  };

  const openCreate = () => {
    setNotice(null);
    setActionError(null);
    setEditing(null);
    setFormMode('create');
  };

  const openEdit = (staff: StaffUser) => {
    setNotice(null);
    setActionError(null);
    setEditing(staff);
    setFormMode('edit');
  };

  const saved = () => {
    setNotice(formMode === 'edit' ? t('staff.updated') : t('staff.created'));
    closeForm();
    reload();
  };

  const reactivate = async (staff: StaffUser) => {
    setNotice(null);
    setActionError(null);
    setBusyId(staff.id);

    try {
      await updateStaff(staff.id, { isActive: true });
      setNotice(t('staff.reactivated'));
      reload();
    } catch (error) {
      setActionError(getErrorMessage(t, error));
    } finally {
      setBusyId(null);
    }
  };

  const closeDeactivate = () => {
    if (!deactivateBusy) {
      setPendingDeactivate(null);
      setDeactivateError(null);
    }
  };

  const confirmDeactivate = async () => {
    if (pendingDeactivate === null) {
      return;
    }

    setDeactivateBusy(true);
    setDeactivateError(null);

    try {
      await deactivateStaff(pendingDeactivate.id);
      setPendingDeactivate(null);
      setNotice(t('staff.deactivated'));
      reload();
    } catch (error) {
      setDeactivateError(getErrorMessage(t, error));
    } finally {
      setDeactivateBusy(false);
    }
  };

  const total = result?.meta.total ?? 0;
  const rows = result?.data ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2>{t('staff.title')}</h2>
          <p className="muted">{t('staff.subtitle')}</p>
        </div>
        <button type="button" className="button button--primary" onClick={openCreate}>
          {t('staff.addStaff')}
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

      {formMode !== 'closed' ? (
        <StaffForm
          key={editing?.id ?? 'new'}
          staff={editing}
          onSaved={saved}
          onCancel={closeForm}
        />
      ) : null}

      <section className="panel panel--flush" aria-labelledby="staff-list-title">
        <div className="toolbar">
          <h3 id="staff-list-title" className="toolbar__title">
            {t('staff.title')}
          </h3>
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
              <strong>{t('staff.emptyTitle')}</strong>
              <p>{t('staff.emptyBody')}</p>
            </div>
          </div>
        ) : null}

        {!loading && loadError === null && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table staff-table">
              <thead>
                <tr>
                  <th scope="col">{t('staff.tableName')}</th>
                  <th scope="col">{t('staff.tablePhone')}</th>
                  <th scope="col">{t('staff.tableRole')}</th>
                  <th scope="col">{t('staff.tableStatus')}</th>
                  <th scope="col">{t('staff.tableLastLogin')}</th>
                  <th scope="col" className="data-table__actions">
                    {t('staff.tableActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      <div className="table-primary">
                        <strong>{staff.name}</strong>
                        <small>{staff.email}</small>
                      </div>
                    </td>
                    <td>{staff.phone ?? t('common.notAvailable')}</td>
                    <td>{t(`roles.${staff.role}`)}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          staff.isActive ? 'status-badge--approved' : 'status-badge--inactive'
                        }`}
                      >
                        <span className="status-badge__dot" aria-hidden="true" />
                        {staff.isActive ? t('staff.active') : t('staff.inactive')}
                      </span>
                    </td>
                    <td>
                      {staff.lastLoginAt === null
                        ? t('staff.never')
                        : formatDate(staff.lastLoginAt, locale)}
                    </td>
                    <td className="data-table__actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => openEdit(staff)}
                          disabled={busyId !== null}
                        >
                          {t('staff.edit')}
                        </button>
                        <button
                          type="button"
                          className="button button--small button--secondary"
                          onClick={() => {
                            setNotice(null);
                            setResetTarget(staff);
                          }}
                          disabled={busyId !== null}
                        >
                          {t('staff.resetPassword')}
                        </button>
                        {staff.isActive ? (
                          <button
                            type="button"
                            className="button button--small button--danger-ghost"
                            onClick={() => {
                              setNotice(null);
                              setDeactivateError(null);
                              setPendingDeactivate(staff);
                            }}
                            disabled={busyId !== null}
                          >
                            {t('staff.deactivate')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button button--small button--primary"
                            onClick={() => void reactivate(staff)}
                            disabled={busyId !== null}
                          >
                            {busyId === staff.id ? t('common.loading') : t('staff.reactivate')}
                          </button>
                        )}
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
            <span className="muted">{t('staff.showing', { count: rows.length, total })}</span>
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
        open={pendingDeactivate !== null}
        title={t('staff.deactivateTitle')}
        description={
          pendingDeactivate === null
            ? ''
            : t('staff.deactivateMessage', { name: pendingDeactivate.name })
        }
        confirmLabel={t('staff.confirmDeactivate')}
        tone="danger"
        busy={deactivateBusy}
        error={deactivateError}
        onConfirm={() => void confirmDeactivate()}
        onClose={closeDeactivate}
      />

      <ResetPasswordDialog
        staff={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={() => {
          setResetTarget(null);
          setNotice(t('staff.resetDone'));
          reload();
        }}
      />
    </div>
  );
}
