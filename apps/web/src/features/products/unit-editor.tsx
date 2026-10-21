'use client';

import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { useI18n } from '@/components/i18n-provider';
import { useSessionStore } from '@/stores/session-store';
import { archiveProductUnit, createProductUnit, updateProductUnit } from '@/lib/api-client';
import { formatDecimal, formatUnitPreview, isValidConversionFactor } from '@/lib/decimal';
import { getErrorMessage } from '@/lib/errors';
import type { Product } from '@/lib/types';
import { createUnitDraft, type UnitDraft, type UnitDraftValue } from './unit-drafts';

interface EditUnitRow {
  id: string;
  name: string;
  conversionFactor: string;
  isActive: boolean;
}

interface UnitEditorProps {
  mode: 'create' | 'edit';
  product?: Product | null;
  value?: UnitDraftValue;
  onChange?: (value: UnitDraftValue) => void;
  errors?: {
    baseUnit?: string;
    units: Record<string, { name?: string; conversionFactor?: string }>;
  };
  onChanged?: () => Promise<void> | void;
  onNotify?: (message: string) => void;
}

export function UnitEditor({
  mode,
  product = null,
  value,
  onChange,
  errors,
  onChanged,
  onNotify,
}: UnitEditorProps) {
  const { t, locale } = useI18n();
  const role = useSessionStore((state) => state.role);
  const canManage = role === 'OWNER' || role === 'STOCK_KEEPER';
  const [baseName, setBaseName] = useState('');
  const [rows, setRows] = useState<EditUnitRow[]>([]);
  const [newName, setNewName] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [baseError, setBaseError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<EditUnitRow | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const unitsSignature =
    product === null
      ? ''
      : product.units
          .map((unit) => `${unit.id}:${unit.name}:${unit.conversionFactor}:${unit.isActive}`)
          .join('|');

  useEffect(() => {
    if (mode !== 'edit' || product === null) {
      return;
    }

    setBaseName(product.baseUnit.name);
    setRows(
      product.units
        .filter((unit) => !unit.isBaseUnit)
        .map((unit) => ({
          id: unit.id,
          name: unit.name,
          conversionFactor: unit.conversionFactor,
          isActive: unit.isActive,
        })),
    );
  }, [mode, product, unitsSignature]);

  if (mode === 'create') {
    const draft = value ?? { baseUnit: '', units: [] };

    const updateDraft = (next: UnitDraftValue) => {
      onChange?.(next);
    };

    const updateUnit = (key: string, patch: Partial<UnitDraft>) => {
      updateDraft({
        ...draft,
        units: draft.units.map((unit) => (unit.key === key ? { ...unit, ...patch } : unit)),
      });
    };

    return (
      <section className="panel" aria-labelledby="unit-editor-title">
        <div className="panel__heading">
          <div>
            <h3 id="unit-editor-title" className="panel__subheading">
              {t('products.unitsTitle')}
            </h3>
            <p className="muted">{t('products.unitsSubtitle')}</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="base-unit-name">{t('products.unitBase')}</label>
          <input
            id="base-unit-name"
            value={draft.baseUnit}
            maxLength={40}
            placeholder={t('products.baseUnitPlaceholder')}
            aria-invalid={errors?.baseUnit !== undefined}
            onChange={(event) => updateDraft({ ...draft, baseUnit: event.target.value })}
          />
          <p className="field__hint">{t('products.unitBaseHint')}</p>
          {errors?.baseUnit !== undefined ? (
            <p className="field__error">{errors.baseUnit}</p>
          ) : null}
        </div>

        <h4 className="unit-editor__subtitle">{t('products.unitListTitle')}</h4>

        {draft.units.length === 0 ? (
          <p className="muted">{t('products.unitNoExtras')}</p>
        ) : (
          <div className="unit-editor__rows">
            {draft.units.map((unit) => {
              const unitErrors = errors?.units[unit.key];
              return (
                <div className="unit-row" key={unit.key}>
                  <div className="field">
                    <label htmlFor={`unit-name-${unit.key}`}>{t('products.unitName')}</label>
                    <input
                      id={`unit-name-${unit.key}`}
                      value={unit.name}
                      maxLength={40}
                      placeholder={t('products.unitNamePlaceholder')}
                      aria-invalid={unitErrors?.name !== undefined}
                      onChange={(event) => updateUnit(unit.key, { name: event.target.value })}
                    />
                    {unitErrors?.name !== undefined ? (
                      <p className="field__error">{unitErrors.name}</p>
                    ) : null}
                  </div>
                  <div className="field">
                    <label htmlFor={`unit-factor-${unit.key}`}>{t('products.unitFactor')}</label>
                    <input
                      id={`unit-factor-${unit.key}`}
                      value={unit.conversionFactor}
                      inputMode="decimal"
                      placeholder={t('products.unitFactorPlaceholder')}
                      aria-invalid={unitErrors?.conversionFactor !== undefined}
                      onChange={(event) =>
                        updateUnit(unit.key, { conversionFactor: event.target.value })
                      }
                    />
                    {unitErrors?.conversionFactor !== undefined ? (
                      <p className="field__error">{unitErrors.conversionFactor}</p>
                    ) : null}
                  </div>
                  <p className="unit-row__preview">
                    {formatUnitPreview(
                      unit.name,
                      unit.conversionFactor,
                      draft.baseUnit,
                      locale === 'en',
                    )}
                  </p>
                  <button
                    type="button"
                    className="button button--danger-ghost button--small"
                    onClick={() =>
                      updateDraft({
                        ...draft,
                        units: draft.units.filter((entry) => entry.key !== unit.key),
                      })
                    }
                  >
                    {t('products.unitRemove')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="button button--secondary"
          disabled={draft.units.length >= 20}
          onClick={() => updateDraft({ ...draft, units: [...draft.units, createUnitDraft()] })}
        >
          {t('products.unitAdd')}
        </button>
        {draft.units.length >= 20 ? <p className="field__hint">{t('products.unitMax')}</p> : null}
      </section>
    );
  }

  if (product === null) {
    return null;
  }

  const otherNames = (excludeId?: string): Set<string> => {
    const names = new Set<string>([baseName.trim().toLowerCase()]);
    for (const row of rows) {
      if (row.id !== excludeId) {
        names.add(row.name.trim().toLowerCase());
      }
    }
    return names;
  };

  const notify = (message: string) => {
    onNotify?.(message);
  };

  const saveBase = async () => {
    const name = baseName.trim();
    const names = new Set(
      rows.map((row) => row.name.trim().toLowerCase()).filter((entry) => entry !== ''),
    );

    if (name === '') {
      setBaseError(t('validation.required'));
      return;
    }
    if (name.length > 40) {
      setBaseError(t('validation.maxLength', { max: 40 }));
      return;
    }
    if (names.has(name.toLowerCase())) {
      setBaseError(t('validation.unitName'));
      return;
    }

    setBaseError(null);
    setBusyKey('base');
    try {
      await updateProductUnit(product.id, product.baseUnit.id, { name });
      notify(t('products.unitSaved'));
      await onChanged?.();
    } catch (error) {
      setBaseError(getErrorMessage(t, error));
    } finally {
      setBusyKey(null);
    }
  };

  const saveRow = async (row: EditUnitRow) => {
    const name = row.name.trim();
    const factor = row.conversionFactor.trim();
    const names = otherNames(row.id);

    if (name === '') {
      setRowErrors((current) => ({ ...current, [row.id]: t('validation.required') }));
      return;
    }
    if (name.length > 40) {
      setRowErrors((current) => ({
        ...current,
        [row.id]: t('validation.maxLength', { max: 40 }),
      }));
      return;
    }
    if (names.has(name.toLowerCase())) {
      setRowErrors((current) => ({ ...current, [row.id]: t('validation.unitName') }));
      return;
    }
    if (!isValidConversionFactor(factor)) {
      setRowErrors((current) => ({
        ...current,
        [row.id]: t('validation.conversionFactor'),
      }));
      return;
    }

    setRowErrors((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
    setBusyKey(row.id);

    try {
      const updated = await updateProductUnit(product.id, row.id, {
        name,
        conversionFactor: factor,
      });
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                name: updated.name,
                conversionFactor: updated.conversionFactor,
                isActive: updated.isActive,
              }
            : entry,
        ),
      );
      notify(t('products.unitSaved'));
      await onChanged?.();
    } catch (error) {
      setRowErrors((current) => ({ ...current, [row.id]: getErrorMessage(t, error) }));
    } finally {
      setBusyKey(null);
    }
  };

  const addUnit = async () => {
    const name = newName.trim();
    const factor = newFactor.trim();

    if (name === '') {
      setNewError(t('products.unitNameRequired'));
      return;
    }
    if (otherNames().has(name.toLowerCase())) {
      setNewError(t('validation.unitName'));
      return;
    }
    if (factor === '') {
      setNewError(t('products.unitFactorRequired'));
      return;
    }
    if (!isValidConversionFactor(factor)) {
      setNewError(t('validation.conversionFactor'));
      return;
    }

    setNewError(null);
    setBusyKey('new');

    try {
      const created = await createProductUnit(product.id, { name, conversionFactor: factor });
      setRows((current) => [
        ...current,
        {
          id: created.id,
          name: created.name,
          conversionFactor: created.conversionFactor,
          isActive: created.isActive,
        },
      ]);
      setNewName('');
      setNewFactor('');
      notify(t('products.unitAdded'));
      await onChanged?.();
    } catch (error) {
      setNewError(getErrorMessage(t, error));
    } finally {
      setBusyKey(null);
    }
  };

  const confirmArchive = async () => {
    if (pendingArchive === null) {
      return;
    }

    setBusyKey(pendingArchive.id);
    setArchiveError(null);

    try {
      const archived = await archiveProductUnit(product.id, pendingArchive.id);
      setRows((current) =>
        current.map((row) =>
          row.id === pendingArchive.id ? { ...row, isActive: archived.isActive } : row,
        ),
      );
      setPendingArchive(null);
      notify(t('products.unitArchived'));
      await onChanged?.();
    } catch (error) {
      setArchiveError(getErrorMessage(t, error));
    } finally {
      setBusyKey(null);
    }
  };

  const activeRows = rows.filter((row) => row.isActive);
  const archivedRows = rows.filter((row) => !row.isActive);

  return (
    <section className="panel" aria-labelledby="unit-editor-title">
      <div className="panel__heading">
        <div>
          <h3 id="unit-editor-title" className="panel__subheading">
            {t('products.unitsTitle')}
          </h3>
          <p className="muted">{t('products.unitsSubtitle')}</p>
        </div>
      </div>

      <div className="unit-editor__base">
        <div className="field">
          <label htmlFor="edit-base-unit-name">{t('products.unitBase')}</label>
          <input
            id="edit-base-unit-name"
            value={baseName}
            maxLength={40}
            disabled={!canManage || busyKey !== null}
            aria-invalid={baseError !== null}
            onChange={(event) => {
              setBaseName(event.target.value);
              setBaseError(null);
            }}
          />
          <p className="field__hint">{t('products.unitBaseRenameHint')}</p>
          {baseError !== null ? <p className="field__error">{baseError}</p> : null}
        </div>
        {canManage ? (
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => void saveBase()}
            disabled={busyKey !== null}
          >
            {busyKey === 'base' ? t('products.unitSaving') : t('products.unitSave')}
          </button>
        ) : null}
      </div>

      <h4 className="unit-editor__subtitle">{t('products.unitListTitle')}</h4>

      {activeRows.length === 0 ? <p className="muted">{t('products.unitNoExtras')}</p> : null}

      <div className="unit-editor__rows">
        {activeRows.map((row) => (
          <div className="unit-row" key={row.id}>
            <div className="field">
              <label htmlFor={`edit-unit-name-${row.id}`}>{t('products.unitName')}</label>
              <input
                id={`edit-unit-name-${row.id}`}
                value={row.name}
                maxLength={40}
                disabled={!canManage || busyKey !== null}
                onChange={(event) => {
                  setRows((current) =>
                    current.map((entry) =>
                      entry.id === row.id ? { ...entry, name: event.target.value } : entry,
                    ),
                  );
                  setRowErrors((current) => {
                    const next = { ...current };
                    delete next[row.id];
                    return next;
                  });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={`edit-unit-factor-${row.id}`}>{t('products.unitFactor')}</label>
              <input
                id={`edit-unit-factor-${row.id}`}
                value={row.conversionFactor}
                inputMode="decimal"
                disabled={!canManage || busyKey !== null}
                onChange={(event) => {
                  setRows((current) =>
                    current.map((entry) =>
                      entry.id === row.id
                        ? { ...entry, conversionFactor: event.target.value }
                        : entry,
                    ),
                  );
                  setRowErrors((current) => {
                    const next = { ...current };
                    delete next[row.id];
                    return next;
                  });
                }}
              />
            </div>
            <p className="unit-row__preview">
              {formatUnitPreview(row.name, row.conversionFactor, baseName, locale === 'en')}
            </p>
            {canManage ? (
              <div className="unit-row__actions">
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={() => void saveRow(row)}
                  disabled={busyKey !== null}
                >
                  {busyKey === row.id ? t('products.unitSaving') : t('products.unitSave')}
                </button>
                <button
                  type="button"
                  className="button button--danger-ghost button--small"
                  onClick={() => {
                    setArchiveError(null);
                    setPendingArchive(row);
                  }}
                  disabled={busyKey !== null}
                >
                  {t('products.unitArchive')}
                </button>
              </div>
            ) : null}
            {rowErrors[row.id] !== undefined ? (
              <p className="field__error unit-row__error">{rowErrors[row.id]}</p>
            ) : null}
          </div>
        ))}
      </div>

      {archivedRows.length > 0 ? (
        <div className="unit-editor__archived">
          <h5>{t('products.unitInactive')}</h5>
          <ul className="plain-list">
            {archivedRows.map((row) => (
              <li key={row.id}>
                <span className="pill">{t('products.unitInactive')}</span> {row.name} ·{' '}
                {formatDecimal(row.conversionFactor)} {baseName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? (
        <div className="unit-editor__new">
          <h5>{t('products.unitNewTitle')}</h5>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="new-unit-name">{t('products.unitName')}</label>
              <input
                id="new-unit-name"
                value={newName}
                maxLength={40}
                placeholder={t('products.unitNamePlaceholder')}
                disabled={busyKey !== null}
                onChange={(event) => {
                  setNewName(event.target.value);
                  setNewError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="new-unit-factor">{t('products.unitFactor')}</label>
              <input
                id="new-unit-factor"
                value={newFactor}
                inputMode="decimal"
                placeholder={t('products.unitFactorPlaceholder')}
                disabled={busyKey !== null}
                onChange={(event) => {
                  setNewFactor(event.target.value);
                  setNewError(null);
                }}
              />
            </div>
          </div>
          <p className="unit-row__preview">
            {formatUnitPreview(newName, newFactor, baseName, locale === 'en')}
          </p>
          {newError !== null ? <p className="field__error">{newError}</p> : null}
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => void addUnit()}
            disabled={busyKey !== null || rows.length >= 20}
          >
            {busyKey === 'new' ? t('products.unitSaving') : t('products.unitAdd')}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingArchive !== null}
        title={t('products.unitArchiveTitle')}
        description={
          pendingArchive === null
            ? ''
            : t('products.unitArchiveMessage', { name: pendingArchive.name })
        }
        confirmLabel={t('products.unitArchiveConfirm')}
        tone="danger"
        busy={busyKey !== null}
        error={archiveError}
        onConfirm={() => void confirmArchive()}
        onClose={() => {
          if (busyKey === null) {
            setPendingArchive(null);
            setArchiveError(null);
          }
        }}
      />
    </section>
  );
}
