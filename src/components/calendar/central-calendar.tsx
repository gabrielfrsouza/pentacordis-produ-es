"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EventRow, FinancialTransactionStatus, MusicianAvailability, ProposalStatus, Task } from "@/types/database";

type EventEntry = Pick<EventRow, "id" | "title" | "event_date" | "status">;
type ProposalEntry = { id: string; proposal_number: number; client_name: string; valid_until: string | null; status: ProposalStatus };
type TransactionEntry = { id: string; description: string; direction: "entrada" | "saida"; amount: number; due_date: string | null; status: FinancialTransactionStatus };
type AvailabilityEntry = Pick<MusicianAvailability, "id" | "musician_id" | "availability_date" | "start_time" | "status">;
type MusicianEntry = { id: string; full_name: string; stage_name: string | null };
const weekDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const kindStyles: Record<string, string> = {
  Evento: "border-black text-black",
  Proposta: "border-violet-500 text-violet-800",
  Financeiro: "border-emerald-600 text-emerald-800",
  Tarefa: "border-amber-500 text-amber-800",
  Disponibilidade: "border-sky-500 text-sky-800",
};

export function CentralCalendar({
  events,
  proposals,
  transactions,
  initialTasks,
  availability,
  musicians,
  queryErrors,
}: {
  events: EventEntry[];
  proposals: ProposalEntry[];
  transactions: TransactionEntry[];
  initialTasks: Task[];
  availability: AvailabilityEntry[];
  musicians: MusicianEntry[];
  queryErrors: string[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const entries = useMemo(() => {
    const musicianNames = new Map(musicians.map((musician) => [musician.id, musician.stage_name || musician.full_name]));
    return [
      ...events.map((event) => ({ id: `event-${event.id}`, date: event.event_date.slice(0, 10), title: event.title, detail: event.status, kind: "Evento", href: `/eventos/${event.id}` })),
      ...proposals.filter((proposal) => ["rascunho", "enviada", "visualizada"].includes(proposal.status) && proposal.valid_until).map((proposal) => ({ id: `proposal-${proposal.id}`, date: proposal.valid_until!.slice(0, 10), title: `Validade · ${proposal.client_name}`, detail: `Proposta #${proposal.proposal_number}`, kind: "Proposta", href: `/orcamentos/proposta?proposalId=${proposal.id}` })),
      ...transactions.filter((transaction) => transaction.due_date && !["cancelado", "estornado"].includes(transaction.status)).map((transaction) => ({ id: `finance-${transaction.id}`, date: transaction.due_date!.slice(0, 10), title: transaction.description, detail: `${transaction.direction === "entrada" ? "Entrada" : "Saída"} · ${money(Number(transaction.amount))}`, kind: "Financeiro", href: "/financeiro" })),
      ...tasks.filter((task) => task.due_at && !["concluida", "cancelada"].includes(task.status)).map((task) => ({ id: `task-${task.id}`, date: localDate(new Date(task.due_at!)), title: task.title, detail: `Tarefa · ${task.priority}`, kind: "Tarefa", href: "/calendario" })),
      ...availability.map((item) => {
        const status = item.status === "indisponivel" ? "Indisponível" : item.status === "preferencial" ? "Preferencial" : item.status === "consulta" ? "A confirmar" : "Disponível";
        const time = item.start_time ? ` · ${item.start_time.slice(0, 5)}` : "";
        return { id: `availability-${item.id}`, date: item.availability_date.slice(0, 10), title: musicianNames.get(item.musician_id) ?? "Músico", detail: `${status}${time}`, kind: "Disponibilidade", href: "/musicos" };
      }),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  }, [availability, events, musicians, proposals, tasks, transactions]);

  const days = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      return current;
    });
  }, [calendarMonth]);
  const selectedEntries = entries.filter((entry) => entry.date === selectedDate);

  function moveMonth(amount: -1 | 1) {
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + amount, 1);
    setCalendarMonth(next);
    setSelectedDate(localDate(next));
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const dueDate = String(values.get("due_at") ?? "");
    if (!title || !dueDate) {
      setMessage("Informe o título e o prazo da tarefa.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setSaving(false);
      setMessage(`Não foi possível confirmar o usuário: ${userError?.message ?? "sessão inválida"}`);
      return;
    }
    const result = await supabase.from("tasks").insert({
      title,
      description: String(values.get("description") || "") || null,
      due_at: new Date(dueDate).toISOString(),
      priority: String(values.get("priority")) as Task["priority"],
      status: "aberta",
      created_by: userResult.user.id,
      assigned_to: userResult.user.id,
    }).select("*").single();
    setSaving(false);
    if (result.error) {
      setMessage(`Não foi possível criar a tarefa: ${result.error.message}`);
      return;
    }
    setTasks((items) => [...items, result.data]);
    setSelectedDate(dueDate.slice(0, 10));
    setCalendarMonth(new Date(`${dueDate.slice(0, 10)}T12:00:00`));
    setCreating(false);
    form.reset();
  }

  async function completeTask(task: Task) {
    const result = await createClient()
      .from("tasks")
      .update({ status: "concluida", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .select("*")
      .single();
    if (result.error) {
      setMessage(`Não foi possível concluir a tarefa: ${result.error.message}`);
      return;
    }
    setTasks((items) => items.map((item) => item.id === task.id ? result.data : item));
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Gestão empresarial</p><h1 className="mt-2 font-light text-[38px] leading-none">Calendário central</h1></div>
        <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 bg-black px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white"><Plus size={16} /> Nova tarefa</button>
      </div>
      {queryErrors.length ? <div role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-medium">Alguns módulos estão indisponíveis para este perfil; o calendário está parcial.</p><ul className="mt-2 list-inside list-disc text-xs">{queryErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      {message ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      <div className="mb-4 flex flex-wrap gap-3 text-[9px] uppercase tracking-[0.12em]">{Object.entries(kindStyles).map(([kind, style]) => <span key={kind} className={`border-l-2 pl-2 ${style}`}>{kind}</span>)}</div>
      <section className="border border-neutral-200 bg-white">
        <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior" className="grid h-9 w-9 place-items-center"><ChevronLeft size={17} /></button>
          <h2 className="text-lg font-light capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonth)}</h2>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês" className="grid h-9 w-9 place-items-center"><ChevronRight size={17} /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-neutral-200">{weekDays.map((day) => <div key={day} className="border-r border-neutral-200 py-3 text-center text-[9px] tracking-[0.12em] text-neutral-500 last:border-r-0">{day}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const iso = localDate(day);
            const dayEntries = entries.filter((entry) => entry.date === iso);
            const outside = day.getMonth() !== calendarMonth.getMonth();
            return (
              <button type="button" key={iso} onClick={() => setSelectedDate(iso)} className={`min-h-24 border-b border-r border-neutral-200 p-2 text-left last:border-r-0 sm:min-h-32 ${outside ? "bg-neutral-50 text-neutral-300" : "bg-white"} ${selectedDate === iso ? "ring-1 ring-inset ring-black" : ""}`}>
                <span className="tabular-nums text-xs">{day.getDate()}</span>
                <span className="mt-2 block space-y-1">
                  {dayEntries.slice(0, 3).map((entry) => <span key={entry.id} className={`block truncate border-l-2 pl-1 text-[9px] leading-4 ${kindStyles[entry.kind]}`}>{entry.title}</span>)}
                  {dayEntries.length > 3 ? <span className="block text-[9px] text-neutral-500">+{dayEntries.length - 3} itens</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="mt-6 border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4"><p className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">Agenda do dia</p><h2 className="mt-1 text-lg font-light">{formatDate(selectedDate)}</h2></div>
        {selectedEntries.length === 0 ? <p className="px-5 py-8 text-sm text-neutral-500">Sem compromissos ou prazos neste dia.</p> : selectedEntries.map((entry) => {
          const task = entry.kind === "Tarefa" ? tasks.find((item) => item.id === entry.id.replace("task-", "")) : null;
          return (
            <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 last:border-0">
              <div className="min-w-0"><span className={`border-l-2 pl-2 text-[9px] uppercase tracking-[0.12em] ${kindStyles[entry.kind]}`}>{entry.kind}</span><Link href={entry.href} className="mt-1 block truncate text-sm font-medium hover:underline">{entry.title}</Link><p className="mt-1 text-xs text-neutral-500">{entry.detail}</p></div>
              {task && task.status !== "concluida" ? <button type="button" onClick={() => completeTask(task)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]">Concluir tarefa</button> : null}
            </article>
          );
        })}
      </section>
      {creating ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
        <form onSubmit={createTask} className="w-full max-w-lg border border-neutral-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-medium">Nova tarefa</h2>
          <div className="space-y-3">
            <input name="title" required placeholder="Título da tarefa" className="h-10 w-full border border-neutral-300 px-3 text-sm" />
            <input name="description" placeholder="Descrição opcional" className="h-10 w-full border border-neutral-300 px-3 text-sm" />
            <div className="grid grid-cols-2 gap-3"><input name="due_at" type="datetime-local" required className="h-10 border border-neutral-300 px-3 text-sm" /><select name="priority" defaultValue="normal" className="h-10 border border-neutral-300 bg-white px-3 text-sm"><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
          </div>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCreating(false)} className="h-10 border border-neutral-300 px-4 text-sm">Cancelar</button><button type="submit" disabled={saving} className="h-10 bg-black px-5 text-sm text-white disabled:opacity-50">{saving ? "Salvando..." : "Criar tarefa"}</button></div>
        </form>
      </div> : null}
    </div>
  );
}
