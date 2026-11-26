import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EventWorkspace } from "@/components/events/event-workspace";

export const instant = false;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const [
    eventResult,
    lineupResult,
    musiciansResult,
    rolesResult,
    setlistResult,
    songsResult,
    equipmentResult,
    allocationsResult,
    expensesResult,
    financialResult,
  ] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("event_lineup").select("*").eq("event_id", id).order("role_needed"),
    supabase.from("musicians").select("*").eq("is_active", true).order("full_name"),
    supabase.from("musician_roles").select("*").order("role_name"),
    supabase.from("event_setlist").select("*").eq("event_id", id).order("order_index"),
    supabase.from("songs").select("*").order("title"),
    supabase.from("equipment").select("*").order("name"),
    supabase.from("event_equipment").select("*").eq("event_id", id).order("created_at"),
    supabase.from("event_expenses").select("*").eq("event_id", id).order("created_at"),
    supabase.from("event_financial_summary").select("*").eq("event_id", id).maybeSingle(),
  ]);

  if (eventResult.error || !eventResult.data) notFound();

  return (
    <EventWorkspace
      initialEvent={eventResult.data}
      initialLineup={lineupResult.data ?? []}
      musicians={musiciansResult.data ?? []}
      musicianRoles={rolesResult.data ?? []}
      initialSetlist={setlistResult.data ?? []}
      songs={songsResult.data ?? []}
      equipment={equipmentResult.data ?? []}
      initialAllocations={allocationsResult.data ?? []}
      initialExpenses={expensesResult.data ?? []}
      financial={financialResult.data}
    />
  );
}
