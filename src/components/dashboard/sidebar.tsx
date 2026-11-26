"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChartNoAxesCombined,
  Bell,
  History,
  LayoutDashboard,
  Library,
  Lightbulb,
  Package,
  ReceiptText,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DURATION_BASE, EASE_EDITORIAL } from "@/lib/motion";

const navigation = [
  { label: "Torre de Controle", href: "/", icon: LayoutDashboard },
  { label: "Comercial", href: "/comercial", icon: ReceiptText },
  { label: "Orçamentos", href: "/orcamentos", icon: WalletCards },
  { label: "Eventos", href: "/eventos", icon: CalendarDays },
  { label: "Agenda central", href: "/calendario", icon: CalendarRange },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Músicos", href: "/musicos", icon: Users },
  { label: "Acervo", href: "/acervo", icon: Library },
  { label: "Maestro", href: "/maestro", icon: Lightbulb },
  { label: "Equipamentos", href: "/equipamentos", icon: Package },
  { label: "Notificações", href: "/notificacoes", icon: Bell },
  { label: "Atividades", href: "/atividade", icon: History },
  { label: "Relatórios", href: "/relatorios", icon: ChartNoAxesCombined },
];

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`admin-sidebar ${collapsed ? "w-[76px]" : "w-[248px]"} fixed inset-y-0 left-0 z-40 hidden border-r border-neutral-200 bg-white transition-[width] duration-500 md:flex md:flex-col`}
    >
      <div className="flex h-[96px] items-center justify-center">
        {collapsed ? <BrandMark variant="black" size="sm" /> : <BrandLogo variant="black" size="sm" />}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 items-center rounded-none px-3 text-sm transition-colors duration-500 ${
                active
                  ? "bg-neutral-50 text-black"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-black"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="sidebar-active-indicator"
                  className="absolute -left-3 h-5 w-px bg-black"
                  transition={{ duration: DURATION_BASE, ease: EASE_EDITORIAL }}
                />
              ) : null}
              <Icon size={18} className="shrink-0" />
              {!collapsed ? <span className="ml-3">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="m-3 flex h-10 items-center justify-center rounded-lg border border-border text-neutral-500 hover:bg-neutral-100"
        aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
        aria-expanded={!collapsed}
      >
        <ChevronLeft size={17} className={collapsed ? "rotate-180" : ""} />
      </button>
    </aside>
  );
}
