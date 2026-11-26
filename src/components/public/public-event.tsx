"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Clock3, MapPin, Moon, Music2, Shirt, Sun, Sunrise } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DURATION_BASE, EASE_EDITORIAL } from "@/lib/motion";

type PublicAsset = {
  asset_type: string;
  target_role: string;
  file_url: string;
  key_signature: string | null;
};

type PublicSetlistItem = {
  order_index: number;
  moment_label: string | null;
  event_key: string | null;
  performance_notes: string | null;
  title: string;
  composer: string | null;
  assets: PublicAsset[];
};

type PublicLineupItem = {
  role_needed: string;
  stage_name: string;
};

type PublicEventData = {
  id: string;
  title: string;
  event_type: string | null;
  event_date: string;
  load_in_time: string | null;
  soundcheck_time: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  venue_address: string | null;
  maps_url: string | null;
  dress_code: string | null;
  logistics_notes: string | null;
  lineup: PublicLineupItem[];
  setlist: PublicSetlistItem[];
};

type Props = {
  eventData: unknown;
};

function isPublicEventData(value: unknown): value is PublicEventData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.title === "string" && typeof candidate.event_date === "string";
}

function Countdown({ date }: { date: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const target = new Date(`${date}T23:59:59`).getTime();
      const difference = target - Date.now();
      if (difference <= 0) {
        setLabel("Evento realizado");
        return;
      }
      const days = Math.floor(difference / 86_400_000);
      const hours = Math.floor((difference % 86_400_000) / 3_600_000);
      setLabel(`${days}d ${hours}h`);
    }
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [date]);

  return <span className="text-gold">{label}</span>;
}

function formatTime(value: string | null) {
  if (!value) return "A definir";
  return value.slice(0, 5);
}

type ScreenWakeSentinel = {
  release: () => Promise<void>;
};

type ScreenWakeNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ScreenWakeSentinel>;
  };
};

export function PublicEvent({ eventData }: Props) {
  if (!isPublicEventData(eventData)) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <p className="text-sm text-muted">Dados do evento indisponíveis.</p>
      </main>
    );
  }
  return <PublicEventContent event={eventData} />;
}

