'use client';

import { useState } from 'react';

import { useI18n } from '@/components/i18n-provider';
import { downloadReportCsv } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errors';

/** More rows than this show the warning that the report has no pages. */
export const LARGE_RESULT_ROWS = 200;

export function ReportLoading({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();

  return (
    <div className="table-skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">{t('common.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <div className="panel__body">
      <p className="alert alert--error" role="alert">
        {message}
      </p>
      <button type="button" className="button button--secondary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}

export function LargeResultWarning({ count }: { count: number }) {
  const { t } = useI18n();

  if (count <= LARGE_RESULT_ROWS) {
    return null;
  }

  return (
    <p className="alert alert--info" role="status">
      {t('reports.largeResult', { count })}
    </p>
  );
}

export function CsvDownloadButton({
  fileName,
  path,
  params,
}: {
  fileName: string;
  path: string;
  params: URLSearchParams;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);

    try {
      await downloadReportCsv(fileName, path, params);
    } catch (caught) {
      setError(getErrorMessage(t, caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="csv-download">
      <button
        type="button"
        className="button button--secondary button--small"
        onClick={() => void download()}
        disabled={busy}
      >
        {busy ? t('reports.csv.downloading') : t('reports.csv.download')}
      </button>
      {error !== null ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ReportEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state empty-state--large">
      <span className="empty-state__mark" aria-hidden="true">
        0
      </span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}
