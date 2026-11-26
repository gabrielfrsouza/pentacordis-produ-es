"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Copy, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

type RoleFee = { id: number; role: string; fee: number };

const templates: Array<{ name: string; roles: string[] }> = [
  { name: "Pocket Receptivo", roles: ["soprano", "tenor", "piano"] },
  { name: "Gala Cerimonial", roles: ["soprano", "contralto", "tenor", "baixo", "piano", "violino"] },
  { name: "Espetáculo", roles: ["soprano", "contralto", "tenor", "baixo", "piano", "violino", "violoncelo", "trompete", "flauta", "tecnico_som"] },
];

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value);
}

function AnimatedMoney({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);

  useEffect(() => {
    const start = displayRef.current;
    const difference = value - start;
    const startedAt = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min((now - startedAt) / 550, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + difference * eased;
      displayRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <motion.span key={Math.round(value)} initial={{ opacity: 0.55 }} animate={{ opacity: 1 }} className="tabular-nums">{money(display)}</motion.span>;
}

export function BudgetSimulator() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleFee[]>([
    { id: 1, role: "soprano", fee: 900 },
    { id: 2, role: "tenor", fee: 850 },
  ]);
  const [logistics, setLogistics] = useState(1000);
  const [margin, setMargin] = useState(30);
  const [tax, setTax] = useState(6);
  const [clientName, setClientName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("Casamento");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [leadId, setLeadId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [approvedEventId, setApprovedEventId] = useState<string | null>(null);
  const [savingProposal, setSavingProposal] = useState(false);

  const artisticCost = roles.reduce((sum, role) => sum + role.fee, 0);
  const directCost = artisticCost + logistics;
  const producerProfit = directCost * (margin / 100);
  const taxValue = (directCost + producerProfit) * (tax / 100);
  const finalPrice = directCost + producerProfit + taxValue;

  const roleIds = useMemo(() => {
    let next = 10;
    return () => next++;
  }, []);

  function loadTemplate(template: (typeof templates)[number]) {
    setRoles(template.roles.map((role) => ({ id: roleIds(), role, fee: role === "tecnico_som" ? 650 : 800 })));
  }

  function addRole() {
    setRoles((items) => [...items, { id: roleIds(), role: "contralto", fee: 800 }]);
  }

  async function copySummary() {
    const summary = [
      "PENTACORDIS",
      eventTitle ? eventTitle : "Proposta artística",
      eventDate ? `Data: ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${eventDate}T12:00:00`))}` : null,
      venue ? `Local: ${venue}` : null,
      "",
      `Investimento: ${money(finalPrice)}`,
      "Formação proposta:",
      ...roles.map((role) => `• ${role.role}`),
    ].filter((line): line is string => Boolean(line)).join("\n");
    await navigator.clipboard.writeText(summary);
    setMessage("Resumo copiado para a área de transferência.");
    toast.success("Resumo copiado para WhatsApp");
  }

  async function saveAndOpenProposal() {
    if (!clientName.trim() || !eventTitle.trim() || !eventDate) {
      setMessage("Informe cliente, título e data do evento antes de salvar a proposta.");
      return;
    }

    setSavingProposal(true);
    setMessage(null);
    const expires = new Date();
    expires.setDate(expires.getDate() + 15);
    const validUntil = `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, "0")}-${String(expires.getDate()).padStart(2, "0")}`;
    const items: Json = [
      ...roles.map((role, index) => ({
        item_type: "cache",
        description: role.role,
        quantity: 1,
        unit_price: role.fee,
        sort_order: index,
        metadata: {},
      })),
      ...(finalPrice > artisticCost
        ? [{
            item_type: "producao",
            description: "Logística, gestão e tributos",
            quantity: 1,
            unit_price: Number((finalPrice - artisticCost).toFixed(2)),
            sort_order: roles.length,
            metadata: {},
          }]
        : []),
    ];
    const proposal: Json = {
      lead_id: leadId || null,
      client_name: clientName.trim(),
      client_document: cpfCnpj || null,
      event_type: eventType,
      event_date: eventDate,
      venue_name: venue || null,
      subtotal: directCost,
      discount_amount: 0,
      producer_margin_pct: margin,
      tax_pct: tax,
      total_value: finalPrice,
      valid_until: validUntil,
    };
    try {
      const result = await createClient().rpc("save_proposal", {
        p_proposal_id: null,
        p_proposal: proposal,
        p_items: items,
      });
      if (result.error) {
        setMessage(`Não foi possível salvar a proposta: ${result.error.message}`);
        toast.error("Falha ao salvar a proposta");
        return;
      }
      router.push(`/orcamentos/proposta?proposalId=${result.data}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "falha inesperada";
      setMessage(`Não foi possível salvar a proposta: ${detail}`);
      toast.error("Falha ao salvar a proposta");
    } finally {
      setSavingProposal(false);
    }
  }

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientName || !eventTitle || !eventDate) {
      setMessage("Informe cliente, título e data do evento.");
      return;
    }
    const supabase = createClient();
    const roster: Json = roles.map((role) => ({
      role_needed: role.role,
      fee: role.fee,
    }));
    const result = await supabase.rpc("approve_budget_and_create_event", {
      p_lead_id: leadId || null,
      p_client_name: clientName,
      p_cpf_cnpj: cpfCnpj || null,
      p_total_value: finalPrice,
      p_margin_pct: margin,
      p_tax_pct: tax,
      p_event_title: eventTitle,
      p_event_type: eventType,
      p_event_date: eventDate,
      p_venue_name: venue || null,
      p_roles: roster,
    });
    if (result.error) {
      const ambiguousRpc = result.error.message.toLowerCase().includes("could not choose the best candidate function");
      const permissionDenied = result.error.message.includes("Usuário sem permissão para converter proposta em evento");
      setMessage(ambiguousRpc
        ? "O Supabase encontrou versões duplicadas da função de aprovação. Aplique a migration 009_remove_approve_budget_rpc_overload.sql e tente novamente."
        : permissionDenied
          ? "Sua conta precisa de um perfil ativo com permissão para inserir contratos e eventos (comercial, admin ou proprietário). Confira user_roles e role_permissions no Supabase."
          : `Não foi possível aprovar o orçamento: ${result.error.message}`);
      return;
    }
    setApprovedEventId(String(result.data));
    setMessage("Contrato, evento e escala criados com sucesso.");
  }

  return (
    <div>
      <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Comercial</p><h1 className="mt-2 text-2xl font-semibold">Motor de Orçamentos</h1></div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
      {approvedEventId ? <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><span className="flex items-center gap-2"><CheckCircle2 size={17} />Evento criado</span><a href={`/eventos/${approvedEventId}`} className="text-xs font-semibold underline">Abrir evento</a></div> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {templates.map((template) => <button type="button" key={template.name} onClick={() => loadTemplate(template)} className="h-9 rounded-lg border border-border px-3 text-xs text-muted hover:border-gold/40 hover:text-gold">{template.name} · {template.roles.length}</button>)}
      </div>

      <form onSubmit={approve} className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">1. Cachês artísticos</h2><button type="button" onClick={addRole} className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-gold"><Plus size={14} />Vaga</button></div>
            <div className="space-y-2">
              {roles.map((role) => <div key={role.id} className="grid grid-cols-[1fr_130px_36px] gap-2">
                <input value={role.role} onChange={(event) => setRoles((items) => items.map((item) => item.id === role.id ? { ...item, role: event.target.value } : item))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                <input type="number" min="0" value={role.fee} onChange={(event) => setRoles((items) => items.map((item) => item.id === role.id ? { ...item, fee: Number(event.target.value) } : item))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                <button type="button" onClick={() => setRoles((items) => items.filter((item) => item.id !== role.id))} className="grid place-items-center text-red-300"><Trash2 size={16} /></button>
              </div>)}
            </div>
            <div className="mt-4 border-t border-border pt-4 text-sm"><span className="text-muted">Soma dos cachês</span><strong className="float-right">{money(artisticCost)}</strong></div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-semibold">2. Logística e infraestrutura</h2>
            <label className="block text-sm text-muted">Custos externos<input type="number" min="0" value={logistics} onChange={(event) => setLogistics(Number(event.target.value))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
          </section>

          <section className="grid gap-5 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-2 flex justify-between"><span>3. Margem da produtora</span><strong className="text-gold">{margin}%</strong></span><input type="range" min="0" max="100" value={margin} onChange={(event) => setMargin(Number(event.target.value))} className="w-full accent-gold" /></label>
            <label className="block text-sm"><span className="mb-2 flex justify-between"><span>4. Imposto / NF</span><strong className="text-gold">{tax}%</strong></span><input type="range" min="0" max="30" value={tax} onChange={(event) => setTax(Number(event.target.value))} className="w-full accent-gold" /></label>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-4 font-semibold">Dados da aprovação</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={clientName} onChange={(event) => setClientName(event.target.value)} required placeholder="Nome do cliente" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} placeholder="CPF/CNPJ" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} required placeholder="Título do evento" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option>Casamento</option><option>Corporativo</option><option>Missa</option><option>Concerto</option><option>Outro</option></select>
              <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Local" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
              <input value={leadId} onChange={(event) => setLeadId(event.target.value)} placeholder="UUID do lead (opcional)" className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:col-span-2" />
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-gold/20 bg-surface p-5 xl:sticky xl:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Composição do preço</p>
          <div className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between text-muted"><span>Cachês artísticos</span><strong>{money(artisticCost)}</strong></div>
            <div className="flex justify-between text-muted"><span>Logística/infraestrutura</span><strong>{money(logistics)}</strong></div>
            <div className="border-t border-border pt-4 flex justify-between"><span>Custo direto</span><strong>{money(directCost)}</strong></div>
            <div className="flex justify-between text-neutral-700"><span>Lucro líquido da produtora</span><strong><AnimatedMoney value={producerProfit} /></strong></div>
            <div className="flex justify-between text-muted"><span>Imposto / NF ({tax}%)</span><strong>{money(taxValue)}</strong></div>
          </div>
          <div className="mt-6 border-t border-gold/20 pt-5"><p className="text-xs text-muted">Preço final ao cliente</p><p className="mt-2 text-3xl font-semibold text-gold"><AnimatedMoney value={finalPrice} /></p></div>
          <button type="button" onClick={copySummary} className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-none border border-neutral-300 text-[10px] uppercase tracking-[0.16em] text-neutral-700"><Copy size={16} />Gerar resumo para cliente</button>
          <button type="button" onClick={saveAndOpenProposal} disabled={savingProposal} className="mt-3 h-11 w-full border border-black text-[10px] font-medium uppercase tracking-[0.18em] disabled:opacity-50">{savingProposal ? "Salvando..." : "Salvar e abrir proposta"}</button>
          <Link href="/orcamentos/propostas" className="mt-3 block text-center text-xs text-muted underline underline-offset-4">Ver propostas salvas</Link>
          <button type="submit" className="mt-3 h-11 w-full rounded-lg bg-gold text-sm font-bold text-zinc-950 hover:bg-gold-hover">Aprovar e criar contrato + evento</button>
        </aside>
      </form>
    </div>
  );
}
