// ─── App Layout (components/layout/AppLayout.tsx) ────────────────────────────
// Sidebar + topbar shell for all authenticated pages.
// ─────────────────────────────────────────────────────────────────────────────

import { NavLink, Outlet } from "react-router-dom";
import { DatabaseZap, Upload, List, LogOut, User } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/import-jobs", icon: List, label: "Jobs de Importación" },
  { to: "/upload", icon: Upload, label: "Subir Archivo" },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="flex w-56 flex-col border-r border-border bg-background">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <DatabaseZap className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Data Hub</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border px-2 py-3">
          <div className="flex items-center gap-2.5 rounded-md px-3 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{user?.username}</p>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wider">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto thin-scroll p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
