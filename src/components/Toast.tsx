import { CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  isError: boolean;
}

export function Toast({ show, message, isError }: ToastProps) {
  if (!show) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full shadow-lg bg-surface-elevated border border-border text-on-surface animate-bounce-in">
        {isError ? (
          <AlertCircle className="w-5 h-5 text-red-400" />
        ) : (
          <CheckCircle className="w-5 h-5 text-primary" />
        )}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
}
