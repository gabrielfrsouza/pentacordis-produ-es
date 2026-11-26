import { ManagementReports } from "@/components/reports/management-reports";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ReportsPage() {
  const supabase = await createClient();
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [cashflowResult, readinessResult] = await Promise.all([
    supabase.from("pentacordis_cashflow_monthly").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("pentacordis_event_readiness").select("*").gte("event_date", todayDate).order("event_date", { ascending: true }).limit(100),
  ]);
  const errors = [
    cashflowResult.error && `fluxo de caixa: ${cashflowResult.error.message}`,
    readinessResult.error && `prontidão dos eventos: ${readinessResult.error.message}`,
  ].filter((value): value is string => Boolean(value));
  return <ManagementReports cashflow={cashflowResult.data ?? []} readiness={readinessResult.data ?? []} queryErrors={errors} />;
}
