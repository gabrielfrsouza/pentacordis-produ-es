"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Copy, FileText, GripVertical, Link as LinkIcon, MapPin, MessageCircle, Plus, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { assessMusicianAvailability } from "@/lib/maestro/engine";
import { DURATION_BASE, DURATION_FAST, EASE_EDITORIAL } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import type {
  Equipment,
  EventEquipment,
  EventExpense,
  EventFinancialSummary,
  EventLineup,
  EventRow,
  EventSetlist,
  InviteStatus,
  Musician,
  MusicianRole,
  PaymentStatus,
  Song,
} from "@/types/database";

type Props = {
  initialEvent: EventRow;
  initialLineup: EventLineup[];
  musicians: Musician[];
  musicianRoles: MusicianRole[];
  initialSetlist: EventSetlist[];
  songs: Song[];
  equipment: Equipment[];
  initialAllocations: EventEquipment[];
  initialExpenses: EventExpense[];
  financial: EventFinancialSummary | null;
};

const tabs = ["Ordem do Dia", "Escala & Casting", "Repertório", "Logística", "Raio-X Financeiro"] as const;
type Tab = (typeof tabs)[number];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function SortableSetlistItem({
  item,
  index,
  songTitle,
  defaultKey,
}: {
  item: EventSetlist;
  index: number;
  songTitle: string;
  defaultKey: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[44px_32px_1fr] items-center gap-2 rounded-none border border-neutral-200 bg-white p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="tabular-nums grid size-8 place-items-center rounded-none bg-neutral-100 text-xs font-medium">{index + 1}</div>
      <button type="button" {...attributes} {...listeners} className="grid size-8 cursor-grab place-items-center text-neutral-400 active:cursor-grabbing" aria-label={`Reordenar ${songTitle}`}>
        <GripVertical size={16} />
      </button>
      <div>
        <p className="font-light text-lg">{songTitle}</p>
        <p className="tabular-nums mt-1 text-[11px] text-neutral-500">{item.moment_label ?? "Sem momento"} · Tom {item.event_key ?? defaultKey ?? "—"} · {item.performance_notes ?? ""}</p>
      </div>
    </article>
  );
}

