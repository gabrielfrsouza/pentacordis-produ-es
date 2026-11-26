"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Bell, CalendarPlus, CalendarRange, ContactRound, Lightbulb, Plus, Search, UserPlus, Wallet, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  category: string;
  href: string;
};

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/[(),.*%\\'"]/g, " ").replace(/\s+/g, " ").trim();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultsForQuery, setResultsForQuery] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const rawTerm = query.trim();
    const term = normalizeSearchTerm(query);
    let active = true;
    if (term.length < 2) return;

    const supabase = createClient();
    const pattern = `%${term}%`;
    const digits = rawTerm.replace(/\D/g, "");
    const searchPhone = digits.length >= 5 && /^[+\d\s().-]+$/.test(rawTerm);
    async function search() {
      try {
        setSearching(true);
        const [
          eventsResult,
          musiciansResult,
          songsResult,
          leadsResult,
          contractsResult,
          proposalsResult,
          leadPhonesResult,
          contractPhonesResult,
        ] = await Promise.all([
          supabase.from("events").select("id,title,event_type").or(`title.ilike.${pattern},event_type.ilike.${pattern}`).limit(4),
          supabase.from("musicians").select("id,full_name,stage_name").or(`full_name.ilike.${pattern},stage_name.ilike.${pattern}`).limit(4),
          supabase.from("songs").select("id,title,composer").or(`title.ilike.${pattern},composer.ilike.${pattern}`).limit(4),
          supabase.from("leads").select("id,name,event_type").or(`name.ilike.${pattern},email.ilike.${pattern}`).limit(4),
          supabase.from("contracts").select("id,client_name,status").or(`client_name.ilike.${pattern},client_email.ilike.${pattern}`).limit(4),
          supabase.from("proposals").select("id,proposal_number,client_name,status").or(`client_name.ilike.${pattern},event_type.ilike.${pattern}`).limit(4),
          searchPhone
            ? supabase.from("leads").select("id,name,event_type").ilike("phone", `%${digits}%`).limit(4)
            : Promise.resolve({ data: [], error: null }),
          searchPhone
            ? supabase.from("contracts").select("id,client_name,status").ilike("client_phone", `%${digits}%`).limit(4)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const nextResults: SearchResult[] = [
          ...(eventsResult.data ?? []).map((item) => ({
            id: item.id,
            label: item.title,
            detail: item.event_type ?? "Evento",
            category: "Evento",
            href: `/eventos/${item.id}`,
          })),
          ...(musiciansResult.data ?? []).map((item) => ({
              id: item.id,
              label: item.full_name,
              detail: item.stage_name ?? "Músico",
              category: "Músico",
              href: "/musicos",
          })),
          ...(songsResult.data ?? []).map((item) => ({
            id: item.id,
            label: item.title,
            detail: item.composer ?? "Acervo musical",
            category: "Música",
            href: "/acervo",
          })),
          ...[...(leadsResult.data ?? []), ...(leadPhonesResult.data ?? [])]
            .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
            .map((item) => ({
              id: item.id,
              label: item.name,
              detail: item.event_type ?? "Lead",
              category: "Lead",
              href: "/comercial",
            })),
          ...[...(contractsResult.data ?? []), ...(contractPhonesResult.data ?? [])]
            .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index)
            .map((item) => ({
              id: item.id,
              label: item.client_name,
              detail: `Contrato · ${item.status}`,
              category: "Contrato",
              href: "/comercial?tab=contracts",
            })),
          ...(proposalsResult.data ?? []).map((item) => ({
            id: item.id,
            label: item.client_name,
            detail: `Proposta #${item.proposal_number} · ${item.status}`,
            category: "Proposta",
            href: `/orcamentos/proposta?proposalId=${item.id}`,
          })),
        ];

        const errors = [
          eventsResult.error,
          musiciansResult.error,
          songsResult.error,
          leadsResult.error,
          contractsResult.error,
          proposalsResult.error,
          leadPhonesResult.error,
          contractPhonesResult.error,
        ];
        if (active) {
          setResults(nextResults);
          setSearchError(errors.some(Boolean) ? "Alguns módulos não estão disponíveis para o seu perfil." : null);
          setResultsForQuery(term);
        }
      } catch {
        if (active) {
          setResults([]);
          setSearchError("A busca não pôde ser concluída. Tente novamente.");
          setResultsForQuery(term);
        }
      } finally {
        if (active) setSearching(false);
      }
    }

    const timeout = window.setTimeout(search, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const actions = useMemo(() => [
    { id: "new-lead", label: "Novo lead", detail: "Cadastro comercial", href: "/comercial?create=lead", icon: ContactRound },
    { id: "new-budget", label: "Novo orçamento", detail: "Simulador de orçamento", href: "/orcamentos", icon: WalletCards },
    { id: "new-event", label: "Novo evento", detail: "Cadastro de evento", href: "/eventos?create=1", icon: CalendarPlus },
    { id: "new-musician", label: "Novo músico", detail: "Cadastro de talento", href: "/musicos?create=1", icon: UserPlus },
    { id: "calendar", label: "Agenda central", detail: "Eventos, prazos e tarefas", href: "/calendario", icon: CalendarRange },
    { id: "maestro", label: "Maestro", detail: "Repertório, formações e indicadores", href: "/maestro", icon: Lightbulb },
    { id: "finance", label: "Centro financeiro", detail: "Lançamentos e fluxo de caixa", href: "/financeiro", icon: Wallet },
    { id: "notifications", label: "Notificações", detail: "Alertas da sua conta", href: "/notificacoes", icon: Bell },
  ], []);
  const searchTerm = normalizeSearchTerm(query);
  const hasSearchTerm = searchTerm.length >= 2;
  const visibleResults = hasSearchTerm && resultsForQuery === searchTerm ? results : [];
  const isSearching = hasSearchTerm && (searching || resultsForQuery !== searchTerm);
  const visibleSearchError = resultsForQuery === searchTerm ? searchError : null;

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return open ? (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/20 px-4 pt-[12vh] backdrop-blur-sm">
      <button type="button" aria-label="Fechar busca" className="absolute inset-0" onClick={() => setOpen(false)} />
      <Command
        shouldFilter={false}
        role="dialog"
        aria-label="Busca global e ações rápidas"
        aria-modal="true"
        className="relative w-full max-w-xl border border-neutral-300 bg-white shadow-lg"
      >
        <div className="flex h-14 items-center gap-3 border-b border-neutral-200 px-4">
          <Search size={18} className="text-neutral-400" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="BUSCAR EVENTOS, PESSOAS, CONTRATOS OU PROPOSTAS"
            className="h-full flex-1 border-0 bg-transparent text-xs uppercase tracking-[0.12em] outline-none placeholder:text-neutral-400"
          />
          <kbd className="border border-neutral-300 px-2 py-1 text-[9px] text-neutral-500">ESC</kbd>
        </div>
        <Command.List className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
          <Command.Group heading="Ações rápidas" className="px-2 py-2 text-[9px] uppercase tracking-[0.22em] text-neutral-400">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Command.Item
                  key={action.id}
                  value={`${action.label} ${action.detail}`}
                  onSelect={() => navigate(action.href)}
                  className="mt-1 flex cursor-pointer items-center gap-3 rounded-none px-3 py-3 text-sm text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-black"
                >
                  <Icon size={16} />
                  <span className="flex-1">{action.label}</span>
                  <span className="text-[9px] uppercase tracking-[0.12em] text-neutral-400">{action.detail}</span>
                  <Plus size={13} className="text-neutral-400" />
                </Command.Item>
              );
            })}
          </Command.Group>

          {isSearching ? <p className="px-4 py-4 text-xs text-neutral-500">Buscando...</p> : null}
          {visibleSearchError ? <p role="status" className="px-4 py-3 text-xs text-amber-800">{visibleSearchError}</p> : null}
          {hasSearchTerm && !isSearching && !visibleSearchError && visibleResults.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500">Nenhum registro encontrado.</p>
          ) : null}

          {visibleResults.length > 0 ? (
            <Command.Group heading="Resultados" className="mt-2 px-2 py-2 text-[9px] uppercase tracking-[0.22em] text-neutral-400">
              {visibleResults.map((result) => (
                <Command.Item
                  key={`${result.category}-${result.id}`}
                  value={`${result.category} ${result.label} ${result.detail}`}
                  onSelect={() => navigate(result.href)}
                  className="mt-1 flex cursor-pointer items-center justify-between gap-4 rounded-none px-3 py-3 text-sm text-neutral-700 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-black"
                >
                  <span className="min-w-0 truncate">{result.label}</span>
                  <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-neutral-400">{result.detail}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
      </Command>
    </div>
  ) : null;
}
