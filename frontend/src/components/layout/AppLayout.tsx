// ─── App Layout (components/layout/AppLayout.tsx) ────────────────────────────
// Sidebar con grupos de navegación por plataforma + topbar shell.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  DatabaseZap, Upload, List, LogOut, User,
  Table2, ChevronRight, ChevronDown
} from "lucide-react";
import { useAuth } from "@/modules/auth/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Estructura de navegación por grupos de plataforma ────────────────────────

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface NavGroup {
  label: string;      // nombre del grupo (plataforma)
  color: string;      // color accent del grupo
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "General",
    color: "text-muted-foreground",
    items: [
      { to: "/import-jobs", icon: List,   label: "Jobs de Importación" },
      { to: "/upload",      icon: Upload, label: "Subir Archivo" },
    ],
  },
  {
    label: "Dropi",
    color: "text-violet-400",
    items: [
      { to: "/staging?template=DROPI_ORDER", icon: Table2,        label: "Ver Datos" },
      // { to: "/staging/dropi/orders", icon: PackageSearch, label: "Órdenes" },
    ],
  },
];

// El ítem de "Ver Datos" de Dropi apunta a /staging/dropi sin jobId
// Los demás ítems son para futuras sub-secciones

export function AppLayout() {
  const { user, logout } = useAuth();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <div className="flex h-screen bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="flex w-58 flex-col border-r border-border bg-background" style={{ width: "232px" }}>
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <DatabaseZap className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Data Hub</span>
        </div>

        {/* Navigation — grupos */}
        <nav className="flex-1 overflow-y-auto thin-scroll py-3 space-y-4">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups[group.label];
            return (
              <div key={group.label}>
                {/* Group header */}
                <div 
                  className={cn(
                    "flex items-center gap-1.5 px-4 mb-1 cursor-pointer hover:opacity-80 transition-opacity",
                    group.label === "General" ? "hidden" : ""
                  )}
                  onClick={() => toggleGroup(group.label)}
                >
                  {isCollapsed ? (
                    <ChevronRight className={cn("h-3 w-3 shrink-0", group.color)} />
                  ) : (
                    <ChevronDown className={cn("h-3 w-3 shrink-0", group.color)} />
                  )}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    group.color
                  )}>
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border/60 ml-1" />
                </div>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 px-2">
                    {group.items.map(({ to, icon: Icon, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            isActive
                              ? group.label === "General"
                                ? "bg-primary/10 text-primary font-medium"
                                : "bg-violet-500/10 text-violet-400 font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
