import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "lg";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: IconName;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = "",
  disabled,
  icon,
  loading = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={`button button--${variant} button--${size} ${className}`}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="button__spinner" /> : null}
      {!loading && icon ? <Icon className="button__icon" name={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & { label: string; name: IconName; variant?: "quiet" | "secondary" };
export function IconButton({
  className = "",
  label,
  name,
  type = "button",
  variant = "quiet",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`icon-button icon-button--${variant} ${className}`}
      type={type}
      {...props}
    >
      <Icon name={name} />
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  hint?: string;
  label: string;
};
export function Field({ error, hint, id, label, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = error || hint ? `${inputId}-description` : undefined;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <input
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error) || undefined}
        id={inputId}
        {...props}
      />
      {error || hint ? (
        <span
          className={`field__hint${error ? " field__hint--error" : ""}`}
          id={descriptionId}
        >
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
export type Tab = { id: string; label: string };
export function Tabs({
  activeId,
  items,
  label,
}: {
  activeId: string;
  items: Tab[];
  label: string;
}) {
  return (
    <div aria-label={label} className="tabs" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={item.id === activeId}
          className="tabs__tab"
          key={item.id}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? " switch--checked" : ""}`}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" className="switch__thumb" />
    </button>
  );
}

export function DataTable({
  children,
  caption,
}: {
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export function Sheet({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const titleId = useId();
  return (
    <aside aria-labelledby={titleId} className="sheet" role="dialog">
      <div className="sheet__handle" />
      <h2 id={titleId}>{title}</h2>
      {children}
    </aside>
  );
}
export function Dialog({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const titleId = useId();
  return (
    <dialog aria-labelledby={titleId} className="dialog" open>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
export function FeedbackState({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={`feedback feedback--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-busy="true"
      aria-label="Chargement"
      className={`skeleton ${className}`}
      role="status"
    />
  );
}
export function EmptyState({
  action,
  children,
  icon = "file",
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  icon?: IconName;
  title: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state__icon">
        <Icon name={icon} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}
