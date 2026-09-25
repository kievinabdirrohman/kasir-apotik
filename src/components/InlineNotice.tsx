import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type InlineNoticeTone = 'error' | 'success' | 'info';

interface InlineNoticeProps {
  message: string;
  tone?: InlineNoticeTone;
  onDismiss?: () => void;
  className?: string;
}

const toneStyles: Record<InlineNoticeTone, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

export const InlineNotice: React.FC<InlineNoticeProps> = ({
  message,
  tone = 'error',
  onDismiss,
  className = '',
}) => {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${toneStyles[tone]} ${className}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="shrink-0 rounded p-0.5 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
