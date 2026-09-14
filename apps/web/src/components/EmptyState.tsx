import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { Icon, type IconName } from "./Icon";

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
        {icon === "file" ? <FileText /> : <Icon name={icon} />}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}
