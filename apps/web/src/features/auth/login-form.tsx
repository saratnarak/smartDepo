'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AuthCard } from '@/components/auth-card';
import { useI18n } from '@/components/i18n-provider';
import { ApiError } from '@/lib/api-error';
import { getErrorMessage } from '@/lib/errors';
import { loginWithPassword } from '@/lib/session-client';
import { useSessionStore } from '@/stores/session-store';

interface LoginFormProps {
  nextPath?: string;
}

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);
  const logoutReason = useSessionStore((state) => state.logoutReason);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = useCallback(
    (role: string | undefined): string => {
      if (nextPath !== undefined) {
        return nextPath;
      }

      return role === 'PLATFORM_ADMIN' ? '/platform/depots' : '/dashboard';
    },
    [nextPath],
  );

  useEffect(() => {
    if (status === 'authenticated' && user !== null) {
      router.replace(destination(user.role));
    }
  }, [status, user, destination, router]);

  const reasonMessage = (() => {
    if (logoutReason === 'session-expired') {
      return t('auth.loginExpired');
    }
    if (logoutReason === 'service-unavailable') {
      return t('errors.network');
    }
    if (logoutReason === 'logout') {
      return t('auth.logoutSuccess');
    }
    if (logoutReason === 'depot-suspended') {
      return t('auth.sessionSuspended');
    }
    if (logoutReason === 'depot-rejected') {
      return t('auth.sessionRejected');
    }
    if (logoutReason === 'depot-pending') {
      return t('auth.sessionPending');
    }
    return null;
  })();

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    const trimmedIdentifier = identifier.trim();

    if (trimmedIdentifier === '') {
      errors.identifier = t('validation.required');
    } else if (trimmedIdentifier.length < 3) {
      errors.identifier = t('validation.minLength', { min: 3 });
    } else if (trimmedIdentifier.length > 254) {
      errors.identifier = t('validation.maxLength', { max: 254 });
    }

    if (password === '') {
      errors.password = t('validation.required');
    } else if (password.length > 72) {
      errors.password = t('validation.maxLength', { max: 72 });
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const session = await loginWithPassword(identifier.trim(), password);
      router.replace(destination(session.user.role));
    } catch (error) {
      if (error instanceof ApiError) {
        switch (error.detailReason) {
          case 'DEPOT_PENDING':
            router.push('/pending');
            return;
          case 'DEPOT_REJECTED':
            router.push('/rejected');
            return;
          case 'DEPOT_SUSPENDED':
            router.push('/suspended');
            return;
          default:
            break;
        }

        setFormError(
          error.status === 401 ? t('auth.loginGenericError') : getErrorMessage(t, error),
        );
      } else {
        setFormError(t('errors.unknown'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <p>
          {t('auth.noAccount')} <Link href="/register">{t('auth.createAccount')}</Link>
        </p>
      }
    >
      {reasonMessage !== null ? (
        <p
          className={`alert ${logoutReason === 'logout' ? 'alert--success' : 'alert--info'}`}
          role="status"
        >
          {reasonMessage}
        </p>
      ) : null}

      {formError !== null ? (
        <p className="alert alert--error" role="alert">
          {formError}
        </p>
      ) : null}

      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="login-identifier">{t('auth.identifier')}</label>
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            placeholder={t('auth.identifierPlaceholder')}
            aria-invalid={fieldErrors.identifier !== undefined}
            aria-describedby={
              fieldErrors.identifier !== undefined ? 'login-identifier-error' : undefined
            }
            onChange={(event) => {
              setIdentifier(event.target.value);
              setFieldErrors((current) => ({ ...current, identifier: undefined }));
            }}
            disabled={busy}
          />
          {fieldErrors.identifier !== undefined ? (
            <p className="field__error" id="login-identifier-error">
              {fieldErrors.identifier}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="login-password">{t('auth.password')}</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder={t('auth.passwordPlaceholder')}
            aria-invalid={fieldErrors.password !== undefined}
            aria-describedby={
              fieldErrors.password !== undefined ? 'login-password-error' : undefined
            }
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            disabled={busy}
          />
          {fieldErrors.password !== undefined ? (
            <p className="field__error" id="login-password-error">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button type="submit" className="button button--primary button--wide" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </AuthCard>
  );
}
