import { createClient } from "@/lib/supabase/server";
import { EventsManager } from "@/components/events/events-manager";

export const instant = false;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[] }>;
}) {
  const params = await searchParams;
  const create = Array.isArray(params.create) ? params.create[0] : params.create;
  const supabase = await createClient();
  const result = await supabase.from("events").select("*").order("event_date", { ascending: false });
  return <EventsManager initialEvents={result.data ?? []} openCreateOnLoad={create === "1"} />;
}
