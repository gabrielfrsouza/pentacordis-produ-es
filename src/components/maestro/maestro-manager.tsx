"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, CircleHelp, Music2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  assessMusicianAvailability,
  assessEventReadiness,
  calculateCommercialForecast,
  getUnsupportedScoringRules,
  money,
  percent,
  recommendSongs,
  suggestFormation,
  type BookingOnDate,
} from "@/lib/maestro/engine";
import type {
  EventReadiness,
  EventRow,
  Lead,
  MaestroFeedback,
  MaestroRule,
  MaestroRuleSet,
  Musician,
  MusicianAvailability,
  MusicianRole,
  Proposal,
  Song,
} from "@/types/database";

type Props = {
  initialEvent: EventRow | null;
  eventContextError: string | null;
  songs: Song[];
  rules: MaestroRule[];
  activeRuleSet: MaestroRuleSet | null;
  feedback: MaestroFeedback[];
  musicians: Musician[];
  musicianRoles: MusicianRole[];
  leads: Pick<Lead, "status" | "estimated_value">[];
  proposals: Pick<Proposal, "status" | "total_value">[];
  readiness: EventReadiness[];
  errors: string[];
  today: string;
};

function labelForStatus(status: string) {
  return {
    disponivel: "Disponível",
    preferencial: "Preferencial",
    consulta: "Confirmar",
    sem_dados: "Sem dados",
    conflito: "Conflito",
    indisponivel: "Indisponível",
    sem_candidato: "Sem candidato",
  }[status] ?? status;
}

function statusStyle(status: string) {
  if (status === "disponivel" || status === "preferencial") return "border-emerald-500/30 text-emerald-700";
  if (status === "conflito" || status === "indisponivel") return "border-red-500/30 text-red-700";
  return "border-amber-500/30 text-amber-700";
}

