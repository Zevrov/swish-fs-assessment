import { useCallback, useState } from 'react';
import { ToastMessage } from '../components/Toast';

let nextId = 1;

interface UseToasts {
  toasts: ToastMessage[];
  pushToast: (text: string, variant?: ToastMessage['variant']) => void;
  dismissToast: (id: number) => void;
}

// Tiny in-memory queue. Production apps would reach for a library here
// (`react-hot-toast`, `sonner`, etc.) — this is the ~30-line shim we need
// for the assessment.
export const useToasts = (): UseToasts => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback<UseToasts['pushToast']>((text, variant = 'info') => {
    setToasts((prev) => [...prev, { id: nextId++, text, variant }]);
  }, []);

  const dismissToast = useCallback<UseToasts['dismissToast']>((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
};
