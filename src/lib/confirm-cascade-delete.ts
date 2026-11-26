import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type DeletableResource = "events" | "leads" | "contracts" | "proposals" | "songs";

const dependencyLabels: Record<DeletableResource, Record<string, string>> = {
  events: {
    lineup: "vaga(s) na escala",
    equipment: "alocação(ões) de equipamento",
    expenses: "despesa(s)",
    setlist: "música(s) no repertório",
    checklist: "item(ns) de checklist",
    tasks: "tarefa(s)",
  },
  leads: {
    contracts: "contrato(s)",
    signed_contracts: "contrato(s) assinado(s) com documento/auditoria",
    proposals: "orçamento(s)/proposta(s)",
    events: "evento(s)",
    tasks: "tarefa(s)",
  },
  contracts: {
    signed_contracts: "contrato(s) assinado(s) com documento/auditoria",
    installments: "parcela(s)",
    events: "evento(s)",
    proposals: "orçamento(s)/proposta(s)",
    tasks: "tarefa(s)",
  },
  proposals: {
    items: "item(ns) do orçamento",
  },
  songs: {
    setlist_entries: "seleção(ões) em repertórios de eventos",
    assets: "arquivo(s) do acervo",
    recommendations: "recomendação(ões) do Maestro",
  },
};

export async function confirmCascadeDelete(
  supabase: SupabaseClient<Database>,
  resource: DeletableResource,
  id: string,
  label: string,
  onError: (message: string) => void,
): Promise<boolean> {
  const preview = await supabase.rpc("preview_delete_dependencies", {
    p_resource: resource,
    p_record_id: id,
  });
  if (preview.error) {
    onError(`Não foi possível verificar os vínculos antes da exclusão: ${preview.error.message}`);
    return false;
  }

  const details: string[] = [];
  const data = preview.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    for (const [key, description] of Object.entries(dependencyLabels[resource])) {
      const count = data[key];
      if (typeof count === "number" && count > 0) {
        details.push(`${count} ${description}`);
      }
    }
    const preservedTransactions = data.transactions_preserved;
    if (typeof preservedTransactions === "number" && preservedTransactions > 0) {
      details.push(
        `${preservedTransactions} lançamento(s) financeiro(s) serão preservados e desvinculados para manter o histórico de auditoria`,
      );
    }
  }

  const impact = details.length > 0
    ? `Vínculos encontrados:\n- ${details.join("\n- ")}`
    : "Nenhum vínculo dependente foi encontrado.";
  return window.confirm(
    `Excluir "${label}" permanentemente?\n\n${impact}\n\nA exclusão dos dados vinculados é irreversível.`,
  );
}
