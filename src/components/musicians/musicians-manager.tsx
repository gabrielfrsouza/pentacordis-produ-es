"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Musician, MusicianRole, MusicianTier } from "@/types/database";
import { EditorialEmpty } from "@/components/ui/editorial-empty";

type Props = {
  initialMusicians: Musician[];
  initialRoles: MusicianRole[];
  historyCounts: Record<string, number>;
};

const roleOptions = ["soprano", "contralto", "tenor", "baixo", "piano", "violino", "violoncelo", "trompete", "flauta", "tecnico_som"];

export function MusiciansManager({
  initialMusicians,
  initialRoles,
  historyCounts,
  openCreateOnLoad = false,
}: Props & { openCreateOnLoad?: boolean }) {
  const [musicians, setMusicians] = useState(initialMusicians);
  const [roles, setRoles] = useState(initialRoles);
  const [open, setOpen] = useState(openCreateOnLoad);
  const [editing, setEditing] = useState<Musician | null>(null);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<MusicianTier | "todos">("todos");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [cityFilter, setCityFilter] = useState("");
  const [minimumScore, setMinimumScore] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return musicians.filter((musician) => {
      const musicianRoles = roles.filter((role) => role.musician_id === musician.id);
      return (
        (!search ||
          musician.full_name.toLowerCase().includes(search.toLowerCase()) ||
          musician.stage_name?.toLowerCase().includes(search.toLowerCase()) ||
          false) &&
        (tier === "todos" || musician.tier === tier) &&
        (!cityFilter || musician.city?.toLowerCase() === cityFilter.toLowerCase()) &&
        (musician.sight_reading_score ?? 0) >= minimumScore &&
        (roleFilter === "todos" || musicianRoles.some((role) => role.role_name === roleFilter))
      );
    });
  }, [musicians, roles, search, tier, cityFilter, minimumScore, roleFilter]);

  async function saveMusician(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const payload = {
      full_name: String(form.get("full_name")),
      stage_name: String(form.get("stage_name") || "") || null,
      phone: String(form.get("phone") || "") || null,
      email: String(form.get("email") || "") || null,
      city: String(form.get("city") || "") || null,
      tier: String(form.get("tier")) as MusicianTier,
      sight_reading_score: Number(form.get("sight_reading_score")) || null,
      base_fee: Number(form.get("base_fee")) || null,
      pix_key: String(form.get("pix_key") || "") || null,
      has_own_transport: form.get("has_own_transport") === "on",
      conduct_term_signed_at: form.get("conduct_term_signed") === "on" ? editing?.conduct_term_signed_at ?? new Date().toISOString() : null,
      tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      is_active: form.get("is_active") === "on",
      notes: String(form.get("notes") || "") || null,
    };

    const selectedRoles = form.getAll("roles").map(String);
    let saved: Musician;
    if (editing) {
      const result = await supabase.from("musicians").update(payload).eq("id", editing.id).select("*").single();
      if (result.error) { setMessage(result.error.message); return; }
      saved = result.data;
      setMusicians((items) => items.map((item) => item.id === saved.id ? saved : item));
    } else {
      const result = await supabase.from("musicians").insert(payload).select("*").single();
      if (result.error) { setMessage(result.error.message); return; }
      saved = result.data;
      setMusicians((items) => [...items, saved]);
    }

    await supabase.from("musician_roles").delete().eq("musician_id", saved.id);
    if (selectedRoles.length > 0) {
      const result = await supabase.from("musician_roles").insert(
        selectedRoles.map((roleName, index) => ({
          musician_id: saved.id,
          role_name: roleName,
          is_primary: index === 0,
        })),
      ).select("*");
      if (result.data) setRoles((items) => [...items.filter((role) => role.musician_id !== saved.id), ...result.data]);
    } else {
      setRoles((items) => items.filter((role) => role.musician_id !== saved.id));
    }
    setOpen(false);
    setEditing(null);
    setMessage("Cadastro salvo.");
  }

  async function removeMusician(musician: Musician) {
    if (!window.confirm(`Excluir ${musician.full_name}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("musicians").delete().eq("id", musician.id);
    if (error) { setMessage(error.message); return; }
    setMusicians((items) => items.filter((item) => item.id !== musician.id));
    setRoles((items) => items.filter((role) => role.musician_id !== musician.id));
  }

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(musician: Musician) {
    setEditing(musician);
    setOpen(true);
  }

  const editingRoles = editing ? roles.filter((role) => role.musician_id === editing.id).map((role) => role.role_name) : [];

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Casting</p>
          <h1 className="mt-2 text-2xl font-semibold">Banco de Talentos</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/musicos/termo" className="flex h-10 items-center border border-neutral-300 px-3 text-[9px] font-medium uppercase tracking-[0.14em] text-neutral-600">
            Termo de parceria
          </Link>
          <button type="button" onClick={openNew} className="flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-bold text-zinc-950 hover:bg-gold-hover">
            <Plus size={17} /> <span className="hidden sm:inline">Novo músico</span>
          </button>
        </div>
      </div>

      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <section className="mb-5 grid gap-3 rounded-xl border border-border bg-surface p-4 lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px_140px]">
        <label className="relative">
          <Search className="absolute left-3 top-3 text-muted" size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou nome artístico" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-gold" />
        </label>
        <select value={tier} onChange={(event) => setTier(event.target.value as MusicianTier | "todos")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none">
          <option value="todos">Todos os tiers</option><option value="nucleo_fixo">Núcleo fixo</option><option value="convidado_a">Convidado A</option><option value="convidado_b">Convidado B</option>
        </select>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none">
          <option value="todos">Todas funções</option>{roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Cidade" className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-gold" />
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted">
          <SlidersHorizontal size={14} /><span>Nota  {minimumScore}+</span>
          <input type="range" min="1" max="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} className="w-full accent-gold" />
        </label>
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden grid-cols-[1.4fr_.7fr_.7fr_.7fr_.5fr_.5fr_80px] gap-3 border-b border-border px-5 py-3 text-xs font-medium text-muted md:grid">
          <span>Músico</span><span>Funções</span><span>Cidade</span><span>Tier</span><span>Leitura</span><span>Eventos</span><span />
        </div>
        {filtered.length === 0 ? (
          <EditorialEmpty title="Nenhum músico encontrado" description="Ajuste os filtros ou cadastre um novo talento." action={<button type="button" onClick={openNew} className="border-b border-black pb-1 text-[10px] font-medium uppercase tracking-[0.18em]">Novo músico</button>} />
        ) : filtered.map((musician) => {
          const musicianRoles = roles.filter((role) => role.musician_id === musician.id);
          return (
            <button type="button" key={musician.id} onClick={() => openEdit(musician)} className="grid w-full gap-3 border-b border-border px-5 py-4 text-left last:border-0 hover:bg-white/[0.025] md:grid-cols-[1.4fr_.7fr_.7fr_.7fr_.5fr_.5fr_80px] md:items-center">
              <div><p className="font-medium">{musician.full_name}</p><p className="mt-1 text-xs text-muted">{musician.stage_name ?? "Sem nome artístico"}</p></div>
              <div className="text-sm text-muted">{musicianRoles.map((role) => role.role_name).join(", ") || "—"}</div>
              <div className="text-sm text-muted">{musician.city ?? "—"}</div>
              <div className="text-xs text-muted">{musician.tier.replace("_", " ")}</div>
              <div className="text-sm text-gold">{musician.sight_reading_score ?? "—"}</div>
              <div className="text-sm text-muted">{historyCounts[musician.id] ?? 0}</div>
              <span className="text-right text-xs text-gold">Editar</span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/70">
          <button type="button" aria-label="Fechar" className="flex-1" onClick={() => setOpen(false)} />
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-border bg-white p-6">
            <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? "Editar músico" : "Novo músico"}</h2><button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg border border-border"><X size={18} /></button></div>
            <form onSubmit={saveMusician} className="space-y-4">
              <Field name="full_name" label="Nome completo" defaultValue={editing?.full_name} required />
              <div className="grid gap-4 sm:grid-cols-2"><Field name="stage_name" label="Nome artístico" defaultValue={editing?.stage_name ?? ""} /><Field name="city" label="Cidade" defaultValue={editing?.city ?? ""} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field name="phone" label="Telefone" defaultValue={editing?.phone ?? ""} /><Field name="email" label="E-mail" type="email" defaultValue={editing?.email ?? ""} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm text-muted">Tier<select name="tier" defaultValue={editing?.tier ?? "convidado_a"} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"><option value="nucleo_fixo">Núcleo fixo</option><option value="convidado_a">Convidado A</option><option value="convidado_b">Convidado B</option></select></label>
                <Field name="sight_reading_score" label="Nota leitura" type="number" defaultValue={editing?.sight_reading_score ?? 3} />
                <Field name="base_fee" label="Cachê base" type="number" defaultValue={editing?.base_fee ?? 0} />
              </div>
              <Field name="pix_key" label="Chave Pix" defaultValue={editing?.pix_key ?? ""} />
              <fieldset><legend className="mb-2 text-sm text-muted">Funções</legend><div className="grid grid-cols-2 gap-2">{roleOptions.map((role) => <label key={role} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><input type="checkbox" name="roles" value={role} defaultChecked={editingRoles.includes(role)} className="accent-gold" />{role}</label>)}</div></fieldset>
              <label className="block text-sm text-muted">Observações<textarea name="notes" defaultValue={editing?.notes ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
              <label className="block text-sm text-muted">Tags<input name="tags" defaultValue={editing?.tags.join(", ") ?? ""} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
              <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="has_own_transport" defaultChecked={editing?.has_own_transport ?? false} className="accent-gold" />Possui transporte</label><label className="flex items-center gap-2"><input type="checkbox" name="conduct_term_signed" defaultChecked={Boolean(editing?.conduct_term_signed_at)} className="accent-gold" />Termo assinado</label><label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={editing?.is_active ?? true} className="accent-gold" />Ativo</label></div>
              <div className="flex justify-between pt-2">{editing ? <button type="button" onClick={() => removeMusician(editing)} className="h-10 rounded-lg border border-red-500/30 px-4 text-sm text-red-300">Excluir</button> : <span />}<button type="submit" className="h-10 rounded-lg bg-gold px-5 text-sm font-bold text-zinc-950">Salvar</button></div>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Field({ name, label, type = "text", defaultValue, required = false }: { name: string; label: string; type?: string; defaultValue?: string | number; required?: boolean }) {
  return <label className="block text-sm text-muted">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label>;
}
