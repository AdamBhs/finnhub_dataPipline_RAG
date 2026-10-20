import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, Menu, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/chat", label: "Chat", icon: MessageCircle, badge: 3 },
];

export default function RootLayout() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const title = pathname.startsWith("/chat") ? "Market Assistant" : "Dashboard";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Overlay: always rendered so it can fade in and out */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity duration-300 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-white p-4 transition-transform duration-300 ease-out md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center gap-3 px-2 pt-2 animate-in fade-in slide-in-from-left-4 duration-500 motion-reduce:animate-none">
          <div className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-300 hover:rotate-6 hover:scale-110">
            <LayoutGrid className="size-5" />
          </div>
          <span className="text-xl font-semibold">Market</span>
        </div>

        <nav className="flex flex-col gap-2">
          {nav.map(({ to, label, icon: Icon, end, badge }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${150 + i * 100}ms` }}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500 motion-reduce:animate-none",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-600 hover:translate-x-1 hover:bg-slate-100",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar on the left edge of the sidebar */}
                  <span
                    className={cn(
                      "absolute -left-4 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-blue-500 transition-all duration-300",
                      isActive ? "h-6 opacity-100" : "h-0 opacity-0",
                    )}
                  />
                  <Icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex-1">{label}</span>
                  {badge && <Badge variant="secondary">{badge}</Badge>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-2 rounded-lg border bg-slate-50 p-3 text-sm animate-in fade-in slide-in-from-bottom-4 duration-700 motion-reduce:animate-none">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Stream: <b>Online</b>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>
          <Avatar>
            <AvatarFallback className="bg-amber-400 font-semibold">
              AD
            </AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
