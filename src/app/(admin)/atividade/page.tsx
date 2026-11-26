import { ActivityManager } from "@/components/reports/activity-manager";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ActivityPage() {
  const supabase = await createClient();
  const result = await supabase.from("activity_log").select("id,actor_user_id,action,resource,resource_id,description,created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <ActivityManager
      entries={result.data ?? []}
      queryError={result.error ? `Histórico indisponível para este perfil: ${result.error.message}` : null}
    />
  );
}
