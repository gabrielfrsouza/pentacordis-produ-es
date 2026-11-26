"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { DURATION_BASE, EASE_EDITORIAL } from "@/lib/motion";
import { EditorialEmpty } from "@/components/ui/editorial-empty";
import { createClient } from "@/lib/supabase/client";
import type { EventRow, EventStatus } from "@/types/database";

export function EventsManager({
  initialEvents,
  openCreateOnLoad = false,
}: {
  initialEvents: EventRow[];
  openCreateOnLoad?: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<"todos" | "futuros" | "passados" | string>("todos");
  const [creating, setCreating] = useState(openCreateOnLoad);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => events.filter((event) => {
    if (filter === "futuros") return event.event_date >= today;
    if (filter === "passados") return event.event_date < today;
    if (filter !== "todos") return event.event_type === filter;
    return true;
  }), [events, filter, today]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const payload = {
      title: String(form.get("title")),
      event_type: String(form.get("event_type")),
      event_date: String(form.get("event_date")),
      venue_name: String(form.get("venue_name") || "") || null,
      venue_address: String(form.get("venue_address") || "") || null,
      status: String(form.get("status")) as EventStatus,
    };
    const result = await supabase.from("events").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setEvents((items) => [result.data, ...items]);
    setCreating(false);
  }

  const eventTypes = Array.from(new Set(events.map((event) => event.event_type).filter((value): value is string => Boolean(value))));

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarMonth]);

  function moveMonth(direction: -1 | 1) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Produção</p><h1 className="mt-2 font-light text-[38px] leading-none">Central de Eventos</h1></div>
        <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 rounded-none bg-black px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white"><Plus size={17} /><span className="hidden sm:inline">Novo evento</span></button>
      </div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-red-200">{message}</div> : null}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {["todos", "futuros", "passados", ...eventTypes].map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-9 rounded-none border-b px-2 text-[10px] uppercase tracking-[0.16em] ${filter === item ? "border-black text-black" : "border-transparent text-neutral-400"}`}>{item}</button>)}
        </div>
        <div className="relative flex border-b border-neutral-200">
          {(["lista", "calendario"] as const).map((item) => (
            <button type="button" key={item} onClick={() => setView(item)} className={`relative h-9 px-3 text-[10px] uppercase tracking-[0.16em] ${view === item ? "text-black" : "text-neutral-400"}`}>
              {item}
              {view === item ? <motion.span layoutId="events-view-line" className="absolute inset-x-0 -bottom-px h-px bg-black" transition={{ duration: DURATION_BASE, ease: EASE_EDITORIAL }} /> : null}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? <EditorialEmpty title="Nenhum evento encontrado" description="Ajuste os filtros ou crie uma nova produção." /> : view === "lista" ? <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((event) => (
          <Link href={`/eventos/${event.id}`} key={event.id} className="bg-white p-6 transition-colors duration-500 hover:bg-neutral-50">
            <div className="flex items-start justify-between"><CalendarDays size={17} className="text-neutral-400" /><span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-neutral-500"><span className="h-1.5 w-1.5 rounded-full bg-neutral-700" />{event.status}</span></div>
            <h2 className="mt-6 font-light text-2xl">{event.title}</h2>
            <p className="tabular-nums mt-2 text-xs text-neutral-500">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${event.event_date}T12:00:00`))}</p>
            <p className="mt-4 truncate text-xs text-neutral-500">{event.venue_name ?? "Local a definir"}</p>
          </Link>
        ))}
      </div> : (
        <section className="border border-neutral-200">
          <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
            <button type="button" onClick={() => moveMonth(-1)} className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Anterior</button>
            <h2 className="tabular-nums font-light text-xl">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonth)}</h2>
            <button type="button" onClick={() => moveMonth(1)} className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Próximo</button>
          </div>
          <div className="grid grid-cols-7 border-b border-neutral-200">
            {["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map((day) => <div key={day} className="border-r border-neutral-200 px-2 py-3 text-center text-[9px] uppercase tracking-[0.16em] text-neutral-400 last:border-r-0">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const dayEvents = filtered.filter((event) => event.event_date === iso);
              const outside = date.getMonth() !== calendarMonth.getMonth();
              return (
                <div key={iso} className={`min-h-28 border-b border-r border-neutral-200 p-2 last:border-r-0 ${outside ? "bg-neutral-50 text-neutral-300" : "bg-white"}`}>
                  <p className="tabular-nums text-xs">{date.getDate()}</p>
                  <div className="mt-2 space-y-1">
                    {dayEvents.map((event) => <Link key={event.id} href={`/eventos/${event.id}`} className="block border-l border-black pl-2 text-[10px] leading-4 text-neutral-700">{event.title}</Link>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {creating ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5">
        <form onSubmit={createEvent} className="w-full max-w-md rounded-xl border border-border bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold">Novo evento</h2>
          <div className="space-y-3">
            <input name="title" required placeholder="Título" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <div className="grid grid-cols-2 gap-3"><select name="event_type" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option>Casamento</option><option>Corporativo</option><option>Missa</option><option>Concerto</option><option>Outro</option></select><input name="event_date" type="date" required className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></div>
            <input name="venue_name" placeholder="Local" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <input name="venue_address" placeholder="Endereço" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <select name="status" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="planejamento">Planejamento</option><option value="escalado">Escalado</option><option value="concluido">Concluído</option><option value="cancelado">Cancelado</option></select>
          </div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="h-10 rounded-lg border border-border px-4 text-sm">Cancelar</button><button type="submit" className="h-10 rounded-lg bg-gold px-5 text-sm font-bold text-zinc-950">Criar</button></div>
        </form>
      </div> : null}
    </div>
  );
}
