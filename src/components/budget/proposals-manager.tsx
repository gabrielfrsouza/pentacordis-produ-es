"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmCascadeDelete } from "@/lib/confirm-cascade-delete";
import type { ProposalStatus } from "@/types/database";

type SavedProposal = {
  id: string;
  proposal_number: number;
  client_name: string;
  event_type: string | null;
  event_date: string | null;
  total_value: number;
  status: ProposalStatus;
  valid_until: string | null;
  created_at: string;
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "A definir";
}

export function ProposalsManager({ initialProposals }: { initialProposals: SavedProposal[] }) {
  const [proposals, setProposals] = useState(initialProposals);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function markAsSent(proposal: SavedProposal) {
    setSavingId(proposal.id);
    setMessage(null);
    const result = await createClient()
      .from("proposals")
      .update({ status: "enviada", sent_at: new Date().toISOString() })
      .eq("id", proposal.id)
      .eq("status", "rascunho")
      .select("id,proposal_number,client_name,event_type,event_date,total_value,status,valid_until,created_at")
      .single();
    setSavingId(null);
    if (result.error) {
      setMessage(`Não foi possível atualizar a proposta: ${result.error.message}`);
      return;
    }
    setProposals((items) => items.map((item) => item.id === proposal.id ? result.data : item));
  }

  async function removeProposal(proposal: SavedProposal) {
    setDeletingId(proposal.id);
    setMessage(null);
    const supabase = createClient();
    const confirmed = await confirmCascadeDelete(
      supabase,
      "proposals",
      proposal.id,
      `proposta #${proposal.proposal_number}`,
      setMessage,
    );
    if (!confirmed) {
      setDeletingId(null);
      return;
    }
    const result = await supabase.rpc("delete_proposal_cascade", { p_proposal_id: proposal.id });
    setDeletingId(null);
    if (result.error) {
      setMessage(`Não foi possível excluir a proposta: ${result.error.message}`);
      return;
    }
    setProposals((items) => items.filter((item) => item.id !== proposal.id));
    setMessage(`Proposta #${proposal.proposal_number} e itens vinculados excluídos.`);
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Comercial</p>
          <h1 className="mt-2 font-light text-[38px] leading-none">Propostas salvas</h1>
        </div>
        <Link href="/orcamentos" className="flex h-10 items-center gap-2 bg-black px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white">
          <Plus size={15} /> Novo orçamento
        </Link>
      </div>
      {message ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      <div className="overflow-hidden border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[.65fr_1.2fr_1fr_.8fr_.8fr_.7fr_190px] gap-3 border-b border-neutral-200 px-5 py-3 text-[9px] uppercase tracking-[0.16em] text-neutral-500 lg:grid">
          <span>Número</span><span>Cliente</span><span>Evento</span><span>Data</span><span>Validade</span><span>Valor</span><span />
        </div>
        {proposals.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileText className="mx-auto text-neutral-400" size={24} />
            <p className="mt-4 text-sm">Ainda não há propostas salvas.</p>
            <p className="mt-1 text-xs text-neutral-500">Crie uma pelo simulador para manter o histórico e abrir o PDF novamente.</p>
          </div>
        ) : proposals.map((proposal) => (
          <article key={proposal.id} className="grid gap-3 border-b border-neutral-200 px-5 py-4 last:border-0 lg:grid-cols-[.65fr_1.2fr_1fr_.8fr_.8fr_.7fr_190px] lg:items-center">
            <p className="text-xs text-neutral-500">#{proposal.proposal_number}</p>
            <div><p className="font-medium">{proposal.client_name}</p><p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-neutral-500">{proposal.status}</p></div>
            <p className="text-sm text-neutral-600">{proposal.event_type ?? "Evento"}</p>
            <p className="text-sm text-neutral-600">{date(proposal.event_date)}</p>
            <p className="text-sm text-neutral-600">{date(proposal.valid_until)}</p>
            <p className="tabular-nums text-sm">{money(Number(proposal.total_value))}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/orcamentos/proposta?proposalId=${proposal.id}`} className="flex h-9 items-center border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.12em] hover:border-black">Abrir PDF</Link>
              {proposal.status === "rascunho" ? (
                <button type="button" disabled={savingId === proposal.id} onClick={() => markAsSent(proposal)} className="h-9 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.12em] disabled:opacity-50">
                  {savingId === proposal.id ? "Salvando..." : "Marcar enviada"}
                </button>
              ) : null}
              <button type="button" disabled={deletingId === proposal.id} onClick={() => void removeProposal(proposal)} title="Excluir proposta e itens" aria-label={`Excluir proposta ${proposal.proposal_number}`} className="grid size-9 place-items-center text-neutral-400 transition-colors hover:text-red-700 disabled:opacity-40">
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
