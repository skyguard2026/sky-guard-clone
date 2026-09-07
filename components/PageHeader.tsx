import type { ReactNode } from "react";

export function PageHeader({
  title,
  crumb,
  actions,
}: {
  title: string;
  crumb: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <span className="crumb">{crumb}</span>
      {actions ? <div className="acts">{actions}</div> : null}
    </div>
  );
}
