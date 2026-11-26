"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CashflowMonthly, EventRow, FinancialTransaction, FinancialTransactionStatus } from "@/types/database";

type EventOption = Pick<EventRow, "id" | "title">;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "Sem data";
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const statusLabels: Record<FinancialTransactionStatus, string> = {
  previsto: "Previsto",
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export function FinancialManager({
  initialTransactions,
  initialCashflow,
  events,
  queryError,
}: {
  initialTransactions: FinancialTransaction[];
  initialCashflow: CashflowMonthly[];
  events: EventOption[];
  queryError: string | null;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState(queryError);
  const [saving, setSaving] = useState(false);
  const currentMonth = today().slice(0, 7);
  const currentFlow = initialCashflow.find((entry) => entry.month.slice(0, 7) === currentMonth);
  const pendingTotal = useMemo(
    () => transactions.filter((item) => item.direction === "entrada" && ["previsto", "pendente", "atrasado"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0),
    [transactions],
  );

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const amount = Number(values.get("amount"));
    const description = String(values.get("description") ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !description) {
      setMessage("Informe uma descrição e um valor maior que zero.");
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
    const result = await supabase.from("financial_transactions").insert({
      direction: String(values.get("direction")) as FinancialTransaction["direction"],
      category: String(values.get("category")),
      description,
      amount,
      competence_date: String(values.get("competence_date")),
      due_date: String(values.get("due_date") || "") || null,
      event_id: String(values.get("event_id") || "") || null,
      status: "pendente",
      source_type: "manual",
      created_by: userResult.user.id,
      notes: String(values.get("notes") || "") || null,
    }).select("*").single();
    setSaving(false);
    if (result.error) {
      setMessage(`Não foi possível criar o lançamento: ${result.error.message}`);
      return;
    }
    setTransactions((items) => [result.data, ...items]);
    form.reset();
    setCreating(false);
    router.refresh();
  }

  async function markAsPaid(transaction: FinancialTransaction) {
    const now = new Date().toISOString();
    const result = await createClient()
      .from("financial_transactions")
      .update({ status: "pago", paid_at: now, updated_at: now })
      .eq("id", transaction.id)
      .select("*")
      .single();
    if (result.error) {
      setMessage(`Não foi possível marcar como pago: ${result.error.message}`);
      return;
    }
    setTransactions((items) => items.map((item) => item.id === transaction.id ? result.data : item));
    router.refresh();
  }

  async function cancelTransaction(transaction: FinancialTransaction) {
    if (!window.confirm(`Cancelar o lançamento "${transaction.description}"?`)) return;
    const now = new Date().toISOString();
    const result = await createClient()
      .from("financial_transactions")
      .update({ status: "cancelado", updated_at: now })
      .eq("id", transaction.id)
      .select("*")
      .single();
    if (result.error) {
      setMessage(`Não foi possível cancelar o lançamento: ${result.error.message}`);
      return;
    }
    setTransactions((items) => items.map((item) => item.id === transaction.id ? result.data : item));
    router.refresh();
  }

  async function reverseTransaction(transaction: FinancialTransaction) {
    const reason = window.prompt("Motivo do estorno:");
    if (!reason?.trim()) return;
    try {
      const supabase = createClient();
      const result = await supabase.rpc("reverse_financial_transaction", {
        p_transaction_id: transaction.id,
        p_reason: reason.trim(),
      });
      if (result.error) {
        setMessage(`Não foi possível estornar o lançamento: ${result.error.message}`);
        return;
      }
      const [original, reversal] = await Promise.all([
        supabase.from("financial_transactions").select("*").eq("id", transaction.id).single(),
        supabase.from("financial_transactions").select("*").eq("id", result.data).single(),
      ]);
      if (original.error || reversal.error) {
        setMessage(`Estorno criado, mas a lista não foi atualizada: ${original.error?.message ?? reversal.error?.message}`);
        return;
      }
      setTransactions((items) => [reversal.data, original.data, ...items.filter((item) => item.id !== transaction.id)]);
      router.refresh();
    } catch (error) {
      setMessage(`Não foi possível concluir o estorno: ${error instanceof Error ? error.message : "falha inesperada"}`);
    }
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Gestão empresarial</p><h1 className="mt-2 font-light text-[38px] leading-none">Centro financeiro</h1></div>
        <button type="button" onClick={() => setCreating(true)} className="flex h-10 items-center gap-2 bg-black px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white"><Plus size={16} /> Novo lançamento</button>
      </div>
      {message ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      <div className="mb-6 grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
        <Metric label="Entradas no mês" value={money(Number(currentFlow?.inflows ?? 0))} />
        <Metric label="Saídas no mês" value={money(Number(currentFlow?.outflows ?? 0))} />
        <Metric label="A receber (registros carregados)" value={money(pendingTotal)} />
      </div>
      <section className="overflow-hidden border border-neutral-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] items-center border-b border-neutral-200 px-5 py-4"><h2 className="font-medium">Lançamentos</h2><span className="text-xs text-neutral-500">{transactions.length} registros recentes</span></div>
        {transactions.length === 0 ? <p className="px-5 py-12 text-center text-sm text-neutral-500">Nenhum lançamento disponível para este perfil.</p> : transactions.map((item) => {
          const income = item.direction === "entrada";
          return (
            <article key={item.id} className="grid gap-3 border-b border-neutral-200 px-5 py-4 last:border-0 md:grid-cols-[minmax(0,1.4fr)_0.7fr_0.7fr_0.7fr_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center ${income ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                <div className="min-w-0"><p className="truncate text-sm font-medium">{item.description}</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-neutral-500">{item.category.replaceAll("_", " ")} · competência {date(item.competence_date)}</p></div>
              </div>
              <p className="tabular-nums text-sm">{money(Number(item.amount))}</p>
              <p className="text-xs text-neutral-500">Venc. {date(item.due_date)}</p>
              <span className={`w-fit text-[10px] uppercase tracking-[0.12em] ${item.status === "atrasado" ? "text-rose-700" : item.status === "pago" ? "text-emerald-700" : "text-neutral-500"}`}>{statusLabels[item.status]}</span>
              <div className="flex flex-wrap gap-2">
                {["previsto", "pendente", "atrasado"].includes(item.status) ? <button type="button" onClick={() => markAsPaid(item)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]">Marcar pago</button> : null}
                {item.status === "pago" ? <button type="button" onClick={() => reverseTransaction(item)} className="h-8 border border-rose-200 px-3 text-[9px] uppercase tracking-[0.1em] text-rose-800">Estornar</button> : null}
                {["previsto", "pendente", "atrasado"].includes(item.status) ? <button type="button" onClick={() => cancelTransaction(item)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]">Cancelar</button> : null}
              </div>
            </article>
          );
        })}
      </section>
      {creating ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
          <form onSubmit={createTransaction} className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-neutral-200 bg-white p-6">
            <h2 className="mb-5 text-lg font-medium">Novo lançamento financeiro</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">Tipo<select name="direction" className="mt-1 h-10 w-full border border-neutral-300 bg-white px-3"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
              <label className="text-sm">Categoria<input name="category" required placeholder="Ex.: cachê, aluguel" className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
              <label className="text-sm sm:col-span-2">Descrição<input name="description" required className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
              <label className="text-sm">Valor<input name="amount" type="number" min="0.01" step="0.01" required className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
              <label className="text-sm">Evento (opcional)<select name="event_id" defaultValue="" className="mt-1 h-10 w-full border border-neutral-300 bg-white px-3"><option value="">Sem vínculo</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
              <label className="text-sm">Competência<input name="competence_date" type="date" required defaultValue={today()} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
              <label className="text-sm">Vencimento<input name="due_date" type="date" className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
              <label className="text-sm sm:col-span-2">Observações<textarea name="notes" rows={3} className="mt-1 w-full border border-neutral-300 px-3 py-2" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCreating(false)} className="h-10 border border-neutral-300 px-4 text-sm">Cancelar</button><button type="submit" disabled={saving} className="h-10 bg-black px-5 text-sm text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar lançamento"}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-5"><p className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">{label}</p><p className="mt-3 tabular-nums text-xl">{value}</p></div>;
}
