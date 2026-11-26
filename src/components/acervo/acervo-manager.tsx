"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FileAudio, FileText, Plus, Search, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Song, SongAsset } from "@/types/database";
import { EditorialEmpty } from "@/components/ui/editorial-empty";

type AssetWithSignedUrl = SongAsset & { signed_url: string };
type Props = { initialSongs: Song[]; initialAssets: AssetWithSignedUrl[] };

export function AcervoManager({ initialSongs, initialAssets }: Props) {
  const [songs, setSongs] = useState(initialSongs);
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => songs.filter((song) =>
    (category === "todos" || song.category === category) &&
    (!search || song.title.toLowerCase().includes(search.toLowerCase()) || song.composer?.toLowerCase().includes(search.toLowerCase())),
  ), [songs, search, category]);

  async function createSong(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")),
      composer: String(form.get("composer") || "") || null,
      category: String(form.get("category") || "") || null,
      default_key: String(form.get("default_key") || "") || null,
      duration_seconds: Number(form.get("duration_seconds")) || null,
      is_pentacordis_arrangement: form.get("arrangement") === "on",
    };
    const supabase = createClient();
    const result = await supabase.from("songs").insert(payload).select("*").single();
    if (result.error) { setMessage(result.error.message); return; }
    setSongs((items) => [...items, result.data]);
    event.currentTarget.reset();
    setMessage("Música adicionada ao acervo.");
  }

  async function removeSong(song: Song) {
    if (!window.confirm(`Excluir "${song.title}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("songs").delete().eq("id", song.id);
    if (error) { setMessage(error.message); return; }
    const storagePaths = assets
      .filter((asset) => asset.song_id === song.id && asset.file_url.startsWith("songs/"))
      .map((asset) => asset.file_url);
    setSongs((items) => items.filter((item) => item.id !== song.id));
    setAssets((items) => items.filter((item) => item.song_id !== song.id));
    if (storagePaths.length > 0) {
      const removal = await supabase.storage.from("pentacordis-assets").remove(storagePaths);
      if (removal.error) {
        setMessage(`Música removida, mas os arquivos não puderam ser apagados: ${removal.error.message}`);
      }
    }
  }

  async function uploadAsset(song: Song, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) { setMessage("Selecione um arquivo."); return; }
    const assetType = String(form.get("asset_type"));
    const targetRole = String(form.get("target_role") || "todos");
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const uniqueId = globalThis.crypto.randomUUID();
    const path = `songs/${song.id}/${uniqueId}-${safeName}`;
    const storage = supabase.storage.from("pentacordis-assets");
    const upload = await storage.upload(path, file, { upsert: false });
    if (upload.error) { setMessage(upload.error.message); return; }
    const signedUrlResult = await storage.createSignedUrl(path, 3600);
    if (signedUrlResult.error) {
      const cleanup = await storage.remove([path]);
      setMessage(cleanup.error
        ? `Não foi possível gerar o link: ${signedUrlResult.error.message}. O arquivo enviado não pôde ser removido: ${cleanup.error.message}`
        : signedUrlResult.error.message);
      return;
    }
    const result = await supabase.from("song_assets").insert({
      song_id: song.id,
      asset_type: assetType as SongAsset["asset_type"],
      target_role: targetRole,
      file_url: path,
      key_signature: String(form.get("key_signature") || "") || null,
    }).select("*").single();
    if (result.error) {
      const cleanup = await storage.remove([path]);
      setMessage(cleanup.error
        ? `${result.error.message}. O arquivo enviado não pôde ser removido: ${cleanup.error.message}`
        : result.error.message);
      return;
    }
    setAssets((items) => [...items, { ...result.data, signed_url: signedUrlResult.data.signedUrl }]);
    event.currentTarget.reset();
    setMessage("Arquivo enviado.");
  }

  async function removeAsset(asset: SongAsset) {
    const supabase = createClient();
    const { error } = await supabase.from("song_assets").delete().eq("id", asset.id);
    if (error) { setMessage(error.message); return; }
    setAssets((items) => items.filter((item) => item.id !== asset.id));
    if (asset.file_url.startsWith("songs/")) {
      const removal = await supabase.storage.from("pentacordis-assets").remove([asset.file_url]);
      if (removal.error) {
        setMessage(`O item foi removido do acervo, mas o arquivo não pôde ser apagado: ${removal.error.message}`);
      }
    }
  }

  const categories = Array.from(new Set(songs.map((song) => song.category).filter((item): item is string => Boolean(item))));

  return (
    <div>
      <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Repertório</p><h1 className="mt-2 text-2xl font-semibold">Biblioteca de Acervo</h1></div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Plus size={17} className="text-gold" />Nova música</h2>
          <form onSubmit={createSong} className="space-y-3">
            <input name="title" required placeholder="Título" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <input name="composer" placeholder="Compositor" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <input name="category" placeholder="Categoria" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            <div className="grid grid-cols-2 gap-3"><input name="default_key" placeholder="Tom" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /><input name="duration_seconds" type="number" placeholder="Segundos" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></div>
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="arrangement" defaultChecked className="accent-gold" />Arranjo Pentacordis</label>
            <button type="submit" className="h-10 w-full rounded-lg bg-gold text-sm font-bold text-zinc-950">Adicionar</button>
          </form>
        </aside>
        <section>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
            <label className="relative"><Search className="absolute left-3 top-3 text-muted" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar música ou compositor" className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm" /></label>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"><option value="todos">Todas categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          </div>
          <div className="space-y-3">
            {filtered.length === 0 ? <EditorialEmpty title="Nenhuma música encontrada" description="Ajuste a busca ou adicione uma obra ao acervo." /> : filtered.map((song) => {
              const songAssets = assets.filter((asset) => asset.song_id === song.id);
              const isExpanded = expanded === song.id;
              return (
                <article key={song.id} className="rounded-xl border border-border bg-surface">
                  <button type="button" onClick={() => setExpanded(isExpanded ? null : song.id)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                    <div><p className="font-medium">{song.title}</p><p className="mt-1 text-xs text-muted">{song.composer ?? "Compositor não informado"} · {song.category ?? "Sem categoria"} · Tom {song.default_key ?? "—"}</p></div>
                    <span className="text-xs text-gold">{songAssets.length} arquivo(s)</span>
                  </button>
                  {isExpanded ? <div className="border-t border-border p-5">
                    <div className="mb-4 space-y-2">{songAssets.map((asset) => <div key={asset.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">{asset.asset_type === "audio_guia" ? <FileAudio size={16} className="shrink-0 text-gold" /> : <FileText size={16} className="shrink-0 text-gold" />}<a href={asset.signed_url} target="_blank" rel="noreferrer" className="truncate text-xs text-muted hover:text-gold">{asset.asset_type} · {asset.target_role}</a></div>
                      <button type="button" onClick={() => removeAsset(asset)} className="ml-3 text-xs text-red-300">Excluir</button>
                    </div>)}</div>
                    <form onSubmit={(event) => uploadAsset(song, event)} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2">
                      <label className="sm:col-span-2 flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted"><Upload size={15} /><input name="file" type="file" required accept=".pdf,.mp3,.wav,audio/*,application/pdf" className="min-w-0 text-xs" /></label>
                      <select name="asset_type" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="partitura_geral">Partitura geral</option><option value="partitura_naipe">Partitura naipe</option><option value="audio_guia">Áudio-guia</option><option value="letra">Letra</option></select>
                      <input name="target_role" placeholder="Naipe/alvo (todos)" defaultValue="todos" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                      <input name="key_signature" placeholder="Tonalidade" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                      <button type="submit" className="h-10 rounded-lg border border-gold/30 text-sm text-gold">Enviar arquivo</button>
                    </form>
                    <button type="button" onClick={() => removeSong(song)} className="mt-4 text-xs text-red-300">Excluir música</button>
                  </div> : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
