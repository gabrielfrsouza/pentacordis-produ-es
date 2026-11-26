import Link from "next/link";
import { AlertTriangle, CalendarCheck, CircleCheck, Clock3, Plus, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";
import { BrandMark } from "@/components/brand/BrandMark";
import { EditorialEmpty } from "@/components/ui/editorial-empty";
import { FadeItem, FadeStagger } from "@/components/motion/fade-stagger";

export const instant = false;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

type EventReadiness = {
  id: string;
  title: string;
  event_type: string | null;
  event_date: string;
  venue_name: string | null;
  status: "planejamento" | "escalado" | "concluido" | "cancelado";
};

export default async function DashboardPage() {
  await connection();
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const fourteenDays = new Date(now);
  fourteenDays.setDate(now.getDate() + 14);
  const fourteenDaysIso = fourteenDays.toISOString().slice(0, 10);

  const [
    contractsResult,
    eventsMonthResult,
    upcomingResult,
    eventsForFinancialResult,
    lineupResult,
    setlistResult,
    equipmentResult,
    installmentsResult,
    musiciansResult,
    financialResult,
  ] = await Promise.all([
    supabase.from("contracts").select("id,total_value").eq("status", "assinado"),
    supabase.from("events").select("id").gte("event_date", monthStart).lte("event_date", monthEnd).neq("status", "cancelado"),
    supabase
      .from("events")
      .select("id,title,event_type,event_date,venue_name,status")
      .gte("event_date", now.toISOString().slice(0, 10))
      .lte("event_date", fourteenDaysIso)
      .neq("status", "cancelado")
      .order("event_date", { ascending: true }),
    supabase.from("events").select("id,contract_id,status").neq("status", "cancelado"),
    supabase.from("event_lineup").select("event_id,invite_status,negotiated_fee,payment_status"),
    supabase.from("event_setlist").select("event_id"),
    supabase.from("event_equipment").select("event_id,checked_in"),
    supabase
      .from("installments")
      .select("id,amount,due_date,status")
      .eq("status", "pendente")
      .lt("due_date", now.toISOString().slice(0, 10)),
    supabase
      .from("musicians")
      .select("id,full_name,conduct_term_signed_at")
      .eq("is_active", true)
      .is("conduct_term_signed_at", null),
    supabase.from("event_financial_summary").select("event_id,total_musician_fees,total_expenses"),
  ]);

  const queryError = [
    contractsResult,
    eventsMonthResult,
    upcomingResult,
    eventsForFinancialResult,
    lineupResult,
    setlistResult,
    equipmentResult,
    installmentsResult,
    musiciansResult,
    financialResult,
  ].find((result) => result.error)?.error;
  if (queryError) throw new Error(`Não foi possível carregar os indicadores do painel: ${queryError.message}`);

  const signedContracts = contractsResult.data ?? [];
  const signedContractIds = new Set(signedContracts.map((contract) => contract.id));
  const signedEventIds = new Set(
    (eventsForFinancialResult.data ?? [])
      .filter((event) => event.contract_id !== null && signedContractIds.has(event.contract_id))
      .map((event) => event.id),
  );
  const financialRows = (financialResult.data ?? []).filter((row) => signedEventIds.has(row.event_id));
  const contracted = signedContracts.reduce((sum, row) => sum + Number(row.total_value), 0);
  const musicianFees = (lineupResult.data ?? [])
    .filter((row) => signedEventIds.has(row.event_id) && row.payment_status !== "pago")
    .reduce((sum, row) => sum + Number(row.negotiated_fee ?? 0), 0);
  const projectedCosts = financialRows.reduce(
    (sum, row) => sum + Number(row.total_musician_fees) + Number(row.total_expenses),
    0,
  );
  const netProfit = contracted - projectedCosts;
  const overdueInstallments = installmentsResult.data ?? [];
  const unsignedMusicians = musiciansResult.data ?? [];
  const upcomingEvents = (upcomingResult.data ?? []) as EventReadiness[];

  const lineupByEvent = (lineupResult.data ?? []).reduce<Record<string, Array<{ invite_status: string }>>>(
    (grouped, lineup) => {
      grouped[lineup.event_id] ??= [];
      grouped[lineup.event_id].push({ invite_status: lineup.invite_status });
      return grouped;
    },
    {},
  );
  const setlistCounts = (setlistResult.data ?? []).reduce<Record<string, number>>((counts, row) => {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
    return counts;
  }, {});
  const equipmentByEvent = (equipmentResult.data ?? []).reduce<Record<string, Array<{ checked_in: boolean }>>>(
    (grouped, row) => {
      grouped[row.event_id] ??= [];
      grouped[row.event_id].push({ checked_in: row.checked_in });
      return grouped;
    },
    {},
  );

  const alertCount =
    overdueInstallments.length +
    unsignedMusicians.length +
    upcomingEvents.filter((event) => {
      const lineup = lineupByEvent[event.id] ?? [];
      const withinSevenDays =
        (new Date(`${event.event_date}T12:00:00`).getTime() - now.getTime()) / 86_400_000 <= 7;
      return withinSevenDays && lineup.some((row) => row.invite_status !== "confirmado");
    }).length;

  const kpis = [
    { label: "Faturamento assinado", value: formatCurrency(contracted), icon: TrendingUp, tone: "text-black" },
    { label: "Cachês pendentes", value: formatCurrency(musicianFees), icon: Users, tone: "text-neutral-500" },
    { label: "Lucro projetado", value: formatCurrency(netProfit), icon: CircleCheck, tone: "text-gold" },
    { label: "Eventos no mês", value: String(eventsMonthResult.data?.length ?? 0), icon: CalendarCheck, tone: "text-neutral-500" },
  ];

  return (
    <div className="relative">
      <BrandMark variant="watermark" size="hero" className="fixed bottom-12 right-8 hidden md:block" />
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Visão geral</p>
          <h1 className="mt-2 font-light text-[38px] leading-none">Torre de Controle</h1>
        </div>
        <p className="hidden text-sm text-muted sm:block">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(now)}
        </p>
      </div>

      <nav aria-label="Ações rápidas" className="mb-7 flex flex-wrap gap-2">
        {[
          { label: "Novo lead", href: "/comercial?create=lead" },
          { label: "Novo orçamento", href: "/orcamentos" },
          { label: "Novo evento", href: "/eventos?create=1" },
          { label: "Novo músico", href: "/musicos?create=1" },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="inline-flex h-10 items-center gap-2 border border-neutral-200 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-700 transition-colors hover:border-black hover:text-black"
          >
            <Plus size={14} />
            {action.label}
          </Link>
        ))}
      </nav>

      <FadeStagger className="grid gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2 xl:grid-cols-4" >
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <FadeItem key={kpi.label}>
            <article className="bg-white p-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">{kpi.label}</p>
                <Icon size={18} className={kpi.tone} />
              </div>
              <p className="tabular-nums mt-5 font-light text-[32px] tracking-tight">{kpi.value}</p>
            </article>
            </FadeItem>
          );
        })}
      </FadeStagger>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.7fr)]">
        <article className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Próximos 14 dias</h2>
              <p className="mt-1 text-xs text-muted">Prontidão operacional dos eventos</p>
            </div>
            <Clock3 size={18} className="text-gold" />
          </div>
          {upcomingEvents.length === 0 ? (
            <EditorialEmpty
              title="Nenhum evento próximo"
              description="A agenda está aberta para os próximos 14 dias."
              action={<Link href="/eventos" className="border-b border-black pb-1 text-[10px] font-medium uppercase tracking-[0.18em]">Abrir eventos</Link>}
            />
          ) : (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event) => {
                const lineup = lineupByEvent[event.id] ?? [];
                const confirmed = lineup.filter((row) => row.invite_status === "confirmado").length;
                const scaleReady = lineup.length > 0 ? confirmed / lineup.length : 0;
                const hasSetlist = (setlistCounts[event.id] ?? 0) > 0;
                const equipment = equipmentByEvent[event.id] ?? [];
                const equipmentReady = equipment.length > 0 && equipment.every((row) => !row.checked_in);
                const readiness = Math.round(
                  ((lineup.length > 0 ? scaleReady : 0) + (hasSetlist ? 1 : 0) + (equipmentReady ? 1 : 0)) /
                    3 *
                    100,
                );

                return (
                  <Link
                    href={`/eventos/${event.id}`}
                    key={event.id}
                    className="grid gap-4 px-5 py-4 transition hover:bg-white/[0.025] sm:grid-cols-[90px_1fr_150px]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-gold">{formatDate(event.event_date)}</p>
                      <p className="mt-1 text-[11px] text-muted">{event.event_type ?? "Evento"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="mt-1 truncate text-xs text-muted">{event.venue_name ?? "Local a definir"}</p>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between text-[11px] text-muted">
                        <span>Prontidão</span>
                        <span>{readiness}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${readiness >= 67 ? "bg-emerald-500" : readiness >= 34 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${readiness}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Central de Alertas</h2>
              <p className="mt-1 text-xs text-muted">{alertCount} pendências</p>
            </div>
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div className="divide-y divide-border">
            {upcomingEvents.map((event) => {
              const lineup = lineupByEvent[event.id] ?? [];
              const unconfirmed = lineup.some((row) => row.invite_status !== "confirmado");
              const daysRemaining = Math.ceil(
                (new Date(`${event.event_date}T12:00:00`).getTime() - now.getTime()) / 86_400_000,
              );
              if (daysRemaining > 7 || !unconfirmed) return null;
              return (
                <div key={`lineup-${event.id}`} className="px-5 py-4">
                  <p className="text-sm font-medium">Vaga sem confirmação</p>
                  <p className="mt-1 text-xs text-muted">{event.title} · faltam {daysRemaining} dias</p>
                </div>
              );
            })}
            {overdueInstallments.map((installment) => (
              <div key={installment.id} className="px-5 py-4">
                <p className="text-sm font-medium">Parcela vencida</p>
                <p className="mt-1 text-xs text-muted">
                  {formatCurrency(Number(installment.amount))} · vencimento {formatDate(installment.due_date)}
                </p>
              </div>
            ))}
            {unsignedMusicians.map((musician) => (
              <div key={musician.id} className="px-5 py-4">
                <p className="text-sm font-medium">Termo de conduta pendente</p>
                <p className="mt-1 text-xs text-muted">{musician.full_name}</p>
              </div>
            ))}
            {alertCount === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-emerald-300">Nenhum alerta crítico.</div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
