"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Copy, FileText, MessageCircle, Pencil, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { ContractDocument as SharedContractDocument } from "@/components/contracts/ContractDocument";
import { createClient } from "@/lib/supabase/client";
import { formatDateLongBR } from "@/lib/format-contract";
import type { Contract, EventLineup, EventRow, Installment } from "@/types/database";

type ContractEvent = Pick<
  EventRow,
  "id" | "title" | "event_type" | "event_date" | "start_time" | "venue_name" | "venue_address"
> & {
  lineup: Pick<EventLineup, "id" | "role_needed">[];
};

type Props = {
  initialContract: Contract;
  event: ContractEvent | null;
  installments: Installment[];
};

type EditableContractFields = Pick<
  Contract,
  | "client_name"
  | "cpf_cnpj"
  | "client_address"
  | "client_phone"
  | "client_email"
  | "total_value"
  | "duration_label"
  | "included_structure"
  | "extra_hour_fee"
  | "contractor_city"
>;

export function ContractDocument({ initialContract, event, installments }: Props) {
  const [contract, setContract] = useState(initialContract);
  const [eventData, setEventData] = useState(event);
  const [installmentRows, setInstallmentRows] = useState(installments);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const canEdit = contract.status === "rascunho" && !contract.document_hash;
  const canShare = contract.status !== "cancelado" && Boolean(contract.sign_token);
  const phoneDigits = (contract.client_phone ?? "").replace(/\D/g, "");
  const eventLabel = eventData
    ? `${eventData.title} / ${formatDateLongBR(eventData.event_date)}`
    : "evento contratado";

  async function saveContractFields(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const formData = new FormData(formEvent.currentTarget);
    const clientName = String(formData.get("client_name") || "").trim();
    const totalValue = Number(formData.get("total_value"));
    const extraHourFee = Number(formData.get("extra_hour_fee"));
    if (!clientName) {
      toast.error("Informe o nome do contratante.");
      return;
    }
    if (!Number.isFinite(totalValue) || totalValue < 0) {
      toast.error("Informe um valor total válido.");
      return;
    }
    if (!Number.isFinite(extraHourFee) || extraHourFee < 0) {
      toast.error("Informe um valor válido para a hora extra.");
      return;
    }

    const changes: EditableContractFields = {
      client_name: clientName,
      cpf_cnpj: String(formData.get("cpf_cnpj") || "").trim() || null,
      client_address: String(formData.get("client_address") || "").trim() || null,
      client_phone: String(formData.get("client_phone") || "").trim() || null,
      client_email: String(formData.get("client_email") || "").trim() || null,
      total_value: totalValue,
      duration_label: String(formData.get("duration_label") || "").trim() || null,
      included_structure: String(formData.get("included_structure") || "").trim() || null,
      extra_hour_fee: extraHourFee,
      contractor_city: String(formData.get("contractor_city") || "").trim() || null,
    };
    const eventChanges = eventData
      ? {
          title: String(formData.get("event_title") || "").trim(),
          event_type: String(formData.get("event_type") || "").trim() || null,
          event_date: String(formData.get("event_date") || ""),
          start_time: String(formData.get("start_time") || "") || null,
          venue_name: String(formData.get("venue_name") || "").trim() || null,
          venue_address: String(formData.get("venue_address") || "").trim() || null,
        }
      : null;
    if (eventChanges && (!eventChanges.title || !eventChanges.event_date)) {
      toast.error("Informe o nome e a data do evento.");
      return;
    }
    const proposedInstallments = installmentRows.map((item) => ({
      id: item.id,
      amount: Number(formData.get(`installment_amount_${item.id}`)),
      dueDate: String(formData.get(`installment_due_date_${item.id}`) || ""),
    }));
    if (proposedInstallments.some((item) =>
      !Number.isFinite(item.amount) || item.amount < 0 || !item.dueDate,
    )) {
      toast.error("Confira os valores e vencimentos de todas as parcelas.");
      return;
    }
    if (
      proposedInstallments.length > 0 &&
      proposedInstallments.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) !== Math.round(totalValue * 100)
    ) {
      toast.error("A soma das parcelas precisa ser igual ao valor total do contrato.");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const contractResult = await supabase.from("contracts").update(changes).eq("id", contract.id).select("*").single();
      if (contractResult.error) {
        toast.error(`Não foi possível salvar os dados do contrato: ${contractResult.error.message}`);
        return;
      }
      setContract(contractResult.data);

      if (eventData && eventChanges) {
        const eventResult = await supabase.from("events").update(eventChanges).eq("id", eventData.id).select("*").single();
        if (eventResult.error) {
          toast.error(`Contrato salvo, mas não foi possível salvar os dados do evento: ${eventResult.error.message}`);
          return;
        }
        setEventData((current) => current ? { ...current, ...eventResult.data } : current);

        for (const lineupItem of eventData.lineup) {
          const roleNeeded = String(formData.get(`lineup_role_${lineupItem.id}`) || "").trim();
          if (roleNeeded === lineupItem.role_needed) continue;
          const lineupResult = await supabase
            .from("event_lineup")
            .update({ role_needed: roleNeeded })
            .eq("id", lineupItem.id)
            .select("id")
            .single();
          if (lineupResult.error) {
            toast.error(`Contrato e evento salvos, mas não foi possível salvar a formação: ${lineupResult.error.message}`);
            return;
          }
          setEventData((current) => current
            ? {
                ...current,
                lineup: current.lineup.map((item) =>
                  item.id === lineupItem.id ? { ...item, role_needed: roleNeeded } : item,
                ),
              }
            : current);
        }
      }

      for (const installment of proposedInstallments) {
        const currentInstallment = installmentRows.find((item) => item.id === installment.id);
        if (
          !currentInstallment ||
          (installment.amount === Number(currentInstallment.amount) && installment.dueDate === currentInstallment.due_date)
        ) continue;
        const result = await supabase
          .from("installments")
          .update({ amount: installment.amount, due_date: installment.dueDate })
          .eq("id", installment.id)
          .select("id")
          .single();
        if (result.error) {
          toast.error(`As alterações anteriores foram salvas, mas uma parcela não pôde ser atualizada: ${result.error.message}`);
          return;
        }
        setInstallmentRows((current) => current.map((item) =>
          item.id === installment.id ? { ...item, amount: installment.amount, due_date: installment.dueDate } : item,
        ));
      }

      setIsEditing(false);
      toast.success("Contrato, evento e condições de pagamento atualizados.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "falha inesperada";
      toast.error(`Não foi possível concluir as alterações: ${detail}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function markAsSigned() {
    setIsSigning(true);
    const result = await createClient()
      .from("contracts")
      .update({ status: "assinado", signed_at: new Date().toISOString() })
      .eq("id", contract.id)
      .select("*")
      .single();
    setIsSigning(false);
    if (result.error) {
      toast.error(`Não foi possível atualizar o contrato: ${result.error.message}`);
      return;
    }

    setContract(result.data);
    toast.success("Contrato marcado como assinado.");
  }

  async function copySignatureLink() {
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
      setLinkCopied(true);
      toast.success("Link de assinatura copiado.");
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar o link. Verifique a permissão da área de transferência.");
    }
  }

  function openWhatsApp() {
    if (contract.status === "cancelado") {
      toast.error("Não é possível compartilhar o link de um contrato cancelado.");
      return;
    }
    if (!phoneDigits || !contract.sign_token) {
      toast.error("Cadastre o telefone do cliente e aplique a migration para enviar o link.");
      return;
    }
    const link = `${window.location.origin}/contrato/${contract.sign_token}`;
    const message = `Olá, ${contract.client_name}! Segue o link do contrato da Pentacordis referente ao evento ${eventLabel} para leitura e assinatura eletrônica: ${link}`;
    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="contract-route -mx-5 -mt-7 min-h-screen bg-[#F5F5F5] px-5 py-8 md:-mx-8 md:px-8">
      <div className="print:hidden mx-auto mb-6 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link href="/comercial" className="inline-flex h-10 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs uppercase tracking-[0.12em] hover:border-black">
          <ArrowLeft size={15} /> Voltar
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copySignatureLink} disabled={!canShare} className="inline-flex h-10 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs uppercase tracking-[0.1em] hover:border-black disabled:opacity-50">
            {linkCopied ? <Check size={14} /> : <Copy size={14} />} {linkCopied ? "Link Copiado" : "Copiar Link de Assinatura"}
          </button>
          <button type="button" onClick={openWhatsApp} disabled={!phoneDigits || !canShare} className="inline-flex h-10 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs uppercase tracking-[0.1em] hover:border-black disabled:opacity-50">
            <MessageCircle size={14} /> Enviar no WhatsApp
          </button>
          <button type="button" onClick={() => setIsEditing(true)} disabled={!canEdit} className="inline-flex h-10 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs uppercase tracking-[0.1em] hover:border-black disabled:opacity-50">
            <Pencil size={14} /> Editar Dados do Contrato
          </button>
          <button
            type="button"
            onClick={markAsSigned}
            disabled={contract.status !== "rascunho" || isSigning}
            className="inline-flex h-10 items-center gap-2 border border-neutral-300 bg-white px-3 text-xs uppercase tracking-[0.1em] hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={14} /> {contract.status === "assinado" ? "Contrato Assinado" : contract.status === "cancelado" ? "Contrato Cancelado" : "Marcar como Assinado"}
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 bg-[#0A0A0A] px-4 text-xs font-medium uppercase tracking-[0.12em] text-white hover:bg-neutral-800">
            <Printer size={15} /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <SharedContractDocument
        contract={contract}
        event={eventData}
        installments={installmentRows}
      />

      {isEditing ? (
        <div className="print:hidden fixed inset-0 z-[80] flex justify-end bg-black/30">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar edição" onClick={() => setIsEditing(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="contract-editor-title" className="relative z-10 h-full w-full max-w-lg overflow-y-auto border-l border-[#E5E5E5] bg-white p-6">
            <div className="mb-6 flex items-start justify-between border-b border-[#E5E5E5] pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Dados complementares</p>
                <h2 id="contract-editor-title" className="mt-1 font-display text-2xl">Editar contrato</h2>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setIsEditing(false)} className="grid size-9 place-items-center border border-[#E5E5E5]"><X size={16} /></button>
            </div>
            <form onSubmit={saveContractFields} className="space-y-6">
              <section className="space-y-4">
                <h3 className="border-b border-[#E5E5E5] pb-2 text-xs font-semibold uppercase tracking-wide">Contratante e valores</h3>
                <label className="block text-xs uppercase tracking-wide">Nome do contratante
                  <input name="client_name" required defaultValue={contract.client_name} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                </label>
                <label className="block text-xs uppercase tracking-wide">CPF/CNPJ
                  <input name="cpf_cnpj" defaultValue={contract.cpf_cnpj ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                </label>
                <label className="block text-xs uppercase tracking-wide">Endereço do contratante
                  <input name="client_address" defaultValue={contract.client_address ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-wide">Telefone
                    <input name="client_phone" defaultValue={contract.client_phone ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                  <label className="block text-xs uppercase tracking-wide">E-mail
                    <input name="client_email" type="email" defaultValue={contract.client_email ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-wide">Valor total (R$)
                    <input name="total_value" type="number" min="0" step="0.01" required defaultValue={contract.total_value} className="tabular-nums mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                  <label className="block text-xs uppercase tracking-wide">Cidade no fechamento
                    <input name="contractor_city" defaultValue={contract.contractor_city ?? "Recife / PE"} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                </div>
              </section>

              {eventData ? (
                <section className="space-y-4">
                  <h3 className="border-b border-[#E5E5E5] pb-2 text-xs font-semibold uppercase tracking-wide">Evento e formação</h3>
                  <label className="block text-xs uppercase tracking-wide">Nome do evento
                    <input name="event_title" required defaultValue={eventData.title} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs uppercase tracking-wide">Tipo de evento
                      <input name="event_type" defaultValue={eventData.event_type ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                    </label>
                    <label className="block text-xs uppercase tracking-wide">Data
                      <input name="event_date" type="date" required defaultValue={eventData.event_date} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs uppercase tracking-wide">Horário de início
                      <input name="start_time" type="time" defaultValue={eventData.start_time?.slice(0, 5) ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                    </label>
                    <label className="block text-xs uppercase tracking-wide">Local
                      <input name="venue_name" defaultValue={eventData.venue_name ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                    </label>
                  </div>
                  <label className="block text-xs uppercase tracking-wide">Endereço do evento
                    <input name="venue_address" defaultValue={eventData.venue_address ?? ""} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                  </label>
                  {eventData.lineup.map((item, index) => (
                    <label key={item.id} className="block text-xs uppercase tracking-wide">Função {index + 1}
                      <input name={`lineup_role_${item.id}`} required defaultValue={item.role_needed} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                    </label>
                  ))}
                </section>
              ) : null}

              <section className="space-y-4">
                <h3 className="border-b border-[#E5E5E5] pb-2 text-xs font-semibold uppercase tracking-wide">Duração, estrutura e condições</h3>
                <label className="block text-xs uppercase tracking-wide">Duração da apresentação
                  <input name="duration_label" defaultValue={contract.duration_label ?? "Até 1h30 de apresentação"} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                </label>
                <label className="block text-xs uppercase tracking-wide">Estrutura inclusa
                  <textarea name="included_structure" rows={3} defaultValue={contract.included_structure ?? "Sonorização compatível com o ambiente, microfonação da equipe e direção musical em cena"} className="mt-1 w-full border border-[#E5E5E5] px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
                <label className="block text-xs uppercase tracking-wide">Valor da hora extra (R$)
                  <input name="extra_hour_fee" type="number" min="0" step="0.01" required defaultValue={contract.extra_hour_fee ?? 450} className="tabular-nums mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                </label>
              </section>

              {installmentRows.length > 0 ? (
                <section className="space-y-4">
                  <h3 className="border-b border-[#E5E5E5] pb-2 text-xs font-semibold uppercase tracking-wide">Parcelas e vencimentos</h3>
                  {installmentRows.map((item) => (
                    <div key={item.id} className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs uppercase tracking-wide">Parcela {item.installment_number} · valor (R$)
                        <input name={`installment_amount_${item.id}`} type="number" min="0" step="0.01" required defaultValue={item.amount} className="tabular-nums mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                      </label>
                      <label className="block text-xs uppercase tracking-wide">Vencimento
                        <input name={`installment_due_date_${item.id}`} type="date" required defaultValue={item.due_date} className="mt-1 h-10 w-full border border-[#E5E5E5] px-3 text-sm normal-case tracking-normal" />
                      </label>
                    </div>
                  ))}
                </section>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-[#E5E5E5] pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="h-10 border border-[#E5E5E5] px-4 text-xs uppercase tracking-wide">Cancelar</button>
                <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 bg-[#0A0A0A] px-4 text-xs uppercase tracking-wide text-white disabled:opacity-50">
                  <FileText size={14} /> {isSaving ? "Salvando..." : "Salvar contrato"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