function PublicEventContent({ event }: { event: PublicEventData }) {
  const [backstage, setBackstage] = useState(false);
  const [wakeLock, setWakeLock] = useState<ScreenWakeSentinel | null>(null);
  const [wakeMessage, setWakeMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState("TODOS");

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    event.setlist.forEach((item) => {
      item.assets.forEach((asset) => {
        if (asset.target_role && asset.target_role !== "todos") {
          roles.add(asset.target_role.toUpperCase());
        }
      });
    });
    return ["TODOS", ...Array.from(roles).sort()];
  }, [event.setlist]);

  async function toggleWakeLock() {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      setWakeMessage("Tela poderá apagar novamente.");
      return;
    }
    const navigatorWithWakeLock = navigator as ScreenWakeNavigator;
    if (!navigatorWithWakeLock.wakeLock) {
      setWakeMessage("Este navegador não oferece manutenção de tela.");
      return;
    }
    try {
      const sentinel = await navigatorWithWakeLock.wakeLock.request("screen");
      setWakeLock(sentinel);
      setWakeMessage("Tela mantida acesa.");
    } catch {
      setWakeMessage("Não foi possível manter a tela acesa.");
    }
  }

  useEffect(() => {
    return () => {
      if (wakeLock) void wakeLock.release();
    };
  }, [wakeLock]);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${event.event_date}T12:00:00`));

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={backstage ? "backstage" : "editorial"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION_BASE, ease: EASE_EDITORIAL }}
        className={`mx-auto min-h-screen max-w-2xl px-4 pb-12 pt-5 sm:px-6 ${backstage ? "bg-[#0A0A0A] text-white" : "bg-white text-[#0A0A0A]"}`}
      >
      <div className="mb-4 flex items-center justify-between">
        <BrandLogo variant={backstage ? "white" : "black"} size="xs" animated />
        <div className="flex gap-2">
          <button type="button" onClick={toggleWakeLock} className={`flex h-9 items-center gap-2 rounded-none border px-3 text-[9px] uppercase tracking-[0.16em] ${backstage ? "border-white/30" : "border-neutral-300"}`}>
            <Sunrise size={14} />Tela acesa
          </button>
          <button type="button" onClick={() => setBackstage((value) => !value)} className={`grid size-9 place-items-center rounded-none border ${backstage ? "border-white/30" : "border-neutral-300"}`} aria-label="Alternar modo bastidor">
            {backstage ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
      {wakeMessage ? <p className={`mb-3 text-[10px] uppercase tracking-[0.12em] ${backstage ? "text-neutral-400" : "text-neutral-500"}`}>{wakeMessage}</p> : null}

      <header className={`relative overflow-hidden border p-6 ${backstage ? "border-white/15 bg-[#111111]" : "border-neutral-200 bg-white"}`}>
        <BrandMark variant="watermark" size="hero" className="absolute -bottom-8 -right-8" />
        <p className="relative text-[9px] font-medium uppercase tracking-[0.24em] text-[#B89B5E]">{event.event_type ?? "Evento"}</p>
        <h1 className="relative mt-4 font-display text-[38px] font-light leading-none">{event.title}</h1>
        <p className={`relative mt-3 text-sm ${backstage ? "text-neutral-400" : "text-neutral-500"}`}>{dateLabel}</p>
        <div className="relative mt-5 flex items-center gap-2 text-sm"><Clock3 size={16} className="text-[#B89B5E]" /><span>Contagem:</span><Countdown date={event.event_date} /></div>
      </header>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">Local</p>
            <h2 className="mt-1 font-semibold">{event.venue_name ?? "A definir"}</h2>
            {event.venue_address ? <p className="mt-1 text-sm text-muted">{event.venue_address}</p> : null}
          </div>
          {event.maps_url ? (
            <a
              href={event.maps_url}
              target="_blank"
              rel="noreferrer"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-zinc-950"
              aria-label="Abrir no Google Maps"
            >
              <MapPin size={19} />
            </a>
          ) : null}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-5 text-sm font-semibold text-neutral-800">Linha do tempo</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Chegada", event.load_in_time],
            ["Passagem", event.soundcheck_time],
            ["Início", event.start_time],
            ["Fim", event.end_time],
          ].map(([label, time], index) => (
            <div key={String(label)} className="relative text-center">
              {index < 3 ? <div className="absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[15px] h-px bg-gold/30" /> : null}
              <div className="relative mx-auto grid size-8 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold"><Clock3 size={14} /></div>
              <p className="mt-2 text-[10px] text-muted">{label}</p>
              <p className="mt-1 text-xs font-semibold">{formatTime(time as string | null)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/20 bg-gold/[0.07] p-5">
          <div className="flex items-center gap-2 text-gold"><Shirt size={17} /><h2 className="text-sm font-semibold">Dress Code</h2></div>
          <p className="mt-3 text-sm leading-6 text-muted">{event.dress_code ?? "A confirmar com a produção."}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Logística</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{event.logistics_notes ?? "Nenhuma orientação adicional."}</p>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Equipe escalada</h2>
        {event.lineup.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Escala em atualização.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {event.lineup.map((item, index) => (
              <div key={`${item.role_needed}-${index}`} className="rounded-lg border border-border px-3 py-3">
                <p className="font-medium">{item.stage_name}</p>
                <p className="mt-1 text-xs text-muted">{item.role_needed}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4">
        <div className="mb-3 flex items-center gap-2 px-1">
          <Music2 size={16} className="text-gold" />
          <h2 className="text-sm font-semibold">Repertório</h2>
          <span className="ml-auto text-xs text-muted">{event.setlist.length} música(s)</span>
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {roleOptions.map((role) => (
            <button
              type="button"
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`h-8 shrink-0 rounded-none border px-3 text-[9px] uppercase tracking-[0.16em] ${roleFilter === role ? "border-black bg-black text-white" : "border-neutral-300 text-neutral-500"}`}
            >
              {role}
            </button>
          ))}
        </div>
        {event.setlist.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">Setlist em atualização.</div>
        ) : (
          <div className="space-y-2">
            {event.setlist.map((item) => (
              roleFilter !== "TODOS" && !item.assets.some((asset) => asset.target_role.toUpperCase() === roleFilter)
                ? null
                : 
              <details key={`${item.order_index}-${item.title}`} className="group rounded-xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/10 text-xs font-bold text-gold">{item.order_index + 1}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.title}</p><p className="mt-1 truncate text-xs text-muted">{item.moment_label ?? "Repertório"} · Tom {item.event_key ?? "—"}</p></div>
                  <ChevronDown size={17} className="text-muted transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-border px-4 py-4">
                  {item.composer ? <p className="mb-3 text-xs text-muted">Composição: {item.composer}</p> : null}
                  {item.performance_notes ? <p className="mb-3 text-sm text-muted">{item.performance_notes}</p> : null}
                  {item.assets.length === 0 ? (
                    <p className="text-xs text-muted">Nenhum arquivo anexado.</p>
                  ) : (
                    <div className="space-y-2">
                      {item.assets
                        .filter((asset) => roleFilter === "TODOS" || asset.target_role.toUpperCase() === roleFilter)
                        .map((asset, index) => {
                        const isAudio = asset.asset_type === "audio_guia";
                        return (
                          <div key={`${asset.file_url}-${index}`} className="rounded-lg border border-border p-3">
                            {isAudio ? (
                              <audio controls preload="none" className="w-full">
                                <source src={asset.file_url} />
                              </audio>
                            ) : (
                              <a href={asset.file_url} target="_blank" rel="noreferrer" className="block text-sm text-gold">
                                Abrir {asset.asset_type.replaceAll("_", " ")}
                              </a>
                            )}
                            <p className="mt-2 text-[11px] text-muted">{asset.target_role} · {asset.key_signature ?? "Sem tom"}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
      </motion.main>
    </AnimatePresence>
  );
}