export function EventWorkspace({
  initialEvent,
  initialLineup,
  musicians,
  musicianRoles,
  initialSetlist,
  songs,
  equipment,
  initialAllocations,
  initialExpenses,
  financial,
}: Props) {
  const [event, setEvent] = useState(initialEvent);
  const [tab, setTab] = useState<Tab>("Ordem do Dia");
  const [lineup, setLineup] = useState(initialLineup);
  const [setlist, setSetlist] = useState(initialSetlist);
  const [allocations, setAllocations] = useState(initialAllocations);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, string[]>>({});
  const [conflictErrors, setConflictErrors] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function saveCallSheet(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const form = new FormData(eventForm.currentTarget);
    const payload = {
      load_in_time: String(form.get("load_in_time") || "") || null,
      soundcheck_time: String(form.get("soundcheck_time") || "") || null,
      start_time: String(form.get("start_time") || "") || null,
      end_time: String(form.get("end_time") || "") || null,
      venue_name: String(form.get("venue_name") || "") || null,
      venue_address: String(form.get("venue_address") || "") || null,
      maps_url: String(form.get("maps_url") || "") || null,
      dress_code: String(form.get("dress_code") || "") || null,
      logistics_notes: String(form.get("logistics_notes") || "") || null,
    };
    const supabase = createClient();
    const result = await supabase.from("events").update(payload).eq("id", event.id).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setEvent(result.data);
    setMessage("Ordem do dia salva.");
  }

  async function copyText(text: string, success: string) {
    let copiedSuccessfully = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copiedSuccessfully = true;
      } catch {
        copiedSuccessfully = false;
      }
    }
    if (!copiedSuccessfully) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        copiedSuccessfully = document.execCommand("copy");
      } catch {
        copiedSuccessfully = false;
      } finally {
        textarea.remove();
      }
    }
    if (!copiedSuccessfully) {
      const error = "Não foi possível copiar. Abra o portal ou copie o texto manualmente.";
      setMessage(error);
      toast.error(error);
      return;
    }
    setMessage(success);
    setCopied(text);
    toast.success(success);
    window.setTimeout(() => setCopied((current) => current === text ? null : current), 2000);
  }

  async function checkMusicianConflict(musicianId: string, key: string) {
    if (!musicianId) {
      setConflicts((current) => ({ ...current, [key]: [] }));
      setConflictErrors((current) => ({ ...current, [key]: "" }));
      return;
    }
    const supabase = createClient();
    setConflictErrors((current) => ({ ...current, [key]: "" }));
    const [availabilityResult, lineupResult, backupResult] = await Promise.all([
      supabase
        .from("musician_availability")
        .select("id,musician_id,availability_date,start_time,end_time,status,notes,created_at,updated_at")
        .eq("musician_id", musicianId)
        .eq("availability_date", event.event_date),
      supabase
        .from("event_lineup")
        .select("event_id,musician_id,backup_musician_id")
        .eq("musician_id", musicianId)
        .neq("event_id", event.id),
      supabase
        .from("event_lineup")
        .select("event_id,musician_id,backup_musician_id")
        .eq("backup_musician_id", musicianId)
        .neq("event_id", event.id),
    ]);
    const queryError = availabilityResult.error ?? lineupResult.error ?? backupResult.error;
    if (queryError) {
      setConflicts((current) => ({ ...current, [key]: [] }));
      setConflictErrors((current) => ({ ...current, [key]: queryError.message }));
      return;
    }

    const lineupRows = [...(lineupResult.data ?? []), ...(backupResult.data ?? [])];
    const eventIds = Array.from(new Set(lineupRows.map((item) => item.event_id)));
    let otherEvents: Array<{ id: string; title: string; start_time: string | null; end_time: string | null }> = [];
    if (eventIds.length > 0) {
      const eventsResult = await supabase
        .from("events")
        .select("id,title,start_time,end_time")
        .in("id", eventIds)
        .eq("event_date", event.event_date)
        .neq("status", "cancelado");
      if (eventsResult.error) {
        setConflicts((current) => ({ ...current, [key]: [] }));
        setConflictErrors((current) => ({ ...current, [key]: eventsResult.error.message }));
        return;
      }
      otherEvents = eventsResult.data ?? [];
    }

    const otherEventIds = new Set(otherEvents.map((item) => item.id));
    const titleById = new Map(otherEvents.map((item) => [item.id, item.title]));
    const eventById = new Map(otherEvents.map((item) => [item.id, item]));
    const bookings = lineupRows
      .filter((item) => otherEventIds.has(item.event_id))
      .filter((item) => item.musician_id === musicianId || item.backup_musician_id === musicianId)
      .map((item) => {
        const otherEvent = eventById.get(item.event_id);
        return {
          musicianId,
          title: titleById.get(item.event_id) ?? "Outro evento",
          startTime: otherEvent?.start_time ?? null,
          endTime: otherEvent?.end_time ?? null,
        };
      });
    const assessment = assessMusicianAvailability(
      musicianId,
      availabilityResult.data ?? [],
      bookings,
      event.start_time,
      event.end_time,
    );
    setConflicts((current) => ({
      ...current,
      [key]: assessment.status === "disponivel" ? [] : assessment.reasons,
    }));
  }

  async function addLineup(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const formElement = eventForm.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      event_id: event.id,
      role_needed: String(form.get("role_needed")),
      musician_id: String(form.get("musician_id") || "") || null,
      backup_musician_id: String(form.get("backup_musician_id") || "") || null,
      invite_status: String(form.get("invite_status")) as InviteStatus,
      negotiated_fee: Number(form.get("negotiated_fee")) || null,
      payment_status: "pendente" as PaymentStatus,
      notes: String(form.get("notes") || "") || null,
    };
    const supabase = createClient();
    const result = await supabase.from("event_lineup").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setLineup((items) => [...items, result.data]);
    formElement.reset();
  }

  async function updateLineup(id: string, changes: Partial<EventLineup>) {
    const supabase = createClient();
    const result = await supabase.from("event_lineup").update(changes).eq("id", id).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setLineup((items) => items.map((item) => item.id === id ? result.data : item));
  }

  async function addSetlistSong(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const form = new FormData(eventForm.currentTarget);
    const supabase = createClient();
    const nextOrder = setlist.length;
    const payload = {
      event_id: event.id,
      song_id: String(form.get("song_id")),
      order_index: nextOrder,
      moment_label: String(form.get("moment_label") || "") || null,
      event_key: String(form.get("event_key") || "") || null,
      performance_notes: String(form.get("performance_notes") || "") || null,
    };
    const result = await supabase.from("event_setlist").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setSetlist((items) => [...items, result.data].sort((a, b) => a.order_index - b.order_index));
  }

  async function persistSetlistOrder(items: EventSetlist[]) {
    const supabase = createClient();
    return supabase.rpc("reorder_event_setlist", {
      p_event_id: event.id,
      p_ordered_ids: items.map((item) => item.id),
    });
  }

  async function handleSetlistDragEnd(dragEvent: DragEndEvent) {
    const { active, over } = dragEvent;
    if (!over || active.id === over.id) return;
    const oldIndex = setlist.findIndex((item) => item.id === active.id);
    const newIndex = setlist.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(setlist, oldIndex, newIndex).map((item, index) => ({
      ...item,
      order_index: index,
    }));
    const result = await persistSetlistOrder(reordered);
    if (result.error) { setMessage(result.error.message); return; }
    setSetlist(reordered);
    toast.success("Ordem do repertório atualizada");
  }

  async function allocateEquipment(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const form = new FormData(eventForm.currentTarget);
    const supabase = createClient();
    const payload = {
      event_id: event.id,
      equipment_id: String(form.get("equipment_id")),
      quantity_allocated: Number(form.get("quantity_allocated")) || 1,
      responsible_musician_id: String(form.get("responsible_musician_id") || "") || null,
    };
    const result = await supabase.from("event_equipment").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setAllocations((items) => [...items, result.data]);
  }

  async function updateAllocation(id: string, changes: Partial<EventEquipment>) {
    const supabase = createClient();
    const result = await supabase.from("event_equipment").update(changes).eq("id", id).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setAllocations((items) => items.map((item) => item.id === id ? result.data : item));
  }

  async function addExpense(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    const formElement = eventForm.currentTarget;
    const form = new FormData(formElement);
    const supabase = createClient();
    const payload = {
      event_id: event.id,
      category: String(form.get("category")) as EventExpense["category"],
      description: String(form.get("description")),
      amount: Number(form.get("amount")),
    };
    const result = await supabase.from("event_expenses").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setExpenses((items) => [...items, result.data]);
    formElement.reset();
  }

  async function markLineupPaid(item: EventLineup) {
    await updateLineup(item.id, { payment_status: "pago", paid_at: new Date().toISOString() });
  }

  const musiciansForRole = (role: string, selectedMusicianId: string | null) => {
    const normalizedRole = role.trim().toLowerCase();
    const matchingMusicians = musicians.filter((musician) =>
      musicianRoles.some((item) =>
        item.musician_id === musician.id &&
        item.role_name.trim().toLowerCase() === normalizedRole,
      ),
    );
    const candidates = matchingMusicians.length > 0 ? matchingMusicians : musicians;
    const selectedMusician = musicians.find((musician) => musician.id === selectedMusicianId);
    return selectedMusician && !candidates.some((musician) => musician.id === selectedMusician.id)
      ? [...candidates, selectedMusician]
      : candidates;
  };
  const callSheetText = `🎼 PENTACORDIS — ${event.title}\n📅 ${event.event_date}\n🚚 Carga: ${event.load_in_time ?? "a definir"}\n🎧 Passagem: ${event.soundcheck_time ?? "a definir"}\n▶️ Início: ${event.start_time ?? "a definir"}\n⏹️ Fim: ${event.end_time ?? "a definir"}\n📍 ${event.venue_name ?? "Local a definir"} — ${event.venue_address ?? ""}\n👔 Dress code: ${event.dress_code ?? "a definir"}\nℹ️ ${event.logistics_notes ?? ""}`;
  const publicOrigin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">{event.event_type ?? "Evento"}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold">{event.title}</h1><p className="mt-1 text-sm text-muted">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${event.event_date}T12:00:00`))}</p></div>
          <div className="flex items-center gap-3">
            <Link href={`/maestro?eventId=${event.id}`} className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs hover:border-gold/40"><Sparkles size={14} /> Maestro</Link>
            {event.contract_id ? <Link href={`/comercial/contratos/${event.contract_id}/documento`} className="inline-flex h-9 items-center gap-2 border border-border bg-white px-3 text-xs uppercase tracking-wide hover:border-black"><FileText size={14} /> Contrato PDF</Link> : null}
            <span className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold">{event.status}</span>
          </div>
        </div>
      </div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
      <nav className="mb-5 flex overflow-x-auto border-b border-neutral-200">
        {tabs.map((item) => (
          <button type="button" key={item} onClick={() => setTab(item)} aria-pressed={tab === item} className={`relative h-11 shrink-0 px-4 text-[10px] uppercase tracking-[0.16em] ${tab === item ? "text-black" : "text-neutral-400"}`}>
            {item}
            {tab === item ? (
              <motion.span
                layoutId="active-tab-line"
                className="absolute inset-x-0 bottom-0 h-px bg-black"
                transition={{ duration: DURATION_BASE, ease: EASE_EDITORIAL }}
              />
            ) : null}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: DURATION_FAST, ease: EASE_EDITORIAL }}
        >
      {tab === "Ordem do Dia" ? (
        <form onSubmit={saveCallSheet} className="grid gap-5 rounded-xl border border-border bg-surface p-5 xl:grid-cols-2">
          {[
            ["load_in_time", "Carga", "time", event.load_in_time],
            ["soundcheck_time", "Passagem de som", "time", event.soundcheck_time],
            ["start_time", "Início", "time", event.start_time],
            ["end_time", "Fim", "time", event.end_time],
            ["venue_name", "Local", "text", event.venue_name],
            ["venue_address", "Endereço", "text", event.venue_address],
            ["maps_url", "Link do Google Maps", "url", event.maps_url],
            ["dress_code", "Dress code", "text", event.dress_code],
          ].map((field) => {
            const [name, label, type, value] = field as [string, string, "text" | "time" | "url", string | null];
            return <label key={name} className="block text-sm text-muted">{label}<input name={name} type={type} defaultValue={value ?? ""} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label>;
          })}
          <label className="block text-sm text-muted xl:col-span-2">Notas de logística<textarea name="logistics_notes" defaultValue={event.logistics_notes ?? ""} rows={4} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
          <div className="flex flex-wrap gap-2 xl:col-span-2">
            <button type="submit" className="h-10 rounded-lg bg-gold px-5 text-sm font-bold text-zinc-950">Salvar ordem do dia</button>
            <button type="button" onClick={() => copyText(callSheetText, "Call Sheet copiada.")} className="flex h-10 items-center gap-2 rounded-none border border-neutral-300 px-4 text-[10px] uppercase tracking-[0.16em]">{copied === callSheetText ? <Check size={15} /> : <Copy size={15} />}Copiar Call Sheet</button>
            <button type="button" onClick={() => copyText(`${publicOrigin}/evento/${event.public_token}`, "Link do portal copiado.")} className="flex h-10 items-center gap-2 rounded-none border border-neutral-300 px-4 text-[10px] uppercase tracking-[0.16em]">{copied === `${publicOrigin}/evento/${event.public_token}` ? <Check size={15} /> : <LinkIcon size={15} />}Copiar link do portal</button>
            <Link href={`/evento/${event.public_token}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-none border border-neutral-300 px-4 text-[10px] uppercase tracking-[0.16em]"><LinkIcon size={15} />Abrir portal do cliente</Link>
            {event.maps_url ? <a href={event.maps_url} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm"><MapPin size={15} />Abrir Maps</a> : null}
          </div>
        </form>
      ) : null}

      {tab === "Escala & Casting" ? (
        <div className="space-y-5">
          <form onSubmit={addLineup} className="grid gap-3 rounded-xl border border-border bg-surface p-4 lg:grid-cols-[180px_1fr_1fr_150px_130px_44px]">
            <input name="role_needed" required placeholder="Função" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <select name="musician_id" onChange={(changeEvent) => checkMusicianConflict(changeEvent.target.value, "add")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Titular não definido</option>{musicians.map((musician) => <option key={musician.id} value={musician.id}>{musician.full_name}</option>)}</select>
            <select name="backup_musician_id" onChange={(changeEvent) => checkMusicianConflict(changeEvent.target.value, "addBackup")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Reserva não definida</option>{musicians.map((musician) => <option key={musician.id} value={musician.id}>{musician.full_name}</option>)}</select>
            <select name="invite_status" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="pendente">Pendente</option><option value="convidado">Convidado</option><option value="confirmado">Confirmado</option><option value="recusado">Recusado</option></select>
            <input name="negotiated_fee" type="number" min="0" placeholder="Cachê" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <button type="submit" className="grid h-10 place-items-center rounded-lg bg-gold text-zinc-950"><Plus size={17} /></button>
          </form>
          {(conflicts.add ?? []).length > 0 ? <div className="border-l border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900">Análise de disponibilidade do titular: {conflicts.add.join(" · ")}</div> : null}
          {conflictErrors.add ? <div role="alert" className="border-l border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">Não foi possível verificar a disponibilidade do titular: {conflictErrors.add}</div> : null}
          {(conflicts.addBackup ?? []).length > 0 ? <div className="border-l border-amber-600 bg-amber-50 px-4 py-3 text-sm text-amber-900">Análise de disponibilidade da reserva: {conflicts.addBackup.join(" · ")}</div> : null}
          {conflictErrors.addBackup ? <div role="alert" className="border-l border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900">Não foi possível verificar a disponibilidade da reserva: {conflictErrors.addBackup}</div> : null}
          {lineup.length === 0 ? <div className="grid min-h-48 place-items-center rounded-xl border border-border bg-surface text-sm text-muted">Nenhuma vaga escalada.</div> : <div className="space-y-3">
            {lineup.map((item) => {
              const roleMusicians = musiciansForRole(item.role_needed, item.musician_id);
              const backupMusicians = musiciansForRole(item.role_needed, item.backup_musician_id);
              const titular = musicians.find((musician) => musician.id === item.musician_id);
              const phone = titular?.phone?.replace(/\D/g, "") ?? "";
              const messageText = `Olá ${titular?.stage_name ?? titular?.full_name ?? ""}! Convite Pentacordis para ${event.title} em ${event.event_date}. Função: ${item.role_needed}. Cachê: ${money(Number(item.negotiated_fee ?? 0))}.`;
              return (
                <article key={item.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4 lg:grid-cols-[150px_1fr_1fr_140px_120px_44px] lg:items-center">
                  <p className="text-sm font-semibold text-gold">{item.role_needed}</p>
                  <select value={item.musician_id ?? ""} onChange={(eventChange) => { const value = eventChange.target.value || null; void checkMusicianConflict(value ?? "", item.id); void updateLineup(item.id, { musician_id: value }); }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Titular não definido</option>{roleMusicians.map((musician) => <option key={musician.id} value={musician.id}>{musician.full_name}</option>)}</select>
                  <select value={item.backup_musician_id ?? ""} onChange={(eventChange) => { const value = eventChange.target.value || null; void checkMusicianConflict(value ?? "", `${item.id}-backup`); void updateLineup(item.id, { backup_musician_id: value }); }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Reserva não definida</option>{backupMusicians.map((musician) => <option key={musician.id} value={musician.id}>{musician.full_name}</option>)}</select>
                  <select value={item.invite_status} onChange={(eventChange) => updateLineup(item.id, { invite_status: eventChange.target.value as InviteStatus })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="pendente">Pendente</option><option value="convidado">Convidado</option><option value="confirmado">Confirmado</option><option value="recusado">Recusado</option></select>
                  <input type="number" defaultValue={item.negotiated_fee ?? 0} onBlur={(eventChange) => updateLineup(item.id, { negotiated_fee: Number(eventChange.target.value) })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                  {phone ? <a href={`https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`} target="_blank" rel="noreferrer" className="grid h-10 place-items-center rounded-lg border border-emerald-500/30 text-emerald-300" title="Enviar convite no WhatsApp"><MessageCircle size={16} /></a> : <span />}
                  {(conflicts[item.id] ?? []).length > 0 ? (
                    <div className="lg:col-span-6 border-l border-black bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
                      Análise de disponibilidade do titular: {conflicts[item.id].join(" · ")}
                    </div>
                  ) : null}
                  {conflictErrors[item.id] ? <div role="alert" className="lg:col-span-6 border-l border-red-600 bg-red-50 px-4 py-3 text-xs text-red-900">A disponibilidade do titular não pôde ser verificada: {conflictErrors[item.id]}</div> : null}
                  {(conflicts[`${item.id}-backup`] ?? []).length > 0 ? <div className="lg:col-span-6 border-l border-amber-600 bg-amber-50 px-4 py-3 text-xs text-amber-900">Análise de disponibilidade da reserva: {conflicts[`${item.id}-backup`].join(" · ")}</div> : null}
                  {conflictErrors[`${item.id}-backup`] ? <div role="alert" className="lg:col-span-6 border-l border-red-600 bg-red-50 px-4 py-3 text-xs text-red-900">A disponibilidade da reserva não pôde ser verificada: {conflictErrors[`${item.id}-backup`]}</div> : null}
                </article>
              );
            })}
          </div>}
        </div>
      ) : null}

      {tab === "Repertório" ? (
        <div className="space-y-5">
          <form onSubmit={addSetlistSong} className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_150px_100px_1fr_44px]">
            <select name="song_id" required className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Selecionar música</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select>
            <input name="moment_label" placeholder="Momento" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <input name="event_key" placeholder="Tom" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <input name="performance_notes" placeholder="Notas" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <button type="submit" className="grid h-10 place-items-center rounded-lg bg-gold text-zinc-950"><Plus size={17} /></button>
          </form>
          {setlist.length === 0 ? <div className="grid min-h-48 place-items-center border border-neutral-200 text-sm text-neutral-500">Setlist vazio.</div> : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSetlistDragEnd}>
              <SortableContext items={setlist.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {setlist.map((item, index) => {
                    const song = songs.find((entry) => entry.id === item.song_id);
                    return (
                      <SortableSetlistItem
                        key={item.id}
                        item={item}
                        index={index}
                        songTitle={song?.title ?? "Música"}
                        defaultKey={song?.default_key ?? null}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      ) : null}

      {tab === "Logística" ? (
        <div className="space-y-5">
          <form onSubmit={allocateEquipment} className="grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_140px_1fr_44px]">
            <select name="equipment_id" required className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Selecionar equipamento</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <input name="quantity_allocated" type="number" min="1" defaultValue="1" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
            <select name="responsible_musician_id" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Responsável</option>{musicians.map((musician) => <option key={musician.id} value={musician.id}>{musician.full_name}</option>)}</select>
            <button type="submit" className="grid h-10 place-items-center rounded-lg bg-gold text-zinc-950"><Plus size={17} /></button>
          </form>
          {allocations.length === 0 ? <div className="grid min-h-48 place-items-center rounded-xl border border-border bg-surface text-sm text-muted">Nenhum item alocado.</div> : <div className="space-y-2">
            {allocations.map((allocation) => {
              const item = equipment.find((entry) => entry.id === allocation.equipment_id);
              return <article key={allocation.id} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_100px_120px_120px] sm:items-center"><div><p className="font-medium">{item?.name ?? "Equipamento"}</p><p className="mt-1 text-xs text-muted">Quantidade {allocation.quantity_allocated}</p></div><span /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allocation.checked_out} onChange={(eventChange) => updateAllocation(allocation.id, { checked_out: eventChange.target.checked })} className="accent-gold" />Saiu</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allocation.checked_in} onChange={(eventChange) => updateAllocation(allocation.id, { checked_in: eventChange.target.checked })} className="accent-gold" />Voltou</label></article>;
            })}
          </div>}
        </div>
      ) : null}

      {tab === "Raio-X Financeiro" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
          <aside className="space-y-4">
            <article className="rounded-xl border border-border bg-surface p-5"><p className="text-xs text-muted">Valor do contrato</p><p className="mt-2 text-2xl font-semibold text-gold">{money(financial ? Number(financial.contract_total_value) : 0)}</p></article>
            <article className="rounded-xl border border-border bg-surface p-5"><p className="text-xs text-muted">Cachês artísticos</p><p className="mt-2 text-xl font-semibold">{money(financial ? Number(financial.total_musician_fees) : 0)}</p></article>
            <article className="rounded-xl border border-border bg-surface p-5"><p className="text-xs text-muted">Despesas</p><p className="mt-2 text-xl font-semibold">{money(financial ? Number(financial.total_expenses) : 0)}</p></article>
            <article className="rounded-xl border border-emerald-500/20 bg-surface p-5"><p className="text-xs text-muted">Lucro líquido</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{money(financial ? Number(financial.net_profit) : 0)}</p><p className="mt-1 text-xs text-muted">Margem {financial ? Number(financial.net_margin_pct).toFixed(1) : "0"}%</p></article>
          </aside>
          <div className="space-y-5">
            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Repasse de cachês</h2></div>
              {lineup.map((item) => {
                const musician = musicians.find((entry) => entry.id === item.musician_id);
                return (
                  <div key={item.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0 sm:grid-cols-[1fr_110px_110px_150px] sm:items-center">
                    <div><p className="text-sm font-medium">{musician?.full_name ?? "Músico não definido"}</p><p className="mt-1 text-xs text-muted">{item.role_needed} · Pix: {musician?.pix_key ?? "não informado"}</p></div>
                    <p className="font-semibold">{money(Number(item.negotiated_fee ?? 0))}</p>
                    {musician?.pix_key ? <button type="button" onClick={() => copyText(musician.pix_key ?? "", "Chave Pix copiada.")} className="flex h-9 items-center justify-center gap-2 rounded-none border border-neutral-300 text-[10px] uppercase tracking-[0.12em]">{copied === musician.pix_key ? <Check size={14} /> : null}{copied === musician.pix_key ? "Copiada" : "Copiar Pix"}</button> : <span />}
                    {item.payment_status === "pago" ? <span className="flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-xs text-emerald-300"><Check size={14} />Pago</span> : <button type="button" onClick={() => markLineupPaid(item)} className="h-9 rounded-lg border border-gold/30 text-xs text-gold">Marcar como pago</button>}
                  </div>
                );
              })}
              {lineup.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nenhum cachê cadastrado.</p> : null}
            </section>
            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Despesas extras</h2></div>
              <form onSubmit={addExpense} className="grid gap-3 border-b border-border p-4 md:grid-cols-[150px_1fr_120px_44px]">
                <select name="category" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="frete">Frete</option><option value="alimentacao">Alimentação</option><option value="imposto">Imposto</option><option value="aluguel_som">Aluguel de som</option><option value="outros">Outros</option></select>
                <input name="description" required placeholder="Descrição" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                <input name="amount" required type="number" min="0" placeholder="Valor" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                <button type="submit" className="grid h-10 place-items-center rounded-lg bg-gold text-zinc-950"><Plus size={17} /></button>
              </form>
              {expenses.map((expense) => <div key={expense.id} className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0"><div><p className="text-sm">{expense.description}</p><p className="mt-1 text-xs text-muted">{expense.category}</p></div><p className="font-semibold">{money(Number(expense.amount))}</p></div>)}
              {expenses.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">Nenhuma despesa cadastrada.</p> : null}
            </section>
          </div>
        </div>
      ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
