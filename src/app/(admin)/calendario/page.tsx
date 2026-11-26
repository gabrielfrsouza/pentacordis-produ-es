import { CentralCalendar } from "@/components/calendar/central-calendar";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function CalendarPage() {
  const supabase = await createClient();
  const [
    eventsResult,
    proposalsResult,
    financeResult,
    tasksResult,
    availabilityResult,
  ] = await Promise.all([
    supabase.from("events").select("id,title,event_date,status").order("event_date"),
    supabase.from("proposals").select("id,proposal_number,client_name,valid_until,status").not("valid_until", "is", null).order("valid_until").limit(300),
    supabase.from("financial_transactions").select("id,description,direction,amount,due_date,status").not("due_date", "is", null).order("due_date").limit(500),
    supabase.from("tasks").select("*").not("due_at", "is", null).order("due_at").limit(500),
    supabase.from("musician_availability").select("id,musician_id,availability_date,start_time,status").order("availability_date").limit(500),
  ]);
  const errors = [
    eventsResult.error && `eventos: ${eventsResult.error.message}`,
    proposalsResult.error && `propostas: ${proposalsResult.error.message}`,
    financeResult.error && `financeiro: ${financeResult.error.message}`,
    tasksResult.error && `tarefas: ${tasksResult.error.message}`,
    availabilityResult.error && `disponibilidade: ${availabilityResult.error.message}`,
  ].filter((value): value is string => Boolean(value));

  const availability = availabilityResult.data ?? [];
  let musicians: Array<{ id: string; full_name: string; stage_name: string | null }> = [];
  if (!availabilityResult.error && availability.length) {
    const musicianResult = await supabase
      .from("musicians")
      .select("id,full_name,stage_name")
      .in("id", [...new Set(availability.map((item) => item.musician_id))]);
    if (musicianResult.error) errors.push(`músicos: ${musicianResult.error.message}`);
    else musicians = musicianResult.data ?? [];
  }

  return (
    <CentralCalendar
      events={eventsResult.data ?? []}
      proposals={proposalsResult.data ?? []}
      transactions={financeResult.data ?? []}
      initialTasks={tasksResult.data ?? []}
      availability={availability}
      musicians={musicians}
      queryErrors={errors}
    />
  );
}
