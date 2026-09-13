import { PRODUCT_TIME_ZONE } from "@wanzila/domain";

export function App() {
  return (
    <main className="foundation">
      <img
        className="foundation__icon"
        src="/brand-app-icon.png"
        alt=""
        width="88"
        height="88"
      />
      <p className="foundation__eyebrow">Pharma Garde</p>
      <h1>Le socle est prêt.</h1>
      <p>
        L’interface publique et le back-office seront construits à partir des
        issues GitHub. Fuseau produit&nbsp;: {PRODUCT_TIME_ZONE}.
      </p>
    </main>
  );
}
