import React, { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  variant?: 'error' | 'info' | 'success';
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
  durationMs?: number;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss, durationMs = 4000 }) => {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} durationMs={durationMs} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: ToastMessage;
  onDismiss: (id: number) => void;
  durationMs: number;
}> = ({ toast, onDismiss, durationMs }) => {
  useEffect(() => {
    const handle = setTimeout(() => onDismiss(toast.id), durationMs);
    return () => clearTimeout(handle);
  }, [toast.id, onDismiss, durationMs]);

  const variant = toast.variant ?? 'info';
  return (
    <div className={`toast toast-${variant}`} role="status">
      <span className="toast-text">{toast.text}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="toast-dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
};
