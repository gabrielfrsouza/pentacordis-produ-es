import { notFound } from "next/navigation";
import { ContractDocument } from "@/components/commercial/contract-document";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ContractDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const contractResult = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();

  if (contractResult.error) throw new Error(`Não foi possível carregar o contrato: ${contractResult.error.message}`);
  if (!contractResult.data) notFound();

  const [eventResult, installmentsResult] = await Promise.all([
    supabase.from("events").select("*").eq("contract_id", id).order("event_date").limit(1).maybeSingle(),
    supabase.from("installments").select("*").eq("contract_id", id).order("installment_number"),
  ]);
  if (eventResult.error) throw new Error(`Não foi possível carregar o evento do contrato: ${eventResult.error.message}`);
  if (installmentsResult.error) throw new Error(`Não foi possível carregar as parcelas: ${installmentsResult.error.message}`);

  const lineupResult = eventResult.data
    ? await supabase.from("event_lineup").select("*").eq("event_id", eventResult.data.id).order("role_needed")
    : null;
  if (lineupResult?.error) throw new Error(`Não foi possível carregar a formação do evento: ${lineupResult.error.message}`);

  return (
    <ContractDocument
      initialContract={contractResult.data}
      event={eventResult.data ? {
        id: eventResult.data.id,
        title: eventResult.data.title,
        event_type: eventResult.data.event_type,
        event_date: eventResult.data.event_date,
        start_time: eventResult.data.start_time,
        venue_name: eventResult.data.venue_name,
        venue_address: eventResult.data.venue_address,
        lineup: (lineupResult?.data ?? []).map((item) => ({ id: item.id, role_needed: item.role_needed })),
      } : null}
      installments={installmentsResult.data}
    />
  );
}
