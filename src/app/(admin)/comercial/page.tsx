import { createClient } from "@/lib/supabase/server";
import { CommercialManager } from "@/components/commercial/commercial-manager";

export const instant = false;

export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[]; tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const create = Array.isArray(params.create) ? params.create[0] : params.create;
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const supabase = await createClient();
  const [leadsResult, contractsResult, installmentsResult, eventsResult] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    supabase.from("contracts").select("*").order("created_at", { ascending: false }),
    supabase.from("installments").select("*").order("due_date"),
    supabase.from("events").select("contract_id,title,event_date").not("contract_id", "is", null).order("event_date"),
  ]);
  return (
    <CommercialManager
      initialLeads={leadsResult.data ?? []}
      initialContracts={contractsResult.data ?? []}
      initialInstallments={installmentsResult.data ?? []}
      initialEvents={eventsResult.data ?? []}
      initialTab={requestedTab === "contracts" ? "contracts" : "leads"}
      openLeadModalOnLoad={create === "lead"}
    />
  );
}
