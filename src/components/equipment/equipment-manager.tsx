"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Equipment } from "@/types/database";
import { EditorialEmpty } from "@/components/ui/editorial-empty";

export function EquipmentManager({ initialEquipment }: { initialEquipment: Equipment[] }) {
  const [equipment, setEquipment] = useState(initialEquipment);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Equipment | null>(null);

  const filtered = useMemo(() => equipment.filter((item) =>
    (category === "todos" || item.category === category) &&
    (!search || item.name.toLowerCase().includes(search.toLowerCase())),
  ), [equipment, category, search]);

  async function saveEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      category: String(form.get("category")) as Equipment["category"],
      quantity_total: Number(form.get("quantity_total")),
      serial_or_notes: String(form.get("serial_or_notes") || "") || null,
      status: String(form.get("status")) as Equipment["status"],
    };
    const supabase = createClient();
    if (editing?.id) {
      const result = await supabase.from("equipment").update(payload).eq("id", editing.id).select("*").single();
      if (result.error) { setMessage(result.error.message); return; }
      setEquipment((items) => items.map((item) => item.id === editing.id ? result.data : item));
    } else {
      const result = await supabase.from("equipment").insert(payload).select("*").single();
      if (result.error) { setMessage(result.error.message); return; }
      setEquipment((items) => [...items, result.data]);
    }
    setEditing(null);
    setMessage("Inventário atualizado.");
    event.currentTarget.reset();
  }

  async function removeEquipment(item: Equipment) {
    if (!window.confirm(`Excluir "${item.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("equipment").delete().eq("id", item.id);
    if (error) { setMessage(error.message); return; }
    setEquipment((items) => items.filter((entry) => entry.id !== item.id));
  }

  return (
    <div>
      <div className="mb-7 flex items-end justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Patrimônio</p><h1 className="mt-2 text-2xl font-semibold">Inventário</h1></div>
        <button type="button" onClick={() => setEditing({ id: "", name: "", category: "som", quantity_total: 1, serial_or_notes: null, status: "disponivel", created_at: "", updated_at: "" })} className="flex h-10 items-center gap-2 rounded-lg bg-gold px-4 text-sm font-bold text-zinc-950"><Plus size={17} /><span className="hidden sm:inline">Novo item</span></button>
      </div>
      {message ? <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="relative"><Search className="absolute left-3 top-3 text-muted" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar item" className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm" /></label>
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"><option value="todos">Todas categorias</option><option value="som">Som</option><option value="instrumento">Instrumento</option><option value="uniforme_acessorio">Uniforme/Acessório</option><option value="cabos">Cabos</option></select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="hidden grid-cols-[1.4fr_.7fr_.5fr_.7fr_160px] gap-3 border-b border-border px-5 py-3 text-xs text-muted md:grid"><span>Item</span><span>Categoria</span><span>Quantidade</span><span>Estado</span><span /></div>
        {filtered.length === 0 ? <EditorialEmpty title="Nenhum item encontrado" description="Cadastre um equipamento no inventário." action={<button type="button" onClick={() => setEditing({ id: "", name: "", category: "som", quantity_total: 1, serial_or_notes: null, status: "disponivel", created_at: "", updated_at: "" })} className="border-b border-black pb-1 text-[10px] font-medium uppercase tracking-[0.18em]">Novo item</button>} /> : filtered.map((item) => (
          <div key={item.id} className="grid gap-3 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[1.4fr_.7fr_.5fr_.7fr_160px] md:items-center">
            <div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted">{item.serial_or_notes ?? "Sem observações"}</p></div>
            <p className="text-sm text-muted">{item.category.replace("_", " ")}</p>
            <p className="text-sm text-muted">{item.quantity_total}</p>
            <p className={item.status === "disponivel" ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>{item.status}</p>
            <div className="flex gap-2"><button type="button" onClick={() => setEditing(item)} className="h-9 flex-1 rounded-lg border border-border text-xs hover:border-gold/40">Editar</button><button type="button" onClick={() => removeEquipment(item)} className="h-9 rounded-lg border border-red-500/20 px-3 text-xs text-red-300">Excluir</button></div>
          </div>
        ))}
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-5">
          <form onSubmit={saveEquipment} className="w-full max-w-md rounded-xl border border-border bg-white p-6">
            <h2 className="mb-5 text-lg font-semibold">{editing.id ? "Editar item" : "Novo item"}</h2>
            <div className="space-y-4">
              <label className="block text-sm">Nome<input name="name" required defaultValue={editing.name} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="text-sm">Categoria<select name="category" defaultValue={editing.category} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"><option value="som">Som</option><option value="instrumento">Instrumento</option><option value="uniforme_acessorio">Uniforme/Acessório</option><option value="cabos">Cabos</option></select></label><label className="text-sm">Quantidade<input name="quantity_total" type="number" min="0" required defaultValue={editing.quantity_total} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3" /></label></div>
              <label className="block text-sm">Status<select name="status" defaultValue={editing.status} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3"><option value="disponivel">Disponível</option><option value="manutencao">Manutenção</option></select></label>
              <label className="block text-sm">Serial ou observações<textarea name="serial_or_notes" defaultValue={editing.serial_or_notes ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="h-10 rounded-lg border border-border px-4 text-sm">Cancelar</button><button type="submit" className="h-10 rounded-lg bg-gold px-5 text-sm font-bold text-zinc-950">Salvar</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
