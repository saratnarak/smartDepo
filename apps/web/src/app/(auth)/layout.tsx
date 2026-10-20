'use client';

import { Brand } from '@/components/brand';
import { LanguageSwitch } from '@/components/language-switch';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <header className="auth-layout__header">
        <Brand />
        <LanguageSwitch compact />
      </header>
      <main className="auth-layout__main">{children}</main>
      <div className="auth-layout__decor auth-layout__decor--one" aria-hidden="true" />
      <div className="auth-layout__decor auth-layout__decor--two" aria-hidden="true" />
    </div>
  );
}
