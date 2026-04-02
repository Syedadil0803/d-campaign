import { CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  isError: boolean;
}

export function Toast({ show, message, isError }: ToastProps) {
  if (!show) return null;

  return (
    <div className="fixed top-6 left-6 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3 z-50 animate-bounce-in">
      {isError ? (
        <AlertCircle className="w-5 h-5 text-red-400" />
      ) : (
        <CheckCircle className="w-5 h-5 text-green-400" />
      )}
      <span className="font-medium">{message}</span>
    </div>
  );
}
