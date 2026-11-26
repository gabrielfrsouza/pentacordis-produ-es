import { ProposalsManager } from "@/components/budget/proposals-manager";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ProposalsPage() {
  const supabase = await createClient();
  const result = await supabase
    .from("proposals")
    .select("id,proposal_number,client_name,event_type,event_date,total_value,status,valid_until,created_at")
    .order("created_at", { ascending: false });

  if (result.error) {
    throw new Error(`Não foi possível carregar as propostas: ${result.error.message}`);
  }

  return <ProposalsManager initialProposals={result.data ?? []} />;
}