export function MaestroManager({
  initialEvent,
  eventContextError,
  songs,
  rules,
  activeRuleSet,
  feedback: initialFeedback,
  musicians,
  musicianRoles,
  leads,
  proposals,
  readiness,
  errors,
  today,
}: Props) {
  const [eventDate, setEventDate] = useState(initialEvent?.event_date ?? "");
  const [eventType, setEventType] = useState(initialEvent?.event_type ?? "");
  const [moment, setMoment] = useState("");
  const [moods, setMoods] = useState("");
  const [instrumentation, setInstrumentation] = useState("");
  const [maxDifficulty, setMaxDifficulty] = useState("");
  const [budget, setBudget] = useState("");
  const [availability, setAvailability] = useState<MusicianAvailability[]>([]);
  const [bookings, setBookings] = useState<BookingOnDate[]>([]);
  const [checkingDate, setCheckingDate] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [savedRecommendations, setSavedRecommendations] = useState<Record<string, string>>({});
  const [savingSong, setSavingSong] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const context = useMemo(() => ({
    eventType,
    moment,
    moodTags: moods.split(",").map((item) => item.trim()).filter(Boolean),
    instrumentation: instrumentation.split(",").map((item) => item.trim()).filter(Boolean),
    maxDifficulty: maxDifficulty ? Number(maxDifficulty) : null,
  }), [eventType, moment, moods, instrumentation, maxDifficulty]);

  const recommendations = useMemo(
    () => recommendSongs(songs, context, rules, feedback),
    [songs, context, rules, feedback],
  );
  const commercial = useMemo(() => calculateCommercialForecast(leads, proposals), [leads, proposals]);
  const unsupportedRules = useMemo(() => getUnsupportedScoringRules(rules), [rules]);
  const currentEventId = initialEvent && eventDate === initialEvent.event_date ? initialEvent.id : null;
  const numericBudget = budget.trim() && Number.isFinite(Number(budget)) ? Number(budget) : null;

  useEffect(() => {
    if (!eventDate) return;

    let active = true;
    async function loadDateAnalysis() {
      setCheckingDate(true);
      setAvailabilityError(null);
      const supabase = createClient();
      const [availabilityResult, eventsResult] = await Promise.all([
        supabase
          .from("musician_availability")
          .select("id,musician_id,availability_date,start_time,end_time,status,notes,created_at,updated_at")
          .eq("availability_date", eventDate),
        supabase
          .from("events")
          .select("id,title,start_time,end_time,status")
          .eq("event_date", eventDate)
          .neq("status", "cancelado"),
      ]);

      if (!active) return;
      if (availabilityResult.error || eventsResult.error) {
        setAvailabilityError(
          [availabilityResult.error?.message, eventsResult.error?.message].filter(Boolean).join(" · "),
        );
        setAvailability([]);
        setBookings([]);
        setCheckingDate(false);
        return;
      }

      const otherEvents = (eventsResult.data ?? []).filter((item) => item.id !== currentEventId);
      if (otherEvents.length === 0) {
        setAvailability(availabilityResult.data ?? []);
        setBookings([]);
        setCheckingDate(false);
        return;
      }

      const lineupResult = await supabase
        .from("event_lineup")
        .select("event_id,musician_id,backup_musician_id")
        .in("event_id", otherEvents.map((item) => item.id));
      if (!active) return;
      if (lineupResult.error) {
        setAvailabilityError(lineupResult.error.message);
        setAvailability([]);
        setBookings([]);
        setCheckingDate(false);
        return;
      }

      const titleById = new Map(otherEvents.map((item) => [item.id, item.title]));
      const eventById = new Map(otherEvents.map((item) => [item.id, item]));
      const nextBookings = (lineupResult.data ?? []).flatMap((lineup) => {
        const event = eventById.get(lineup.event_id);
        if (!event) return [];
        return [lineup.musician_id, lineup.backup_musician_id]
          .filter((musicianId): musicianId is string => Boolean(musicianId))
          .map((musicianId) => ({
            musicianId,
            title: titleById.get(lineup.event_id) ?? "Outro evento",
            startTime: event.start_time,
            endTime: event.end_time,
          }));
      });
      setAvailability(availabilityResult.data ?? []);
      setBookings(nextBookings);
      setCheckingDate(false);
    }

    void loadDateAnalysis();
    return () => { active = false; };
  }, [eventDate, currentEventId]);

  const formation = useMemo(() => {
    if (!eventDate || checkingDate || availabilityError) return [];
    return suggestFormation(
      eventType,
      musicians,
      musicianRoles,
      availability,
      bookings,
      currentEventId ? initialEvent?.start_time ?? null : null,
      currentEventId ? initialEvent?.end_time ?? null : null,
      numericBudget,
    );
  }, [eventDate, checkingDate, availabilityError, eventType, musicians, musicianRoles, availability, bookings, initialEvent, currentEventId, numericBudget]);

  const availabilityReview = useMemo(() => {
    if (!eventDate || checkingDate || availabilityError) return [];
    return musicians
      .map((musician) => ({
        musician,
        assessment: assessMusicianAvailability(
          musician.id,
          availability,
          bookings,
          currentEventId ? initialEvent?.start_time ?? null : null,
          currentEventId ? initialEvent?.end_time ?? null : null,
        ),
      }))
      .filter(({ assessment }) => ["indisponivel", "conflito", "consulta"].includes(assessment.status));
  }, [eventDate, checkingDate, availabilityError, musicians, availability, bookings, currentEventId, initialEvent]);

  const availabilityCounts = useMemo(() => {
    const assessments = musicians.map((musician) => assessMusicianAvailability(
      musician.id,
      availability,
      bookings,
      currentEventId ? initialEvent?.start_time ?? null : null,
      currentEventId ? initialEvent?.end_time ?? null : null,
    ));
    return {
      blocked: assessments.filter(({ status }) => status === "indisponivel" || status === "conflito").length,
      pending: assessments.filter(({ status }) => status === "consulta").length,
      missing: assessments.filter(({ status }) => status === "sem_dados").length,
    };
  }, [musicians, availability, bookings, currentEventId, initialEvent]);

  async function saveRecommendation(song: Song, explanation: string[]) {
    setSavingSong(song.id);
    setActionMessage(null);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setActionMessage(authError?.message ?? "Sua sessão expirou. Entre novamente para registrar a recomendação.");
      setSavingSong(null);
      return;
    }
    const result = await supabase
      .from("maestro_recommendations")
      .insert({
        event_id: currentEventId,
        song_id: song.id,
        rule_set_id: activeRuleSet?.id ?? null,
        liturgical_moment: moment.trim() || null,
        score: recommendations.find((item) => item.song.id === song.id)?.score ?? 50,
        explanation,
        context_snapshot: {
          event_date: eventDate || null,
          event_type: eventType || null,
          moment: moment || null,
          mood_tags: context.moodTags,
          instrumentation: context.instrumentation,
          max_difficulty: context.maxDifficulty,
        },
        status: "suggested",
        generated_by: authData.user.id,
      })
      .select("id")
      .single();
    if (result.error) {
      setActionMessage(`Não foi possível registrar a recomendação: ${result.error.message}`);
    } else {
      setSavedRecommendations((current) => ({ ...current, [song.id]: result.data.id }));
      setActionMessage(`Recomendação de “${song.title}” registrada.`);
    }
    setSavingSong(null);
  }

  async function recordFeedback(songId: string, type: "accepted" | "rejected") {
    const recommendationId = savedRecommendations[songId];
    if (!recommendationId) return;
    setFeedbackSaving(songId);
    setActionMessage(null);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setActionMessage(authError?.message ?? "Sua sessão expirou. Entre novamente para registrar o feedback.");
      setFeedbackSaving(null);
      return;
    }
    const result = await supabase
      .from("maestro_feedback")
      .insert({
        recommendation_id: recommendationId,
        event_id: currentEventId,
        song_id: songId,
        feedback_type: type,
        feedback_by: authData.user.id,
      })
      .select("*")
      .single();
    if (result.error) {
      setActionMessage(`Não foi possível registrar o feedback: ${result.error.message}`);
    } else {
      setFeedback((current) => [...current, result.data]);
      setActionMessage("Feedback salvo; ele será considerado nas próximas pontuações.");
    }
    setFeedbackSaving(null);
  }

  const errorMessages = [...errors, eventContextError, availabilityError].filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-muted">Inteligência estratégica</p>
          <h1 className="mt-2 text-3xl font-light tracking-tight">Maestro</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Recomendações musicais explicáveis, disponibilidade da equipe e sinais comerciais baseados nos dados do seu acervo.</p>
        </div>
        {initialEvent ? (
          <Link href={`/eventos/${initialEvent.id}`} className="flex h-10 items-center gap-2 border border-border px-3 text-xs hover:border-gold/40">
            <CalendarDays size={15} /> Voltar ao evento
          </Link>
        ) : null}
      </header>

      {errorMessages.length ? (
        <div role="alert" className="space-y-1 border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-800">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} /> Alguns dados não puderam ser carregados ou analisados.</p>
          {errorMessages.map((error, index) => <p key={`${index}-${error}`} className="break-words">{error}</p>)}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-gold" /> Contexto da análise</h2>
            <p className="mt-1 text-xs text-muted">As marcações abaixo afetam as sugestões de repertório e a formação.</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-[10px] text-muted">
            {activeRuleSet ? `${activeRuleSet.name} · v${activeRuleSet.version}` : "Regras Maestro padrão"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs text-muted">Evento
            <input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Casamento, missa..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted">Data
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted">Momento musical
            <input value={moment} onChange={(event) => setMoment(event.target.value)} placeholder="Entrada, comunhão..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted">Clima (separado por vírgula)
            <input value={moods} onChange={(event) => setMoods(event.target.value)} placeholder="solene, alegre..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted">Instrumentos/funções desejados
            <input value={instrumentation} onChange={(event) => setInstrumentation(event.target.value)} placeholder="piano, violino..." className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted">Dificuldade máxima
            <select value={maxDifficulty} onChange={(event) => setMaxDifficulty(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground">
              <option value="">Sem limite</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted">Orçamento de cachês (opcional)
            <input type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="R$" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
          </label>
        </div>
      </section>

      {actionMessage ? <p role="status" className="border border-border bg-surface px-4 py-3 text-sm">{actionMessage}</p> : null}

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Music2 size={17} className="text-gold" /> Repertório recomendado</h2>
            <p className="mt-1 text-xs text-muted">Pontuação de 0–100; cada fator aplicado aparece na explicação. Feedback só influencia após 3 respostas por música.</p>
          </div>
          <span className="text-xs text-muted">{songs.length} músicas · {rules.filter((rule) => rule.is_active).length || 5} regras ativas</span>
        </div>
        {unsupportedRules.length ? (
          <p role="status" className="border-b border-amber-500/30 bg-amber-500/5 px-5 py-3 text-xs text-amber-800">
            Regras ativas não aplicadas por usarem condições/efeitos ainda não reconhecidos: {unsupportedRules.map((rule) => rule.name).join(", ")}.
          </p>
        ) : null}
        {songs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">O acervo está vazio ou não está disponível para este perfil.</p>
        ) : (
          <div className="divide-y divide-border">
            {recommendations.map((item) => {
              const savedId = savedRecommendations[item.song.id];
              return (
                <article key={item.song.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-medium">{item.song.title}</h3>
                      <span className="rounded-full border border-gold/40 px-2.5 py-1 text-xs text-gold">{item.score}/100</span>
                      {item.song.difficulty ? <span className="text-[10px] text-muted">Dificuldade {item.song.difficulty}/5</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">{item.song.composer ?? "Compositor não informado"}{item.song.default_key ? ` · Tom ${item.song.default_key}` : ""}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {item.explanations.map((explanation) => <li key={explanation} className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted">{explanation}</li>)}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!savedId ? (
                      <button type="button" disabled={savingSong === item.song.id} onClick={() => void saveRecommendation(item.song, item.explanations)} className="h-9 border border-border px-3 text-xs hover:border-gold/50 disabled:opacity-50">
                        {savingSong === item.song.id ? "Salvando..." : "Registrar recomendação"}
                      </button>
                    ) : (
                      feedback.some((entry) => entry.recommendation_id === savedId) ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-700"><Check size={14} /> Feedback salvo</span>
                      ) : (
                        <>
                          <button type="button" disabled={feedbackSaving === item.song.id} onClick={() => void recordFeedback(item.song.id, "accepted")} className="flex h-9 items-center gap-1 border border-emerald-500/30 px-3 text-xs text-emerald-700 disabled:opacity-50"><ThumbsUp size={13} /> Útil</button>
                          <button type="button" disabled={feedbackSaving === item.song.id} onClick={() => void recordFeedback(item.song.id, "rejected")} className="flex h-9 items-center gap-1 border border-border px-3 text-xs text-muted disabled:opacity-50"><ThumbsDown size={13} /> Não recomendar</button>
                        </>
                      )
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Disponibilidade e formação sugerida</h2>
            <p className="mt-1 text-xs text-muted">Conflitos são sinalizados; a produção confirma a escala antes de convidar.</p>
          </div>
          {!eventDate ? (
            <p className="px-5 py-8 text-sm text-muted">Informe uma data para consultar disponibilidade e conflitos de agenda.</p>
          ) : checkingDate ? (
            <p className="px-5 py-8 text-sm text-muted">Analisando disponibilidade...</p>
          ) : availabilityError ? (
            <p role="alert" className="px-5 py-8 text-sm text-amber-800">Não foi possível verificar a disponibilidade; as sugestões de formação foram suspensas até que a consulta seja corrigida.</p>
          ) : formation.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">Nenhuma função correspondente encontrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {formation.map((item) => (
                <div key={item.role} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium">{item.role}</p>
                    <p className="mt-1 text-xs text-muted">{item.musician?.full_name ?? "Sem músico sugerido"}{item.musician?.base_fee ? ` · Cachê base ${money(Number(item.musician.base_fee))}` : ""}</p>
                    <p className="mt-1 text-[11px] text-muted">{item.reasons.join(" · ")}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] ${statusStyle(item.status)}`}>{labelForStatus(item.status)}</span>
                </div>
              ))}
            </div>
          )}
          {eventDate && !availabilityError && !checkingDate ? <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-[10px] text-muted"><CircleHelp size={13} /> Músicos sem cadastro de disponibilidade não são tratados como confirmados.</p> : null}
          {eventDate && !availabilityError && !checkingDate ? (
            <div className="border-t border-border px-5 py-4">
              <p className="text-xs text-muted">Na data: {availabilityCounts.blocked} bloqueados/conflitos · {availabilityCounts.pending} aguardando confirmação · {availabilityCounts.missing} sem dados.</p>
              {availabilityReview.length ? (
                <ul className="mt-3 space-y-2">
                  {availabilityReview.map(({ musician, assessment }) => (
                    <li key={musician.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                      <span>{musician.full_name} <span className="text-muted">· {assessment.reasons.join(" ")}</span></span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusStyle(assessment.status)}`}>{labelForStatus(assessment.status)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-surface">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Inteligência comercial · 12 meses</h2>
            <p className="mt-1 text-xs text-muted">Estimativas heurísticas, não garantias nem previsões de IA.</p>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            <div className="bg-surface p-5">
              <p className="text-xs text-muted">Conversão histórica de leads</p>
              <p className="mt-2 text-2xl font-light">{percent(commercial.leadWinRate)}</p>
              <p className="mt-1 text-[10px] text-muted">{commercial.leadOutcomeCount} resultados (fechados/perdidos)</p>
            </div>
            <div className="bg-surface p-5">
              <p className="text-xs text-muted">Valor esperado do pipeline de leads</p>
              <p className="mt-2 text-2xl font-light">{commercial.expectedLeadValue === null ? "—" : money(commercial.expectedLeadValue)}</p>
              <p className="mt-1 text-[10px] text-muted">{money(commercial.openLeadValue)} em leads abertos · {commercial.leadOutcomeCount < 3 ? "amostra insuficiente" : "taxa histórica aplicada"}</p>
            </div>
            <div className="bg-surface p-5">
              <p className="text-xs text-muted">Conversão de propostas</p>
              <p className="mt-2 text-2xl font-light">{percent(commercial.proposalWinRate)}</p>
              <p className="mt-1 text-[10px] text-muted">{commercial.proposalOutcomeCount} resultados (aprovadas/recusadas)</p>
            </div>
            <div className="bg-surface p-5">
              <p className="text-xs text-muted">Valor esperado das propostas</p>
              <p className="mt-2 text-2xl font-light">{commercial.expectedProposalValue === null ? "—" : money(commercial.expectedProposalValue)}</p>
              <p className="mt-1 text-[10px] text-muted">{money(commercial.openProposalValue)} enviadas/visualizadas · {commercial.proposalOutcomeCount < 3 ? "amostra insuficiente" : "taxa histórica aplicada"}</p>
            </div>
          </div>
          <p className="flex items-start gap-2 border-t border-border p-4 text-[10px] text-muted"><CircleHelp size={13} className="mt-0.5 shrink-0" /> A estimativa só aparece quando há histórico de conversão; pipeline de leads e propostas são mostrados separadamente para evitar dupla contagem.</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">Prontidão e risco dos próximos eventos</h2>
          <p className="mt-1 text-xs text-muted">Indicador heurístico a partir de escala confirmada, repertório, equipamentos e tarefas pendentes.</p>
        </div>
        {readiness.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">Nenhum evento futuro ou dado de prontidão disponível.</p>
        ) : (
          <div className="divide-y divide-border">
            {readiness.slice(0, 8).map((event) => {
              const indicator = assessEventReadiness(event, today);
              return (
                <Link key={event.event_id} href={`/eventos/${event.event_id}`} className="grid gap-3 px-5 py-4 hover:bg-background/50 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="mt-1 text-xs text-muted">{event.event_date} · {indicator.daysUntil < 0 ? "data passada" : `em ${indicator.daysUntil} dias`}</p>
                  </div>
                  <span className="text-xs text-muted">Prontidão estimada: {indicator.readiness}%</span>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] ${indicator.risk === "alto" ? "border-red-500/30 text-red-700" : indicator.risk === "medio" ? "border-amber-500/30 text-amber-800" : "border-emerald-500/30 text-emerald-700"}`}>
                    Risco {indicator.risk}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
