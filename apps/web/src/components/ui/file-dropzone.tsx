"use client";

import { FileUp, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Custom drag-and-drop file input (the native file button is hidden). */
export function FileDropzone({
  accept,
  maxSizeMb = 20,
  value,
  onChange,
  label,
  hint,
  disabled,
  className,
}: {
  accept?: string;
  maxSizeMb?: number;
  value: File | null;
  onChange: (file: File | null) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Max ${maxSizeMb} MB`);
      return;
    }
    setError(null);
    onChange(file);
  }

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && ref.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) take(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-8 text-center transition-colors hover:border-primary hover:bg-primary-soft/30 aria-disabled:pointer-events-none aria-disabled:opacity-50",
          drag && "border-primary bg-primary-soft/40",
        )}
      >
        <FileUp className="size-6 text-muted" />
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => take(e.target.files?.[0])} />
      </div>
      {value && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
          <span className="truncate">{value.name}</span>
          <button type="button" onClick={() => onChange(null)} className="rounded-sm p-1 text-muted hover:text-text">
            <X className="size-4" />
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
