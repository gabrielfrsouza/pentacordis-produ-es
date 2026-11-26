"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Equipment, EquipmentAsset, EquipmentAssetCondition, EquipmentMaintenance, Json } from "@/types/database";

const conditions: EquipmentAssetCondition[] = ["novo", "bom", "regular", "danificado", "baixado"];

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "—";
}

function money(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function EquipmentAssetsManager({
  initialAssets,
  initialMaintenance,
  equipment,
  queryErrors,
}: {
  initialAssets: EquipmentAsset[];
  initialMaintenance: EquipmentMaintenance[];
  equipment: Equipment[];
  queryErrors: string[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [editing, setEditing] = useState<EquipmentAsset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<EquipmentAsset | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const equipmentNames = useMemo(() => new Map(equipment.map((item) => [item.id, item.name])), [equipment]);

  async function saveAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const purchaseValue = String(values.get("purchase_value") || "");
    const payload = {
      equipment_id: String(values.get("equipment_id")),
      asset_code: String(values.get("asset_code")).trim(),
      serial_number: String(values.get("serial_number") || "") || null,
      brand: String(values.get("brand") || "") || null,
      model: String(values.get("model") || "") || null,
      condition: String(values.get("condition")) as EquipmentAssetCondition,
      current_location: String(values.get("current_location") || "") || null,
      acquired_at: String(values.get("acquired_at") || "") || null,
      purchase_value: purchaseValue ? Number(purchaseValue) : null,
      last_maintenance_at: editing?.last_maintenance_at ?? null,
      next_maintenance_at: String(values.get("next_maintenance_at") || "") || null,
      notes: String(values.get("notes") || "") || null,
      is_active: editing?.is_active ?? true,
    };
    if (!payload.equipment_id || !payload.asset_code || (purchaseValue && (!Number.isFinite(payload.purchase_value) || Number(payload.purchase_value) < 0))) {
      setMessage("Informe a categoria, o código único e um valor de compra válido.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const result = editing?.id
      ? await supabase.from("equipment_assets").update(payload).eq("id", editing.id).select("*").single()
      : await supabase.from("equipment_assets").insert(payload).select("*").single();
    setSaving(false);
    if (result.error) {
      setMessage(`Não foi possível salvar o patrimônio: ${result.error.message}`);
      return;
    }
    setAssets((items) => editing?.id
      ? items.map((item) => item.id === editing.id ? result.data : item)
      : [...items, result.data].sort((a, b) => a.asset_code.localeCompare(b.asset_code)));
    setEditing(null);
    form.reset();
  }

  async function recordMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAsset) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const cost = Number(values.get("cost") || 0);
    const maintenanceType = String(values.get("maintenance_type") || "").trim();
    if (!maintenanceType || !Number.isFinite(cost) || cost < 0) {
      setMessage("Informe o tipo de manutenção e um custo válido.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const maintenanceInput: Json = {
      maintenance_type: maintenanceType,
      description: String(values.get("description") || "") || null,
      cost,
      performed_at: String(values.get("performed_at")),
      next_due_at: String(values.get("next_due_at") || "") || null,
      performed_by: String(values.get("performed_by") || "") || null,
    };
    const supabase = createClient();
    const result = await supabase.rpc("record_equipment_maintenance", {
      p_asset_id: selectedAsset.id,
      p_maintenance: maintenanceInput,
    });
    if (result.error) {
      setSaving(false);
      setMessage(`Não foi possível registrar a manutenção: ${result.error.message}`);
      return;
    }
    const [maintenanceResult, assetResult] = await Promise.all([
      supabase.from("equipment_maintenance").select("*").eq("asset_id", selectedAsset.id).order("performed_at", { ascending: false }),
      supabase.from("equipment_assets").select("*").eq("id", selectedAsset.id).single(),
    ]);
    setSaving(false);
    if (maintenanceResult.error || assetResult.error) {
      setMessage(`Manutenção registrada, mas a atualização da tela falhou: ${maintenanceResult.error?.message ?? assetResult.error?.message}`);
      return;
    }
    setMaintenance((items) => [
      ...items.filter((item) => item.asset_id !== selectedAsset.id),
      ...maintenanceResult.data,
    ]);
    setAssets((items) => items.map((item) => item.id === selectedAsset.id ? assetResult.data : item));
    setSelectedAsset(assetResult.data);
    form.reset();
  }

  async function toggleActive(asset: EquipmentAsset) {
    const result = await createClient()
      .from("equipment_assets")
      .update({ is_active: !asset.is_active, updated_at: new Date().toISOString() })
      .eq("id", asset.id)
      .select("*")
      .single();
    if (result.error) {
      setMessage(`Não foi possível atualizar o patrimônio: ${result.error.message}`);
      return;
    }
    setAssets((items) => items.map((item) => item.id === asset.id ? result.data : item));
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Controle unitário</p><h2 className="mt-2 font-light text-3xl">Patrimônio individual</h2></div>
        <button type="button" disabled={equipment.length === 0} onClick={() => setEditing({ id: "", equipment_id: equipment[0]?.id ?? "", asset_code: "", serial_number: null, brand: null, model: null, condition: "bom", current_location: null, acquired_at: null, purchase_value: null, last_maintenance_at: null, next_maintenance_at: null, notes: null, is_active: true, created_at: "", updated_at: "" })} className="flex h-10 items-center gap-2 bg-black px-5 text-[10px] font-medium uppercase tracking-[0.18em] text-white disabled:opacity-40"><Plus size={16} /> Cadastrar ativo</button>
      </div>
      {queryErrors.length ? <div role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><p className="font-medium">Alguns dados de patrimônio estão indisponíveis para este perfil.</p><ul className="mt-2 list-inside list-disc text-xs">{queryErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      {message ? <p role="status" className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      {equipment.length === 0 ? <p className="mb-4 border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Cadastre primeiro uma categoria no inventário agregado para associar os ativos individuais.</p> : null}
      <div className="overflow-hidden border border-neutral-200 bg-white">
        <div className="hidden grid-cols-[1fr_1fr_.7fr_.7fr_.7fr_190px] gap-3 border-b border-neutral-200 px-5 py-3 text-[9px] uppercase tracking-[0.16em] text-neutral-500 md:grid"><span>Código / ativo</span><span>Categoria</span><span>Estado</span><span>Local</span><span>Próx. manutenção</span><span /></div>
        {assets.length === 0 ? <p className="px-5 py-12 text-center text-sm text-neutral-500">{queryErrors.some((error) => error.startsWith("patrimônio")) ? "Não foi possível confirmar a lista de bens individuais." : "Nenhum bem individual foi cadastrado."}</p> : assets.map((asset) => (
          <article key={asset.id} className="grid gap-3 border-b border-neutral-200 px-5 py-4 last:border-0 md:grid-cols-[1fr_1fr_.7fr_.7fr_.7fr_190px] md:items-center">
            <div><p className="font-medium">{asset.asset_code}</p><p className="mt-1 text-xs text-neutral-500">{[asset.brand, asset.model, asset.serial_number].filter(Boolean).join(" · ") || "Sem detalhes"}</p></div>
            <p className="text-sm text-neutral-600">{equipmentNames.get(asset.equipment_id) ?? "Categoria indisponível"}</p>
            <p className="text-sm capitalize text-neutral-600">{asset.condition}</p>
            <p className="text-sm text-neutral-600">{asset.current_location ?? "—"}</p>
            <p className="text-sm text-neutral-600">{date(asset.next_maintenance_at)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedAsset(asset)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]"><Wrench size={13} className="mr-1 inline" />Manutenção</button>
              <button type="button" onClick={() => setEditing(asset)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]">Editar</button>
              <button type="button" onClick={() => toggleActive(asset)} className="h-8 border border-neutral-300 px-3 text-[9px] uppercase tracking-[0.1em]">{asset.is_active ? "Baixar" : "Reativar"}</button>
            </div>
          </article>
        ))}
      </div>

      {editing ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
        <form onSubmit={saveAsset} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-neutral-200 bg-white p-6">
          <h3 className="mb-5 text-lg font-medium">{editing.id ? "Editar ativo" : "Cadastrar ativo individual"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Categoria agregada<select name="equipment_id" required defaultValue={editing.equipment_id} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-3">{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="text-sm">Código patrimonial<input name="asset_code" required defaultValue={editing.asset_code} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Número de série<input name="serial_number" defaultValue={editing.serial_number ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Marca<input name="brand" defaultValue={editing.brand ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Modelo<input name="model" defaultValue={editing.model ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Condição<select name="condition" defaultValue={editing.condition} className="mt-1 h-10 w-full border border-neutral-300 bg-white px-3">{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select></label>
            <label className="text-sm">Localização atual<input name="current_location" defaultValue={editing.current_location ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Data de aquisição<input name="acquired_at" type="date" defaultValue={editing.acquired_at ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Valor de compra<input name="purchase_value" type="number" min="0" step="0.01" defaultValue={editing.purchase_value ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm">Próxima manutenção<input name="next_maintenance_at" type="date" defaultValue={editing.next_maintenance_at ?? ""} className="mt-1 h-10 w-full border border-neutral-300 px-3" /></label>
            <label className="text-sm sm:col-span-2">Observações<textarea name="notes" rows={3} defaultValue={editing.notes ?? ""} className="mt-1 w-full border border-neutral-300 px-3 py-2" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="h-10 border border-neutral-300 px-4 text-sm">Cancelar</button><button type="submit" disabled={saving} className="h-10 bg-black px-5 text-sm text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar ativo"}</button></div>
        </form>
      </div> : null}

      {selectedAsset ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-neutral-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[9px] uppercase tracking-[0.16em] text-neutral-500">Histórico de manutenção</p><h3 className="mt-1 text-lg font-medium">{selectedAsset.asset_code}</h3></div><button type="button" onClick={() => setSelectedAsset(null)} className="h-9 border border-neutral-300 px-3 text-xs">Fechar</button></div>
          <form onSubmit={recordMaintenance} className="grid gap-3 border-b border-neutral-200 pb-5 sm:grid-cols-2">
            <input name="maintenance_type" required placeholder="Tipo de manutenção" className="h-10 border border-neutral-300 px-3 text-sm" />
            <input name="performed_by" placeholder="Responsável" className="h-10 border border-neutral-300 px-3 text-sm" />
            <input name="performed_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="h-10 border border-neutral-300 px-3 text-sm" />
            <input name="next_due_at" type="date" aria-label="Próxima manutenção" className="h-10 border border-neutral-300 px-3 text-sm" />
            <input name="cost" type="number" min="0" step="0.01" defaultValue="0" placeholder="Custo" className="h-10 border border-neutral-300 px-3 text-sm" />
            <input name="description" placeholder="Descrição" className="h-10 border border-neutral-300 px-3 text-sm" />
            <button type="submit" disabled={saving} className="h-10 bg-black text-sm text-white disabled:opacity-50 sm:col-span-2">{saving ? "Registrando..." : "Registrar manutenção"}</button>
          </form>
          <div className="mt-4 space-y-3">
            {maintenance.filter((item) => item.asset_id === selectedAsset.id).map((item) => <article key={item.id} className="border-b border-neutral-200 pb-3 last:border-0"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.maintenance_type}</p><p className="text-xs text-neutral-500">{date(item.performed_at)}</p></div><p className="mt-1 text-xs text-neutral-600">{item.description ?? "Sem descrição"} · {money(Number(item.cost))}</p><p className="mt-1 text-[10px] text-neutral-500">Próxima: {date(item.next_due_at)}{item.performed_by ? ` · ${item.performed_by}` : ""}</p></article>)}
            {maintenance.every((item) => item.asset_id !== selectedAsset.id) ? <p className="py-5 text-center text-sm text-neutral-500">Nenhuma manutenção registrada.</p> : null}
          </div>
        </div>
      </div> : null}
    </section>
  );
}
