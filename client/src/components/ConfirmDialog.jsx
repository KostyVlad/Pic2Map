/**
 * ConfirmDialog — styled modal confirmation, replaces the native window.confirm.
 *
 * Controlled component: render with `open` and supply onConfirm/onCancel.
 * Backdrop click and Escape cancel (unless `busy`). Uses design-system tokens.
 */

import { useEffect } from 'react';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-heading font-semibold text-text mb-2">{title}</h2>
        {message && <p className="text-body text-text-muted mb-6">{message}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={[
              'min-h-11 px-4 rounded-md text-label font-semibold',
              'text-text-muted hover:text-text transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent',
              busy ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              'min-h-11 px-4 rounded-md text-label font-semibold',
              'bg-destructive text-surface transition-opacity',
              'focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2',
              busy ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90',
            ].join(' ')}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
