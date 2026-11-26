import Link from "next/link";
import type { ActivityLog } from "@/types/database";

type ActivityEntry = Pick<ActivityLog, "id" | "actor_user_id" | "action" | "resource" | "resource_id" | "description" | "created_at">;

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function label(value: string) {
  const labels: Record<string, string> = {
    insert: "Criado",
    update: "Atualizado",
    delete: "Removido",
    leads: "Lead",
    contracts: "Contrato",
    events: "Evento",
    proposals: "Proposta",
    financial_transactions: "Lançamento financeiro",
    equipment_assets: "Patrimônio",
    equipment_maintenance: "Manutenção",
    tasks: "Tarefa",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function target(entry: ActivityEntry) {
  if (!entry.resource_id) return null;
  if (entry.resource === "events") return `/eventos/${entry.resource_id}`;
  if (entry.resource === "proposals") return `/orcamentos/proposta?proposalId=${entry.resource_id}`;
  if (entry.resource === "financial_transactions") return "/financeiro";
  if (entry.resource === "equipment_assets" || entry.resource === "equipment_maintenance") return "/equipamentos";
  if (entry.resource === "tasks") return "/calendario";
  return null;
}

export function ActivityManager({ entries, queryError }: { entries: ActivityEntry[]; queryError: string | null }) {
  return (
    <div>
      <div className="mb-7"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Auditoria</p><h1 className="mt-2 font-light text-[38px] leading-none">Histórico de atividades</h1></div>
      {queryError ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{queryError}</p> : null}
      <section className="border border-neutral-200 bg-white">
        {entries.length === 0 ? <p className="px-5 py-12 text-center text-sm text-neutral-500">{queryError ? "Os registros não foram tratados como uma lista vazia: corrija a permissão ou tente novamente." : "Ainda não há alterações registradas."}</p> : entries.map((entry) => {
          const href = target(entry);
          return (
            <article key={entry.id} className="grid gap-2 border-b border-neutral-200 px-5 py-4 last:border-0 sm:grid-cols-[150px_1fr_auto] sm:items-center">
              <p className="text-xs tabular-nums text-neutral-500">{date(entry.created_at)}</p>
              <div><p className="text-sm font-medium">{label(entry.action)} · {label(entry.resource)}</p><p className="mt-1 text-xs text-neutral-600">{entry.description ?? "Atividade registrada"}</p><p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-neutral-400">{entry.actor_user_id ? "Usuário autenticado" : "Sistema"}</p></div>
              {href ? <Link href={href} className="text-[9px] uppercase tracking-[0.12em] underline underline-offset-4">Abrir registro</Link> : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}
