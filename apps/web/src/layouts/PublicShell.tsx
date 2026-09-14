import { Icon, type IconName } from "../components/Icon";
import {
  Badge,
  Card,
  EmptyState,
  FeedbackState,
  Sheet,
} from "../components/primitives";

type PublicShellProps = { pathname: string };
const navigation: Array<{ href: string; icon: IconName; label: string }> = [
  { href: "/", icon: "home", label: "Accueil" },
  { href: "/enregistres", icon: "bookmark", label: "Enregistrés" },
  { href: "/contribuer", icon: "plus", label: "Contribuer" },
];
const isCurrentRoute = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

export function PublicShell({ pathname }: PublicShellProps) {
  return (
    <div className="public-shell" data-shell="public">
      <a className="skip-link" href="#public-content">
        Aller au contenu
      </a>
      <header className="public-header">
        <a aria-label="Pharma Garde, accueil" className="brand" href="/">
          <img alt="" height="40" src="/brand-app-icon.png" width="40" />
          <span>Pharma Garde</span>
        </a>
        <Badge tone="accent">Public</Badge>
      </header>
      <main className="public-main" id="public-content">
        <Card className="public-intro">
          <p className="overline">Pharma Garde</p>
          <h1>Une information de santé, accessible à tous.</h1>
          <p>
            Cette surface établit la navigation et les composants partagés de
            l’interface publique.
          </p>
        </Card>
        <Sheet title="Surface publique">
          <EmptyState icon="home" title="Écran en préparation">
            Les fonctionnalités de consultation seront ajoutées dans leurs
            issues dédiées.
          </EmptyState>
          <FeedbackState>
            Les éléments visibles ici sont des primitives de présentation ;
            aucune donnée n’est chargée.
          </FeedbackState>
        </Sheet>
      </main>
      <nav aria-label="Navigation publique" className="public-navigation">
        {navigation.map((item) => (
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
    </div>
  );
}
