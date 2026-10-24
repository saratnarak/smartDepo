/**
 * The neutral mark of an empty state. It replaces the "0" badge with an icon that says "there is
 * nothing here" without a number, so an empty list is never read as a zero.
 */

export type EmptyMarkVariant = 'list' | 'chart';

export function EmptyMark({ variant = 'list' }: { variant?: EmptyMarkVariant }) {
  return (
    <span className="empty-state__mark empty-state__mark--icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
        {variant === 'chart' ? (
          <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
        ) : (
          <>
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M15 3v4h4" />
            <path d="M9 12h7M9 16h5" />
          </>
        )}
      </svg>
    </span>
  );
}
