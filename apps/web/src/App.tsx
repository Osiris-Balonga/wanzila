import { AdminShell } from "./layouts/AdminShell";
import { PublicShell } from "./layouts/PublicShell";

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function App() {
  const pathname =
    typeof window === "undefined" ? "/" : window.location.pathname;

  return isAdminPath(pathname) ? (
    <AdminShell pathname={pathname} />
  ) : (
    <PublicShell pathname={pathname} />
  );
}
