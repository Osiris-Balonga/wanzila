import { useState } from "react";
import { Icon, type IconName } from "../components/Icon";
import { Badge, Card, EmptyState, Field, Tabs } from "../components/primitives";

type AdminShellProps = { pathname: string };
const administrationLinks: Array<{
  href: string;
  icon: IconName;
  label: string;
}> = [
  { href: "/admin", icon: "dashboard", label: "Vue d’ensemble" },
  { href: "/admin/pharmacies", icon: "pharmacy", label: "Pharmacies" },
  { href: "/admin/gardes", icon: "calendar", label: "Gardes" },
  { href: "/admin/contributions", icon: "users", label: "Contributions" },
  { href: "/admin/signalements", icon: "file", label: "Signalements" },
  { href: "/admin/qualite", icon: "shield", label: "Qualité des données" },
  { href: "/admin/parametres", icon: "settings", label: "Paramètres" },
];
const isCurrentRoute = (href: string, pathname: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

function Navigation({
  compact = false,
  pathname,
}: {
  compact?: boolean;
  pathname: string;
}) {
  return (
    <nav
      aria-label="Navigation administration"
      className={compact ? "admin-nav admin-nav--compact" : "admin-nav"}
    >
      {administrationLinks.map((item) => (
        <a
          aria-current={
            isCurrentRoute(item.href, pathname) ? "page" : undefined
          }
          href={item.href}
          key={item.href}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function AdminShell({ pathname }: AdminShellProps) {
  const [activeTabId, setActiveTabId] = useState("overview");

  return (
    <div className="admin-shell" data-shell="admin">
      <a className="skip-link" href="#admin-content">
        Aller au contenu
      </a>
      <aside className="admin-sidebar">
        <a
          aria-label="Pharma Garde administration"
          className="brand"
          href="/admin"
        >
          <img alt="" height="40" src="/brand-app-icon.png" width="40" />
          <span>Pharma Garde</span>
        </a>
        <Badge tone="accent">Admin</Badge>
        <Navigation pathname={pathname} />
        <p className="admin-sidebar__note">
          Fondation de l’espace d’administration.
        </p>
      </aside>
      <header className="admin-header">
        <a
          aria-label="Pharma Garde administration"
          className="brand brand--small"
          href="/admin"
        >
          <img alt="" height="36" src="/brand-app-icon.png" width="36" />
          <span>Pharma Garde</span>
        </a>
        <details className="admin-menu">
          <summary>
            <Icon name="menu" />
            <span>Menu</span>
          </summary>
          <Navigation compact pathname={pathname} />
        </details>
        <div className="admin-header__tools">
          <Field
            aria-label="Recherche indisponible"
            disabled
            label="Recherche"
            placeholder="Recherche indisponible"
          />
          <span aria-label="Notifications" className="notification-indicator">
            <Icon name="bell" />
          </span>
        </div>
      </header>
      <main className="admin-main" id="admin-content">
        <div className="page-heading">
          <div>
            <p className="overline">Administration</p>
            <h1>Fondation de l’interface</h1>
            <p>
              Un cadre de navigation et des composants cohérents pour les
              futures surfaces.
            </p>
          </div>
          <Badge tone="neutral">Sans données</Badge>
        </div>
        <Tabs
          activeId={activeTabId}
          items={[
            { id: "overview", label: "Vue d’ensemble" },
            { id: "components", label: "Composants" },
          ]}
          label="Sections de démonstration"
          onSelectionChange={setActiveTabId}
        />
        <Card className="admin-placeholder">
          <EmptyState icon="dashboard" title="Surface prête à assembler">
            Les tableaux, flux et métriques relèvent des issues métier à venir.
          </EmptyState>
        </Card>
      </main>
    </div>
  );
}
