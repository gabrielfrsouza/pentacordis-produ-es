"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, CalendarDays, CalendarRange, ChartNoAxesCombined, ChevronDown, History, LayoutDashboard, Library, Lightbulb, MoreHorizontal, Package, ReceiptText, Users, Wallet, WalletCards } from "lucide-react";

const primaryNavigation = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Comercial", href: "/comercial", icon: ReceiptText },
  { label: "Eventos", href: "/eventos", icon: CalendarDays },
  { label: "Músicos", href: "/musicos", icon: Users },
];

const moreNavigation = [
  { label: "Orçamentos", href: "/orcamentos", icon: WalletCards },
  { label: "Agenda central", href: "/calendario", icon: CalendarRange },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Acervo", href: "/acervo", icon: Library },
  { label: "Maestro", href: "/maestro", icon: Lightbulb },
  { label: "Equipamentos", href: "/equipamentos", icon: Package },
  { label: "Notificações", href: "/notificacoes", icon: Bell },
  { label: "Atividades", href: "/atividade", icon: History },
  { label: "Relatórios", href: "/relatorios", icon: ChartNoAxesCombined },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreNavigation.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Fechar menu Mais" className="absolute inset-0 bg-black/20" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-3 bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto border border-neutral-200 bg-white p-2 shadow-lg">
            {moreNavigation.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex min-h-12 items-center gap-3 px-4 text-sm ${active ? "bg-neutral-100 text-black" : "text-neutral-600"}`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
      <nav aria-label="Navegação principal" className="admin-mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-neutral-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {primaryNavigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] ${active ? "text-black" : "text-neutral-400"}`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-label="Mais módulos"
          className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] ${moreActive || moreOpen ? "text-black" : "text-neutral-400"}`}
        >
          <span className="flex items-center gap-0.5"><MoreHorizontal size={17} /><ChevronDown size={11} /></span>
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
