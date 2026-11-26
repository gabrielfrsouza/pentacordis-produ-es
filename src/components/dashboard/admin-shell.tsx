"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { CommandPalette } from "@/components/navigation/command-palette";
import { NotificationCenter } from "@/components/notifications/notification-center";

const SIDEBAR_PREFERENCE_KEY = "pentacordis:sidebar-collapsed";
const SIDEBAR_PREFERENCE_EVENT = "pentacordis:sidebar-preference";

function subscribeToSidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, onChange);
  };
}

function getSidebarPreference() {
  return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true";
}

function getServerSidebarPreference() {
  return false;
}

export function AdminShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail: string;
}) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference,
  );

  function updateCollapsed(nextValue: boolean) {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(nextValue));
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar collapsed={collapsed} onCollapsedChange={updateCollapsed} />
      <MobileNav />
      <CommandPalette />
      <div className={`admin-content transition-[padding] duration-300 ${collapsed ? "md:pl-[76px]" : "md:pl-[248px]"}`}>
        <header className="admin-shell-header sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-neutral-200 bg-white/95 px-5 md:px-8">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-neutral-400">Central administrativa</p>
            <p className="mt-1 text-xs text-neutral-700">{userEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <SignOutButton />
          </div>
        </header>
        <main className="admin-main px-5 pb-24 pt-7 md:px-8 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
