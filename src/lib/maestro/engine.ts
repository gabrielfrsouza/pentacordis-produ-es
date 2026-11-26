import type {
  EventReadiness,
  Json,
  MaestroFeedback,
  MaestroRule,
  Musician,
  MusicianAvailability,
  MusicianRole,
  Song,
} from "@/types/database";

export type MaestroContext = {
  eventType: string;
  moment: string;
  moodTags: string[];
  instrumentation: string[];
  maxDifficulty: number | null;
};

export type SongRecommendation = {
  song: Song;
  score: number;
  explanations: string[];
};

export type BookingOnDate = {
  musicianId: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
};

export type AvailabilityAssessment = {
  status: "indisponivel" | "conflito" | "consulta" | "disponivel" | "preferencial" | "sem_dados";
  reasons: string[];
};

export type FormationSuggestion = {
  role: string;
  musician: Musician | null;
  status: AvailabilityAssessment["status"] | "sem_candidato";
  reasons: string[];
};

export type CommercialForecast = {
  leadWinRate: number | null;
  leadOutcomeCount: number;
  openLeadValue: number;
  expectedLeadValue: number | null;
  proposalWinRate: number | null;
  proposalOutcomeCount: number;
  openProposalValue: number;
  expectedProposalValue: number | null;
};

const fallbackRules: MaestroRule[] = [
  {
    id: "fallback-moment",
    rule_set_id: "",
    rule_key: "context_moment",
    name: "Momento musical",
    description: "Prioriza músicas marcadas para o momento informado.",
    category: "compatibilidade",
    conditions: { match_context_moment: true },
    effect: { score: 20, reason: "Compatível com o momento informado" },
    weight: 1,
    priority: 10,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-mood",
    rule_set_id: "",
    rule_key: "context_mood",
    name: "Clima musical",
    description: "Considera as tags de clima selecionadas.",
    category: "compatibilidade",
    conditions: { match_mood_tags: true },
    effect: { score: 12, reason: "Clima musical compatível" },
    weight: 1,
    priority: 20,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-instrumentation",
    rule_set_id: "",
    rule_key: "context_instrumentation",
    name: "Formação musical",
    description: "Considera instrumentos ou funções desejadas.",
    category: "compatibilidade",
    conditions: { match_instrumentation: true },
    effect: { score: 10, reason: "Formação compatível" },
    weight: 1,
    priority: 30,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-approval",
    rule_set_id: "",
    rule_key: "liturgical_approval",
    name: "Aprovação litúrgica",
    description: "Valoriza repertório aprovado para uso litúrgico.",
    category: "aprovacao",
    conditions: { liturgical_approval_status: "aprovada" },
    effect: { score: 8, reason: "Aprovada para uso litúrgico" },
    weight: 1,
    priority: 40,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "fallback-arrangement",
    rule_set_id: "",
    rule_key: "pentacordis_arrangement",
    name: "Arranjo próprio",
    description: "Valoriza arranjos do acervo Pentacordis.",
    category: "identidade",
    conditions: { is_pentacordis_arrangement: true },
    effect: { score: 4, reason: "Arranjo próprio Pentacordis" },
    weight: 1,
    priority: 50,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

const supportedConditionKeys = new Set([
  "match_context_moment",
  "match_mood_tags",
  "match_instrumentation",
  "liturgical_moments",
  "mood_tags",
  "instrumentation",
  "event_types",
  "difficulty_min",
  "difficulty_max",
  "liturgical_approval_status",
  "is_pentacordis_arrangement",
]);

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function record(value: Json): Record<string, Json | undefined> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringList(value: Json | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function overlaps(left: string[], right: string[]) {
  const normalized = new Set(left.map(normalize));
  return right.some((item) => normalized.has(normalize(item)));
}

function matchesRule(rule: MaestroRule, song: Song, context: MaestroContext) {
  const conditions = record(rule.conditions);
  const keys = Object.keys(conditions);
  if (keys.some((key) => !supportedConditionKeys.has(key))) return false;

  if (conditions.match_context_moment === true && !overlaps(song.liturgical_moments, [context.moment])) return false;
  if (conditions.match_mood_tags === true && !overlaps(song.mood_tags, context.moodTags)) return false;
  if (conditions.match_instrumentation === true && !overlaps(song.instrumentation, context.instrumentation)) return false;
  if (conditions.liturgical_moments !== undefined && !overlaps(song.liturgical_moments, stringList(conditions.liturgical_moments))) return false;
  if (conditions.mood_tags !== undefined && !overlaps(song.mood_tags, stringList(conditions.mood_tags))) return false;
  if (conditions.instrumentation !== undefined && !overlaps(song.instrumentation, stringList(conditions.instrumentation))) return false;
  if (conditions.event_types !== undefined && !overlaps([context.eventType], stringList(conditions.event_types))) return false;
  if (conditions.difficulty_min !== undefined && (song.difficulty === null || song.difficulty < Number(conditions.difficulty_min))) return false;
  if (conditions.difficulty_max !== undefined && (song.difficulty === null || song.difficulty > Number(conditions.difficulty_max))) return false;
  if (conditions.liturgical_approval_status !== undefined && normalize(song.liturgical_approval_status) !== normalize(String(conditions.liturgical_approval_status))) return false;
  if (conditions.is_pentacordis_arrangement !== undefined && song.is_pentacordis_arrangement !== conditions.is_pentacordis_arrangement) return false;
  return true;
}

export function getActiveScoringRules(rules: MaestroRule[]) {
  const active = rules.filter((rule) => rule.is_active).sort((left, right) => left.priority - right.priority);
  return active.length ? active : fallbackRules;
}

export function getUnsupportedScoringRules(rules: MaestroRule[]) {
  const supportedEffectKeys = new Set(["score", "points", "reason"]);
  return rules.filter((rule) => {
    if (!rule.is_active) return false;
    const conditions = record(rule.conditions);
    const effect = record(rule.effect);
    const score = effect.score ?? effect.points;
    return Object.keys(conditions).some((key) => !supportedConditionKeys.has(key))
      || Object.keys(effect).some((key) => !supportedEffectKeys.has(key))
      || typeof score !== "number";
  });
}

export function recommendSongs(
  songs: Song[],
  context: MaestroContext,
  rules: MaestroRule[],
  feedback: MaestroFeedback[],
  limit = 8,
): SongRecommendation[] {
  const activeRules = getActiveScoringRules(rules);
  return songs
    .filter((song) => !["reprovada", "rejeitada", "recusada"].includes(normalize(song.liturgical_approval_status)))
    .map((song) => {
      let score = 50;
      const explanations: string[] = [];
      for (const rule of activeRules) {
        if (!matchesRule(rule, song, context)) continue;
        const effect = record(rule.effect);
        const points = Number(effect.score ?? effect.points ?? 0);
        const weightedPoints = Number.isFinite(points * rule.weight) ? points * rule.weight : 0;
        score += weightedPoints;
        const reason = typeof effect.reason === "string" ? effect.reason : rule.description ?? rule.name;
        if (reason && weightedPoints !== 0) explanations.push(reason);
      }

      const songFeedback = feedback.filter((item) => item.song_id === song.id);
      const responses = songFeedback.filter((item) => ["accepted", "rejected", "played", "not_played"].includes(item.feedback_type));
      if (responses.length >= 3) {
        const positive = responses.filter((item) => item.feedback_type === "accepted" || item.feedback_type === "played").length;
        const adjustment = ((positive / responses.length) - 0.5) * 12;
        score += adjustment;
        explanations.push(`Feedback do acervo: ${positive}/${responses.length} avaliações positivas`);
      }
      const ratings = songFeedback.map((item) => item.rating).filter((rating): rating is number => rating !== null);
      if (ratings.length >= 3) {
        const average = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
        score += Math.max(-8, Math.min(8, (average - 3) * 4));
        explanations.push(`Nota média do feedback: ${average.toFixed(1)}/5`);
      }
      if (context.maxDifficulty !== null && song.difficulty !== null && song.difficulty > context.maxDifficulty) {
        score -= 15;
        explanations.push(`Dificuldade ${song.difficulty} acima do limite escolhido`);
      }
      if (song.liturgical_approval_status === "aprovada" && !explanations.some((item) => item.toLocaleLowerCase("pt-BR").includes("aprovad"))) {
        explanations.push("Aprovada para uso litúrgico");
      }
      if (explanations.length === 0) explanations.push("Compatibilidade neutra; complete as marcações musicais para personalizar.");
      return { song, score: Math.max(0, Math.min(100, Math.round(score))), explanations };
    })
    .sort((left, right) => right.score - left.score || left.song.title.localeCompare(right.song.title, "pt-BR"))
    .slice(0, limit);
}

function timeMinutes(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function overlapsTime(startA: string | null, endA: string | null, startB: string | null, endB: string | null) {
  const aStart = timeMinutes(startA);
  const aEnd = timeMinutes(endA);
  const bStart = timeMinutes(startB);
  const bEnd = timeMinutes(endB);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null || aEnd <= aStart || bEnd <= bStart) return true;
  return aStart < bEnd && bStart < aEnd;
}

export function assessMusicianAvailability(
  musicianId: string,
  availability: MusicianAvailability[],
  bookings: BookingOnDate[],
  eventStart: string | null,
  eventEnd: string | null,
): AvailabilityAssessment {
  const booked = bookings.filter((item) => item.musicianId === musicianId && overlapsTime(item.startTime, item.endTime, eventStart, eventEnd));
  if (booked.length) {
    return { status: "conflito", reasons: booked.map((item) => `Já escalado em ${item.title}; confirme os horários.`) };
  }

  const rows = availability.filter((item) => item.musician_id === musicianId);
  if (rows.some((item) => item.status === "indisponivel" && overlapsTime(item.start_time, item.end_time, eventStart, eventEnd))) {
    return { status: "indisponivel", reasons: ["Indisponibilidade registrada para este horário."] };
  }
  if (rows.some((item) => item.status === "consulta" && overlapsTime(item.start_time, item.end_time, eventStart, eventEnd))) {
    return { status: "consulta", reasons: ["Disponibilidade ainda depende de confirmação."] };
  }
  if (rows.some((item) => item.status === "preferencial" && overlapsTime(item.start_time, item.end_time, eventStart, eventEnd))) {
    return { status: "preferencial", reasons: ["Data ou horário marcado como preferencial."] };
  }
  if (rows.some((item) => item.status === "disponivel" && overlapsTime(item.start_time, item.end_time, eventStart, eventEnd))) {
    return { status: "disponivel", reasons: ["Disponibilidade confirmada para o horário."] };
  }
  if (rows.length === 0) return { status: "sem_dados", reasons: ["Sem disponibilidade cadastrada; confirme antes de convidar."] };
  return { status: "sem_dados", reasons: ["Não há faixa de disponibilidade compatível; confirme com o músico."] };
}

const formationTemplates: Array<{ match: string[]; roles: string[] }> = [
  { match: ["casamento", "cerimonia", "missa", "religioso"], roles: ["soprano", "contralto", "tenor", "baixo", "piano"] },
  { match: ["gala", "espetaculo", "concerto"], roles: ["soprano", "contralto", "tenor", "baixo", "piano", "violino"] },
  { match: ["corporativo", "recepcao", "pocket"], roles: ["soprano", "tenor", "piano"] },
];

export function getFormationRoles(eventType: string) {
  const normalized = normalize(eventType);
  return formationTemplates.find((template) => template.match.some((word) => normalized.includes(word)))?.roles
    ?? ["soprano", "tenor", "piano"];
}

export function suggestFormation(
  eventType: string,
  musicians: Musician[],
  roles: MusicianRole[],
  availability: MusicianAvailability[],
  bookings: BookingOnDate[],
  eventStart: string | null,
  eventEnd: string | null,
  budget: number | null,
): FormationSuggestion[] {
  return getFormationRoles(eventType).map((roleName) => {
    const roleMusicianIds = new Set(roles.filter((role) => normalize(role.role_name) === normalize(roleName)).map((role) => role.musician_id));
    const candidates = musicians
      .filter((musician) => musician.is_active && roleMusicianIds.has(musician.id))
      .map((musician) => {
        const assessment = assessMusicianAvailability(musician.id, availability, bookings, eventStart, eventEnd);
        const priority = { disponivel: 0, preferencial: 1, sem_dados: 2, consulta: 3, conflito: 4, indisponivel: 5 }[assessment.status];
        const tier = musician.tier === "nucleo_fixo" ? 0 : musician.tier === "convidado_a" ? 1 : 2;
        const fee = Number(musician.base_fee ?? Number.MAX_SAFE_INTEGER);
        const overBudget = budget !== null && budget > 0 && fee > budget;
        return { musician, assessment, priority, tier, fee, overBudget };
      })
      .filter((candidate) => candidate.assessment.status !== "indisponivel" && candidate.assessment.status !== "conflito")
      .sort((left, right) =>
        left.priority - right.priority
        || Number(left.overBudget) - Number(right.overBudget)
        || left.tier - right.tier
        || left.fee - right.fee
        || (right.musician.sight_reading_score ?? 0) - (left.musician.sight_reading_score ?? 0),
      );
    const selected = candidates[0];
    if (!selected) {
      return { role: roleName, musician: null, status: "sem_candidato", reasons: ["Nenhum candidato elegível cadastrado para esta função."] };
    }
    return {
      role: roleName,
      musician: selected.musician,
      status: selected.assessment.status,
      reasons: [
        ...selected.assessment.reasons,
        selected.musician.tier === "nucleo_fixo" ? "Núcleo fixo" : selected.musician.tier === "convidado_a" ? "Convidado A" : "Convidado B",
        selected.overBudget ? "Cachê acima do orçamento informado" : "",
      ].filter(Boolean),
    };
  });
}

export function calculateCommercialForecast(
  leads: Array<{ status: string; estimated_value: number | null }>,
  proposals: Array<{ status: string; total_value: number | null }>,
): CommercialForecast {
  const leadWins = leads.filter((lead) => lead.status === "fechado").length;
  const leadLosses = leads.filter((lead) => lead.status === "perdido").length;
  const leadOutcomeCount = leadWins + leadLosses;
  const leadWinRate = leadOutcomeCount ? leadWins / leadOutcomeCount : null;
  const openLeads = leads.filter((lead) => lead.status === "novo" || lead.status === "proposta");
  const openLeadValue = openLeads.reduce((sum, lead) => sum + Math.max(0, Number(lead.estimated_value ?? 0)), 0);

  const proposalWins = proposals.filter((proposal) => proposal.status === "aprovada").length;
  const proposalLosses = proposals.filter((proposal) => proposal.status === "recusada").length;
  const proposalOutcomeCount = proposalWins + proposalLosses;
  const proposalWinRate = proposalOutcomeCount ? proposalWins / proposalOutcomeCount : null;
  const openProposals = proposals.filter((proposal) => proposal.status === "enviada" || proposal.status === "visualizada");
  const openProposalValue = openProposals.reduce((sum, proposal) => sum + Math.max(0, Number(proposal.total_value ?? 0)), 0);

  return {
    leadWinRate,
    leadOutcomeCount,
    openLeadValue,
    expectedLeadValue: leadOutcomeCount < 3 || leadWinRate === null ? null : openLeadValue * leadWinRate,
    proposalWinRate,
    proposalOutcomeCount,
    openProposalValue,
    expectedProposalValue: proposalOutcomeCount < 3 || proposalWinRate === null ? null : openProposalValue * proposalWinRate,
  };
}

export function assessEventReadiness(event: EventReadiness, today: string) {
  const daysUntil = Math.ceil((new Date(`${event.event_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  const lineupCoverage = event.required_roles ? Math.min(1, event.confirmed_musicians / event.required_roles) : 1;
  const readiness = Math.round(
    lineupCoverage * 40
    + (event.songs_selected > 0 ? 25 : 0)
    + (event.equipment_items > 0 ? 15 : 0)
    + Math.max(0, 20 - event.required_tasks_open * 5),
  );
  const risk = readiness < 50 || (daysUntil <= 14 && readiness < 80) ? "alto" : readiness < 75 || (daysUntil <= 30 && readiness < 90) ? "medio" : "baixo";
  return { daysUntil, readiness, risk };
}

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
