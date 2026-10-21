'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { ImageUpload, type ImageUploadHandle } from '@/components/image-upload';
import { getDepotSettings, updateDepotSettings } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';
import { DEPOT_LOCALES, type DepotLocale, type DepotSettings } from '@/lib/types';
import { useSessionStore } from '@/stores/session-store';

interface SettingsFields {
  name: string;
  address: string;
  currency: string;
  locale: DepotLocale;
  invoiceFooter: string;
}

type FieldErrors = Partial<Record<keyof SettingsFields, string>>;

const EMPTY_FIELDS: SettingsFields = {
  name: '',
  address: '',
  currency: '',
  locale: 'EN',
  invoiceFooter: '',
};

function toFields(settings: DepotSettings): SettingsFields {
  return {
    name: settings.name,
    address: settings.address ?? '',
    currency: settings.currency,
    locale: settings.locale,
    invoiceFooter: settings.invoiceFooter ?? '',
  };
}

export function DepotSettingsForm() {
  const { t } = useI18n();
  const role = useSessionStore((state) => state.role);
  const updateDepot = useSessionStore((state) => state.updateDepot);
  const imageRef = useRef<ImageUploadHandle>(null);
  const owner = role === 'OWNER';
  const [settings, setSettings] = useState<DepotSettings | null>(null);
  const [fields, setFields] = useState<SettingsFields>(EMPTY_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getDepotSettings();
      setSettings(data);
      setFields(toFields(data));
    } catch (error) {
      setLoadError(getErrorMessage(t, error));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const update = <K extends keyof SettingsFields>(field: K, value: SettingsFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess(null);
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const name = fields.name.trim();
    const currency = fields.currency.trim().toUpperCase();
    const address = fields.address.trim();
    const footer = fields.invoiceFooter.trim();

    if (name === '') {
      errors.name = t('validation.required');
    } else if (name.length < 2) {
      errors.name = t('validation.minLength', { min: 2 });
    } else if (name.length > 120) {
      errors.name = t('validation.maxLength', { max: 120 });
    }

    if (currency === '') {
      errors.currency = t('validation.required');
    } else if (!/^[A-Z]{3}$/.test(currency)) {
      errors.currency = t('validation.currency');
    }

    if (address.length > 500) {
      errors.address = t('validation.maxLength', { max: 500 });
    }

    if (footer.length > 1000) {
      errors.invoiceFooter = t('validation.maxLength', { max: 1000 });
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const image = await imageRef.current?.upload();

      if (image?.status === 'failed') {
        setFormError(t('settings.logoUploadFailed'));
        return;
      }

      if (image?.status === 'busy') {
        setFormError(image.message);
        return;
      }

      const updated = await updateDepotSettings({
        name: fields.name.trim(),
        address: fields.address.trim() === '' ? null : fields.address.trim(),
        currency: fields.currency.trim().toUpperCase(),
        locale: fields.locale,
        invoiceFooter: fields.invoiceFooter.trim() === '' ? null : fields.invoiceFooter.trim(),
      });

      setSettings(updated);
      setFields(toFields(updated));
      updateDepot({ name: updated.name });
      setSuccess(t('settings.saved'));
    } catch (error) {
      setFormError(getErrorMessage(t, error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="panel">
        <p className="muted inline-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          {t('common.loading')}
        </p>
      </section>
    );
  }

  if (loadError !== null) {
    return (
      <section className="panel panel__body">
        <p className="alert alert--error" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          {t('common.retry')}
        </button>
      </section>
    );
  }

  if (settings === null) {
    return null;
  }

  if (!owner) {
    return (
      <section className="panel" aria-labelledby="settings-readonly-title">
        <div className="panel__heading">
          <h2 id="settings-readonly-title">{t('settings.readOnlyTitle')}</h2>
        </div>
        <p className="alert alert--info">{t('settings.readOnlyNote')}</p>
        <dl className="detail-list">
          <div className="detail-list__row">
            <dt>{t('settings.name')}</dt>
            <dd>{settings.name}</dd>
          </div>
          <div className="detail-list__row">
            <dt>{t('settings.address')}</dt>
            <dd>{settings.address ?? t('common.notAvailable')}</dd>
          </div>
          <div className="detail-list__row">
            <dt>{t('settings.currency')}</dt>
            <dd>{settings.currency}</dd>
          </div>
          <div className="detail-list__row">
            <dt>{t('settings.language')}</dt>
            <dd>{settings.locale === 'KM' ? t('common.khmer') : t('common.english')}</dd>
          </div>
          <div className="detail-list__row">
            <dt>{t('settings.invoiceFooter')}</dt>
            <dd className="detail-list__multiline">
              {settings.invoiceFooter ?? t('common.notAvailable')}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">{t('app.workspace')}</p>
          <h2 id="settings-title">{t('settings.title')}</h2>
        </div>
        <span className="pill">{t('settings.ownerOnly')}</span>
      </div>
      <p className="muted">{t('settings.subtitle')}</p>

      {success !== null ? (
        <p className="alert alert--success" role="status">
          {success}
        </p>
      ) : null}

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <ImageUpload
        ref={imageRef}
        kind="logo"
        existingKey={settings.logoKey}
        label={t('settings.logo')}
        onUploaded={(key) => {
          setSuccess(null);
          setSettings((current) => (current === null ? current : { ...current, logoKey: key }));
        }}
      />

      <form className="form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="settings-name">{t('settings.name')}</label>
            <input
              id="settings-name"
              name="name"
              type="text"
              autoComplete="organization"
              value={fields.name}
              placeholder={t('settings.namePlaceholder')}
              aria-invalid={fieldErrors.name !== undefined}
              aria-describedby={fieldErrors.name !== undefined ? 'settings-name-error' : undefined}
              onChange={(event) => update('name', event.target.value)}
              disabled={busy}
            />
            {fieldErrors.name !== undefined ? (
              <p className="field__error" id="settings-name-error">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="settings-currency">{t('settings.currency')}</label>
            <input
              id="settings-currency"
              name="currency"
              type="text"
              inputMode="text"
              maxLength={3}
              value={fields.currency}
              placeholder="KHR"
              aria-invalid={fieldErrors.currency !== undefined}
              aria-describedby={
                fieldErrors.currency !== undefined
                  ? 'settings-currency-error'
                  : 'settings-currency-hint'
              }
              onChange={(event) => update('currency', event.target.value.toUpperCase())}
              disabled={busy}
            />
            <p className="field__hint" id="settings-currency-hint">
              {t('settings.currencyHint')}
            </p>
            {fieldErrors.currency !== undefined ? (
              <p className="field__error" id="settings-currency-error">
                {fieldErrors.currency}
              </p>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor="settings-address">{t('settings.address')}</label>
          <textarea
            id="settings-address"
            name="address"
            rows={3}
            maxLength={500}
            value={fields.address}
            placeholder={t('settings.addressPlaceholder')}
            aria-invalid={fieldErrors.address !== undefined}
            aria-describedby={
              fieldErrors.address !== undefined ? 'settings-address-error' : undefined
            }
            onChange={(event) => update('address', event.target.value)}
            disabled={busy}
          />
          {fieldErrors.address !== undefined ? (
            <p className="field__error" id="settings-address-error">
              {fieldErrors.address}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="settings-language">{t('settings.language')}</label>
          <select
            id="settings-language"
            name="locale"
            value={fields.locale}
            onChange={(event) => update('locale', event.target.value === 'KM' ? 'KM' : 'EN')}
            disabled={busy}
          >
            {DEPOT_LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {locale === 'KM' ? t('common.khmer') : t('common.english')}
              </option>
            ))}
          </select>
          <p className="field__hint">{t('settings.languageHint')}</p>
        </div>

        <div className="field">
          <label htmlFor="settings-invoice-footer">{t('settings.invoiceFooter')}</label>
          <textarea
            id="settings-invoice-footer"
            name="invoiceFooter"
            rows={3}
            maxLength={1000}
            value={fields.invoiceFooter}
            placeholder={t('settings.invoiceFooterPlaceholder')}
            aria-invalid={fieldErrors.invoiceFooter !== undefined}
            aria-describedby={
              fieldErrors.invoiceFooter !== undefined ? 'settings-footer-error' : undefined
            }
            onChange={(event) => update('invoiceFooter', event.target.value)}
            disabled={busy}
          />
          {fieldErrors.invoiceFooter !== undefined ? (
            <p className="field__error" id="settings-footer-error">
              {fieldErrors.invoiceFooter}
            </p>
          ) : null}
        </div>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </form>
    </section>
  );
}
