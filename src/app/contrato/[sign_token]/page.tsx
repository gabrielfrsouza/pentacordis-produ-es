import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PublicContractSigning } from "@/components/contracts/PublicContractSigning";

export const instant = false;

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ sign_token: string }>;
}) {
  await connection();
  const { sign_token } = await params;
  if (!z.string().uuid().safeParse(sign_token).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_contract_by_token", { p_token: sign_token });

  if (error) throw new Error(`Não foi possível carregar o contrato: ${error.message}`);
  if (!data) notFound();

  return <PublicContractSigning signToken={sign_token} initialData={data} />;
}
