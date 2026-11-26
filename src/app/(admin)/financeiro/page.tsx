import { FinancialManager } from "@/components/finance/financial-manager";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function FinancePage() {
  const supabase = await createClient();
  const [transactionsResult, cashflowResult, eventsResult] = await Promise.all([
    supabase.from("financial_transactions").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("pentacordis_cashflow_monthly").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("events").select("id,title").order("event_date", { ascending: false }).limit(100),
  ]);
  const failedQuery = [
    transactionsResult.error && `lançamentos: ${transactionsResult.error.message}`,
    cashflowResult.error && `fluxo de caixa: ${cashflowResult.error.message}`,
    eventsResult.error && `eventos: ${eventsResult.error.message}`,
  ].filter(Boolean);

  return (
    <FinancialManager
      initialTransactions={transactionsResult.data ?? []}
      initialCashflow={cashflowResult.data ?? []}
      events={eventsResult.data ?? []}
      queryError={failedQuery.length ? `Alguns dados não puderam ser carregados: ${failedQuery.join("; ")}` : null}
    />
  );
}
