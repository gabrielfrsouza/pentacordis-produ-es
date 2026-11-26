import { createClient } from "@/lib/supabase/server";
import { MusiciansManager } from "@/components/musicians/musicians-manager";

export const instant = false;

export default async function MusiciansPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[] }>;
}) {
  const params = await searchParams;
  const create = Array.isArray(params.create) ? params.create[0] : params.create;
  const supabase = await createClient();
  const [musiciansResult, rolesResult, lineupResult] = await Promise.all([
    supabase.from("musicians").select("*").order("full_name"),
    supabase.from("musician_roles").select("*").order("role_name"),
    supabase
      .from("event_lineup")
      .select("musician_id,event_id")
      .not("musician_id", "is", null),
  ]);

  return (
    <MusiciansManager
      initialMusicians={musiciansResult.data ?? []}
      initialRoles={rolesResult.data ?? []}
      openCreateOnLoad={create === "1"}
      historyCounts={(lineupResult.data ?? []).reduce<Record<string, number>>((counts, row) => {
        if (row.musician_id) counts[row.musician_id] = (counts[row.musician_id] ?? 0) + 1;
        return counts;
      }, {})}
    />
  );
}
