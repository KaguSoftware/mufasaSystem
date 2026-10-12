import { cn } from "@/lib/cn";

const field =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-muted transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-24 resize-y py-2 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-text", className)} {...props} />;
}

/** Label + control + hint/error. Pass the control as children. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | string[];
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ms-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {err ? <p className="text-xs text-danger">{err}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
