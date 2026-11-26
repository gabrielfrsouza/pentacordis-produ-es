"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Copy, FileText, MessageCircle, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmCascadeDelete } from "@/lib/confirm-cascade-delete";
import { formatDateLongBR, formatDateTimeRecifeBR } from "@/lib/format-contract";
import type { Contract, EventRow, Installment, Lead, LeadStatus } from "@/types/database";
import { EditorialEmpty } from "@/components/ui/editorial-empty";

type Props = {
  initialLeads: Lead[];
  initialContracts: Contract[];
  initialInstallments: Installment[];
  initialEvents: Pick<EventRow, "contract_id" | "title" | "event_date">[];
  initialTab?: "leads" | "contracts";
  openLeadModalOnLoad?: boolean;
};

const statuses: LeadStatus[] = ["novo", "proposta", "fechado", "perdido"];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function CommercialManager({
  initialLeads,
  initialContracts,
  initialInstallments,
  initialEvents,
  initialTab = "leads",
  openLeadModalOnLoad = false,
}: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [contracts, setContracts] = useState(initialContracts);
  const [installments, setInstallments] = useState(initialInstallments);
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<LeadStatus | "todos">("todos");
  const [tab, setTab] = useState<"leads" | "contracts">(initialTab);
  const [leadModal, setLeadModal] = useState(openLeadModalOnLoad);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredLeads = useMemo(
    () => leads.filter((lead) => filter === "todos" || lead.status === filter),
    [leads, filter],
  );

  const receivables = installments
    .filter((installment) => installment.status !== "pago")
    .reduce((sum, installment) => sum + Number(installment.amount), 0);

  async function copySignatureLink(contract: Contract) {
    if (contract.status === "cancelado") {
      toast.error("Não é possível compartilhar o link de um contrato cancelado.");
      return;
    }
    if (!contract.sign_token) {
      toast.error("O link estará disponível após aplicar a migration de assinatura eletrônica.");
      return;
    }

    try {
      await navigator.clipboard.writeText(`${window.location.origin}/contrato/${contract.sign_token}`);
      setCopiedContractId(contract.id);
      toast.success("Link de assinatura copiado.");
      window.setTimeout(() => setCopiedContractId((current) => current === contract.id ? null : current), 1800);
    } catch {
      toast.error("Não foi possível copiar o link. Verifique a permissão da área de transferência.");
    }
  }

  function sendSignatureLinkOnWhatsApp(contract: Contract) {
    const phone = (contract.client_phone ?? "").replace(/\D/g, "");
    if (contract.status === "cancelado") {
      toast.error("Não é possível compartilhar o link de um contrato cancelado.");
      return;
    }
    if (!phone || !contract.sign_token) {
      toast.error("Cadastre o telefone do cliente e aplique a migration para enviar o link.");
      return;
    }

    const event = events.find((item) => item.contract_id === contract.id);
    const eventLabel = event ? `${event.title} / ${formatDateLongBR(event.event_date)}` : "evento contratado";
    const signatureLink = `${window.location.origin}/contrato/${contract.sign_token}`;
    const message = `Olá, ${contract.client_name}! Segue o link do contrato da Pentacordis referente ao evento ${eventLabel} para leitura e assinatura eletrônica: ${signatureLink}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      phone: String(form.get("phone") || "") || null,
      email: String(form.get("email") || "") || null,
      event_type: String(form.get("event_type") || "") || null,
      event_date: String(form.get("event_date") || "") || null,
      status: String(form.get("status")) as LeadStatus,
      estimated_value: Number(form.get("estimated_value")) || null,
      notes: String(form.get("notes") || "") || null,
    };
    const supabase = createClient();
    const result = await supabase.from("leads").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setLeads((items) => [result.data, ...items]);
    setLeadModal(false);
    setMessage("Lead cadastrado.");
  }

  async function updateLeadStatus(lead: Lead, status: LeadStatus) {
    const supabase = createClient();
    const result = await supabase.from("leads").update({ status }).eq("id", lead.id).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setLeads((items) => items.map((item) => item.id === lead.id ? result.data : item));
  }

  async function removeLead(lead: Lead) {
    setDeletingId(lead.id);
    setMessage(null);
    const supabase = createClient();
    const confirmed = await confirmCascadeDelete(supabase, "leads", lead.id, lead.name, setMessage);
    if (!confirmed) {
      setDeletingId(null);
      return;
    }
    const relatedContractIds = contracts.filter((item) => item.lead_id === lead.id).map((item) => item.id);
    const result = await supabase.rpc("delete_lead_cascade", { p_lead_id: lead.id });
    setDeletingId(null);
    if (result.error) {
      setMessage(`Não foi possível excluir o lead: ${result.error.message}`);
      return;
    }
    const contractIds = new Set(relatedContractIds);
    setLeads((items) => items.filter((item) => item.id !== lead.id));
    setContracts((items) => items.filter((item) => !contractIds.has(item.id)));
    setInstallments((items) => items.filter((item) => !contractIds.has(item.contract_id)));
    setEvents((items) => items.filter((item) => !item.contract_id || !contractIds.has(item.contract_id)));
    setMessage("Lead e registros comerciais vinculados excluídos.");
    router.refresh();
  }

  async function convertLead(lead: Lead) {
    const supabase = createClient();
    const result = await supabase.rpc("convert_lead_to_contract_and_event", { p_lead_id: lead.id });
    if (result.error) { setMessage(result.error.message); return; }
    setContracts((items) => [result.data.contract, ...items.filter((item) => item.id !== result.data.contract.id)]);
    setEvents((items) => [{
      contract_id: result.data.event.contract_id,
      title: result.data.event.title,
      event_date: result.data.event.event_date,
    }, ...items.filter((item) => item.contract_id !== result.data.contract.id)]);
    setLeads((items) => items.map((item) => item.id === lead.id ? { ...item, status: "fechado" } : item));
    setMessage(`Lead convertido em contrato e evento ${result.data.event.id}.`);
  }

  async function removeContract(contract: Contract) {
    setDeletingId(contract.id);
    setMessage(null);
    const supabase = createClient();
    const confirmed = await confirmCascadeDelete(
      supabase,
      "contracts",
      contract.id,
      `contrato de ${contract.client_name}`,
      setMessage,
    );
    if (!confirmed) {
      setDeletingId(null);
      return;
    }
    const result = await supabase.rpc("delete_contract_cascade", { p_contract_id: contract.id });
    setDeletingId(null);
    if (result.error) {
      setMessage(`Não foi possível excluir o contrato: ${result.error.message}`);
      return;
    }
    setContracts((items) => items.filter((item) => item.id !== contract.id));
    setInstallments((items) => items.filter((item) => item.contract_id !== contract.id));
    setEvents((items) => items.filter((item) => item.contract_id !== contract.id));
    setMessage("Contrato e registros vinculados excluídos.");
    router.refresh();
  }

  async function markPaid(installment: Installment) {
    const supabase = createClient();
    const result = await supabase.from("installments").update({
      status: "pago",
      paid_at: new Date().toISOString(),
    }).eq("id", installment.id).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setInstallments((items) => items.map((item) => item.id === installment.id ? result.data : item));
  }

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Pipeline</p><h1 className="mt-2 text-2xl font-semibold">Comercial & Contratos</h1></div>
        <button type="button" onClick={() => setLeadModal(true)} className="flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-bold text-zinc-950"><Plus size={17} /><span className="hidden sm:inline">Novo lead</span></button>
      </div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
      <div className="mb-5 flex gap-2 border-b border-border">
        <button type="button" onClick={() => setTab("leads")} className={`h-10 border-b-2 px-2 text-sm ${tab === "leads" ? "border-gold text-gold" : "border-transparent text-muted"}`}>Leads</button>
        <button type="button" onClick={() => setTab("contracts")} className={`h-10 border-b-2 px-2 text-sm ${tab === "contracts" ? "border-gold text-gold" : "border-transparent text-muted"}`}>Contratos & Parcelas</button>
      </div>

      {tab === "leads" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(["todos", ...statuses] as const).map((status) => (
              <button type="button" key={status} onClick={() => setFilter(status)} className={`h-9 rounded-lg border px-3 text-xs ${filter === status ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"}`}>{status}</button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLeads.length === 0 ? <div className="col-span-full border border-neutral-200"><EditorialEmpty title="Nenhum lead encontrado" description="Comece um novo relacionamento comercial." action={<button type="button" onClick={() => setLeadModal(true)} className="border-b border-black pb-1 text-[10px] font-medium uppercase tracking-[0.18em]">Novo lead</button>} /></div> : filteredLeads.map((lead) => (
              <article key={lead.id} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{lead.name}</p><p className="mt-1 text-xs text-muted">{lead.event_type ?? "Tipo a definir"} · {lead.event_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${lead.event_date}T12:00:00`)) : "Sem data"}</p></div><span className="rounded-full border border-border px-2 py-1 text-[10px] text-gold">{lead.status}</span></div>
                <p className="mt-5 text-xl font-semibold">{money(Number(lead.estimated_value ?? 0))}</p>
                {lead.notes ? <p className="mt-2 line-clamp-2 text-xs text-muted">{lead.notes}</p> : null}
                <div className="mt-5 flex gap-2">
                  <select value={lead.status} onChange={(event) => updateLeadStatus(lead, event.target.value as LeadStatus)} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs"><option value="novo">Novo</option><option value="proposta">Proposta</option><option value="fechado">Fechado</option><option value="perdido">Perdido</option></select>
                  {lead.status !== "fechado" ? <button type="button" onClick={() => convertLead(lead)} className="h-9 rounded-lg bg-gold px-3 text-xs font-bold text-zinc-950">Converter</button> : null}
                  <button type="button" disabled={deletingId === lead.id} onClick={() => void removeLead(lead)} title="Excluir lead e registros vinculados" aria-label={`Excluir lead ${lead.name}`} className="grid size-9 shrink-0 place-items-center text-muted transition-colors hover:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <>
          <section className="mb-6 rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Contratos</h2></div>
            {contracts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">Nenhum contrato cadastrado.</p>
            ) : (
              <div className="divide-y divide-border">
                {contracts.map((contract) => (
                  <div key={contract.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{contract.client_name}</p>
                        {contract.document_hash ? (
                          <span title={`Assinado eletronicamente em ${contract.signed_at ? formatDateTimeRecifeBR(contract.signed_at) : "data indisponível"}`} aria-label="Assinado eletronicamente" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700">
                            <Check size={13} /> E-assinado
                          </span>
                        ) : null}
                      </div>
                      <p className="tabular-nums mt-1 text-xs text-muted">{contract.id.slice(0, 8).toUpperCase()} · {contract.status} · {money(Number(contract.total_value))}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => copySignatureLink(contract)} disabled={!contract.sign_token || contract.status === "cancelado"} className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs uppercase tracking-wide hover:border-black disabled:opacity-50">
                        {copiedContractId === contract.id ? <Check size={13} /> : <Copy size={13} />} {copiedContractId === contract.id ? "Link Copiado" : "Copiar Link"}
                      </button>
                      <button type="button" onClick={() => sendSignatureLinkOnWhatsApp(contract)} disabled={!contract.client_phone || !contract.sign_token || contract.status === "cancelado"} className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs uppercase tracking-wide hover:border-black disabled:opacity-50">
                        <MessageCircle size={13} /> WhatsApp
                      </button>
                      <Link href={`/comercial/contratos/${contract.id}/documento`} className="inline-flex h-9 items-center gap-2 border border-border px-3 text-xs uppercase tracking-wide hover:border-black">
                        <FileText size={14} /> Contrato PDF
                      </Link>
                      <button type="button" disabled={deletingId === contract.id} onClick={() => void removeContract(contract)} title="Excluir contrato e registros vinculados" aria-label={`Excluir contrato de ${contract.client_name}`} className="grid size-9 place-items-center text-muted transition-colors hover:text-red-400 disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <article className="h-fit rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Resumo de recebíveis</h2><ReceiptText size={18} className="text-gold" /></div>
              <p className="mt-5 text-3xl font-semibold">{money(receivables)}</p><p className="mt-1 text-xs text-muted">Parcelas pendentes e atrasadas</p>
            </article>
            <section className="rounded-xl border border-border bg-surface">
              <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Parcelas</h2></div>
              {installments.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Nenhuma parcela cadastrada.</p> : <div className="divide-y divide-border">{installments.map((installment) => (
                <div key={installment.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_120px_110px] sm:items-center">
                  <div><p className="text-sm font-medium">{contracts.find((contract) => contract.id === installment.contract_id)?.client_name ?? "Contrato"}</p><p className="mt-1 text-xs text-muted">Parcela {installment.installment_number} · venc. {new Intl.DateTimeFormat("pt-BR").format(new Date(`${installment.due_date}T12:00:00`))}</p></div>
                  <p className="font-semibold">{money(Number(installment.amount))}</p>
                  {installment.status === "pago" ? <span className="flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 text-xs text-emerald-300"><Check size={14} />Pago</span> : <button type="button" onClick={() => markPaid(installment)} className="h-9 rounded-lg border border-gold/30 text-xs text-gold hover:bg-gold/10">Marcar pago</button>}
                </div>
              ))}</div>}
            </section>
          </div>
        </>
      )}

      {leadModal ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5"><form onSubmit={saveLead} className="w-full max-w-md rounded-xl border border-border bg-white p-6"><h2 className="mb-5 text-lg font-semibold">Novo lead</h2><div className="space-y-3"><label className="block text-sm">Nome<input name="name" required className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label><div className="grid grid-cols-2 gap-3"><input name="phone" placeholder="Telefone" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /><input name="email" type="email" placeholder="E-mail" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></div><div className="grid grid-cols-2 gap-3"><input name="event_type" placeholder="Tipo do evento" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /><input name="event_date" type="date" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></div><div className="grid grid-cols-2 gap-3"><select name="status" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="novo">Novo</option><option value="proposta">Proposta</option><option value="fechado">Fechado</option><option value="perdido">Perdido</option></select><input name="estimated_value" type="number" placeholder="Valor estimado" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></div><textarea name="notes" placeholder="Observações" rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setLeadModal(false)} className="h-10 rounded-lg border border-border px-4 text-sm">Cancelar</button><button type="submit" className="h-10 rounded-lg bg-gold px-5 text-sm font-bold text-zinc-950">Salvar</button></div></form></div> : null}
    </div>
  );
}
