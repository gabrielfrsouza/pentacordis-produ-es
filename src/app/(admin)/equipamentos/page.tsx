import { createClient } from "@/lib/supabase/server";
import { EquipmentManager } from "@/components/equipment/equipment-manager";
import { EquipmentAssetsManager } from "@/components/equipment/equipment-assets-manager";

export const instant = false;

export default async function EquipmentPage() {
  const supabase = await createClient();
  const [equipmentResult, assetsResult, maintenanceResult] = await Promise.all([
    supabase.from("equipment").select("*").order("name"),
    supabase.from("equipment_assets").select("*").order("asset_code"),
    supabase.from("equipment_maintenance").select("*").order("performed_at", { ascending: false }).limit(200),
  ]);
  if (equipmentResult.error) throw new Error(`Não foi possível carregar o inventário: ${equipmentResult.error.message}`);
  return (
    <div className="space-y-12">
      <EquipmentManager initialEquipment={equipmentResult.data ?? []} />
      <EquipmentAssetsManager
        initialAssets={assetsResult.data ?? []}
        initialMaintenance={maintenanceResult.data ?? []}
        equipment={equipmentResult.data ?? []}
        queryErrors={[
          assetsResult.error && `patrimônio individual: ${assetsResult.error.message}`,
          maintenanceResult.error && `manutenção: ${maintenanceResult.error.message}`,
        ].filter((value): value is string => Boolean(value))}
      />
    </div>
  );
}
