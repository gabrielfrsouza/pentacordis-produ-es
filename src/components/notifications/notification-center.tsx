"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Check, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types/database";

function safeTarget(target: string | null) {
  return target?.startsWith("/") && !target.startsWith("//") ? target : null;
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function setNotificationRead(id: string) {
  return createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const [result, unreadResult] = await Promise.all([
        supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      if (!active) return;
      if (result.error || unreadResult.error) {
        setError(`Notificações indisponíveis: ${result.error?.message ?? unreadResult.error?.message}`);
        return;
      }
      setNotifications(result.data ?? []);
      setUnreadCount(unreadResult.count ?? 0);
      setError(null);
    }
    void load();
    return () => { active = false; };
  }, [open]);

  async function markRead(notification: Notification) {
    const result = await setNotificationRead(notification.id);
    if (result.error) {
      setError(`Não foi possível marcar como lida: ${result.error.message}`);
      return;
    }
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(count - 1, 0));
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Notificações, ${unreadCount} não lidas`} className="relative grid h-10 w-10 place-items-center border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
        <Bell size={17} />
        {unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-black px-1 text-[9px] leading-4 text-white">{unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-[80] w-[min(92vw,380px)] border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3"><p className="text-xs font-medium uppercase tracking-[0.14em]">Notificações</p><Link href="/notificacoes" onClick={() => setOpen(false)} className="text-[10px] underline underline-offset-4">Ver todas</Link></div>
          {error ? <p role="status" className="px-4 py-3 text-xs text-amber-900">{error}</p> : null}
          {!error && notifications.length === 0 ? <p className="px-4 py-8 text-center text-xs text-neutral-500">Nenhuma notificação para sua conta.</p> : null}
          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {notifications.map((notification) => {
              const target = safeTarget(notification.target_url);
              return (
                <article key={notification.id} className={`border-b border-neutral-100 px-4 py-3 last:border-0 ${notification.read_at ? "" : "bg-neutral-50"}`}>
                  <div className="flex items-start gap-3">
                    <Circle size={7} className={`mt-1.5 shrink-0 ${notification.read_at ? "text-neutral-300" : "fill-black text-black"}`} />
                    <div className="min-w-0 flex-1">
                      {target ? <Link href={target} onClick={() => setOpen(false)} className="text-sm font-medium hover:underline">{notification.title}</Link> : <p className="text-sm font-medium">{notification.title}</p>}
                      {notification.message ? <p className="mt-1 text-xs leading-5 text-neutral-600">{notification.message}</p> : null}
                      <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-neutral-400">{notification.severity} · {timestamp(notification.created_at)}</p>
                    </div>
                    {!notification.read_at ? <button type="button" onClick={() => markRead(notification)} aria-label="Marcar como lida" className="grid h-7 w-7 shrink-0 place-items-center border border-neutral-200"><Check size={13} /></button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationsManager({
  initialNotifications,
  queryError,
}: {
  initialNotifications: Notification[];
  queryError: string | null;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [error, setError] = useState(queryError);

  async function markRead(notification: Notification) {
    const result = await setNotificationRead(notification.id);
    if (result.error) {
      setError(`Não foi possível marcar como lida: ${result.error.message}`);
      return;
    }
    setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
  }

  return (
    <div>
      <div className="mb-7"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Central administrativa</p><h1 className="mt-2 font-light text-[38px] leading-none">Notificações</h1></div>
      {error ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p> : null}
      <section className="overflow-hidden border border-neutral-200 bg-white">
        {notifications.length === 0 ? <p className="px-5 py-12 text-center text-sm text-neutral-500">{error ? "Não foi possível carregar as notificações." : "Nenhuma notificação para sua conta."}</p> : notifications.map((notification) => {
          const target = safeTarget(notification.target_url);
          return (
            <article key={notification.id} className={`flex items-start gap-4 border-b border-neutral-200 px-5 py-5 last:border-0 ${notification.read_at ? "" : "bg-neutral-50"}`}>
              <Circle size={8} className={`mt-1.5 shrink-0 ${notification.read_at ? "text-neutral-300" : "fill-black text-black"}`} />
              <div className="min-w-0 flex-1">
                {target ? <Link href={target} className="font-medium hover:underline">{notification.title}</Link> : <p className="font-medium">{notification.title}</p>}
                {notification.message ? <p className="mt-1 text-sm leading-6 text-neutral-600">{notification.message}</p> : null}
                <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-neutral-400">{notification.category} · {notification.severity} · {timestamp(notification.created_at)}</p>
              </div>
              {!notification.read_at ? <button type="button" onClick={() => markRead(notification)} className="h-8 shrink-0 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.12em]">Marcar lida</button> : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
