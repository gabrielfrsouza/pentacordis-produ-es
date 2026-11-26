import Link from "next/link";
import type { CashflowMonthly, EventReadiness } from "@/types/database";

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function month(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function completion(event: EventReadiness) {
  const parts = [
    event.required_roles ? Math.min(event.confirmed_musicians / event.required_roles, 1) : 1,
    event.songs_selected > 0 ? 1 : 0,
    event.equipment_items > 0 ? 1 : 0,
    event.required_tasks_open === 0 ? 1 : 0,
  ];
  return Math.round(parts.reduce((sum, item) => sum + item, 0) / parts.length * 100);
}

export function ManagementReports({
  cashflow,
  readiness,
  queryErrors,
}: {
  cashflow: CashflowMonthly[];
  readiness: EventReadiness[];
  queryErrors: string[];
}) {
  const rows = [...cashflow].reverse();
  const maxFlow = Math.max(1, ...rows.flatMap((entry) => [Number(entry.inflows), Number(entry.outflows)]));

  return (
    <div>
      <div className="mb-7"><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Inteligência gerencial</p><h1 className="mt-2 font-light text-[38px] leading-none">Relatórios</h1></div>
      {queryErrors.length ? <div role="status" className="mb-5 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-medium">Relatório parcial; há dados que seu perfil não pode consultar.</p><ul className="mt-2 list-inside list-disc text-xs">{queryErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      <section className="mb-8 border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4"><h2 className="font-medium">Fluxo de caixa por competência</h2><p className="mt-1 text-xs text-neutral-500">Entradas e saídas não canceladas ou estornadas.</p></div>
        {rows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-neutral-500">{queryErrors.some((error) => error.startsWith("fluxo")) ? "O fluxo de caixa não pôde ser carregado." : "Sem movimentações no período disponível."}</p> : <div className="divide-y divide-neutral-100">
          {rows.map((entry) => (
            <div key={entry.month} className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_1fr_180px] sm:items-center">
              <p className="text-sm capitalize">{month(entry.month)}</p>
              <div className="space-y-2">
                <Bar label="Entradas" amount={Number(entry.inflows)} max={maxFlow} color="bg-emerald-700" />
                <Bar label="Saídas" amount={Number(entry.outflows)} max={maxFlow} color="bg-rose-700" />
              </div>
              <div className="text-right"><p className="text-[9px] uppercase tracking-[0.12em] text-neutral-500">Saldo</p><p className="mt-1 tabular-nums text-sm">{money(Number(entry.net))}</p></div>
            </div>
          ))}
        </div>}
      </section>

      <section className="border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4"><div><h2 className="font-medium">Prontidão de eventos</h2><p className="mt-1 text-xs text-neutral-500">Escala, repertório, equipamentos e tarefas obrigatórias.</p></div><Link href="/calendario" className="text-[9px] uppercase tracking-[0.12em] underline underline-offset-4">Abrir calendário</Link></div>
        {readiness.length === 0 ? <p className="px-5 py-10 text-center text-sm text-neutral-500">{queryErrors.some((error) => error.startsWith("prontidão")) ? "Os indicadores de prontidão não puderam ser carregados." : "Nenhum evento disponível."}</p> : readiness.map((event) => {
          const percent = completion(event);
          return (
            <article key={event.event_id} className="grid gap-3 border-b border-neutral-200 px-5 py-4 last:border-0 sm:grid-cols-[1.3fr_1fr_100px] sm:items-center">
              <Link href={`/eventos/${event.event_id}`} className="text-sm font-medium hover:underline">{event.title}<span className="mt-1 block text-xs font-normal text-neutral-500">{month(event.event_date)} · {event.status}</span></Link>
              <div className="text-xs leading-5 text-neutral-600"><p>Escala: {event.confirmed_musicians}/{event.required_roles} · Repertório: {event.songs_selected}</p><p>Equipamentos: {event.equipment_items} · Pendências obrigatórias: {event.required_tasks_open}</p></div>
              <div><p className="tabular-nums text-sm">{percent}%</p><div className="mt-1 h-1 bg-neutral-100"><div className="h-full bg-black" style={{ width: `${percent}%` }} /></div></div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Bar({ label, amount, max, color }: { label: string; amount: number; max: number; color: string }) {
  return <div className="grid grid-cols-[62px_1fr_auto] items-center gap-2"><span className="text-[9px] text-neutral-500">{label}</span><div className="h-1.5 bg-neutral-100"><div className={`h-full ${color}`} style={{ width: `${Math.min(amount / max * 100, 100)}%` }} /></div><span className="w-24 text-right tabular-nums text-[10px]">{money(amount)}</span></div>;
}
