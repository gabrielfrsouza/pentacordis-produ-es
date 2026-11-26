import { MaestroManager } from "@/components/maestro/maestro-manager";
import { createClient } from "@/lib/supabase/server";
import type { EventRow, MaestroRule } from "@/types/database";

export const instant = false;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MaestroPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedEventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const validEventId = requestedEventId && uuidPattern.test(requestedEventId) ? requestedEventId : null;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const since = yearAgo.toISOString();

  const [
    songsResult,
    ruleSetsResult,
    feedbackResult,
    musiciansResult,
    rolesResult,
    leadsResult,
    proposalsResult,
    readinessResult,
  ] = await Promise.all([
    supabase.from("songs").select("*").order("title").limit(1000),
    supabase.from("maestro_rule_sets").select("*").order("version", { ascending: false }),
    supabase.from("maestro_feedback").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("musicians").select("*").eq("is_active", true).order("full_name").limit(1000),
    supabase.from("musician_roles").select("*").limit(2000),
    supabase.from("leads").select("status,estimated_value").gte("created_at", since).limit(2000),
    supabase.from("proposals").select("status,total_value").gte("created_at", since).limit(2000),
    supabase.from("pentacordis_event_readiness").select("*").gte("event_date", today).neq("status", "cancelado").order("event_date").limit(100),
  ]);

  const activeRuleSet = (ruleSetsResult.data ?? []).find((ruleSet) => ruleSet.is_active) ?? null;
  let rules: MaestroRule[] = [];
  let rulesError: string | null = null;
  if (activeRuleSet) {
    const rulesResult = await supabase
      .from("maestro_rules")
      .select("*")
      .eq("rule_set_id", activeRuleSet.id)
      .eq("is_active", true)
      .order("priority");
    rules = rulesResult.data ?? [];
    rulesError = rulesResult.error?.message ?? null;
  }

  let initialEvent: EventRow | null = null;
  let eventContextError: string | null = requestedEventId && !validEventId
    ? "O identificador do evento informado no endereço é inválido."
    : null;
  if (validEventId) {
    const eventResult = await supabase.from("events").select("*").eq("id", validEventId).maybeSingle();
    initialEvent = eventResult.data;
    eventContextError = eventResult.error?.message ?? (eventResult.data ? null : "O evento solicitado não foi encontrado ou não está disponível para este perfil.");
  }

  const errors = [
    songsResult.error && `Acervo: ${songsResult.error.message}`,
    ruleSetsResult.error && `Regras Maestro: ${ruleSetsResult.error.message}`,
    rulesError && `Regras ativas: ${rulesError}`,
    feedbackResult.error && `Feedback Maestro: ${feedbackResult.error.message}`,
    musiciansResult.error && `Músicos: ${musiciansResult.error.message}`,
    rolesResult.error && `Funções musicais: ${rolesResult.error.message}`,
    leadsResult.error && `Leads: ${leadsResult.error.message}`,
    proposalsResult.error && `Propostas: ${proposalsResult.error.message}`,
    readinessResult.error && `Prontidão de eventos: ${readinessResult.error.message}`,
  ].filter((error): error is string => Boolean(error));

  return (
    <MaestroManager
      initialEvent={initialEvent}
      eventContextError={eventContextError}
      songs={songsResult.data ?? []}
      rules={rules}
      activeRuleSet={activeRuleSet}
      feedback={feedbackResult.data ?? []}
      musicians={musiciansResult.data ?? []}
      musicianRoles={rolesResult.data ?? []}
      leads={leadsResult.data ?? []}
      proposals={proposalsResult.data ?? []}
      readiness={readinessResult.data ?? []}
      errors={errors}
      today={today}
    />
  );
}
