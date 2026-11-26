import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connection } from "next/server";
import { PublicEvent } from "@/components/public/public-event";
import { BrandLogo } from "@/components/brand/BrandLogo";
import type { Json } from "@/types/database";

export const instant = false;

function containsStorageAsset(value: Json): boolean {
  if (Array.isArray(value)) return value.some(containsStorageAsset);
  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, child]) =>
      (key === "file_url" && typeof child === "string" && child.startsWith("songs/")) ||
      (child !== null && typeof child === "object" && containsStorageAsset(child)),
    );
  }
  return false;
}

async function signPublicAssets(value: Json, admin: ReturnType<typeof createAdminClient>): Promise<Json> {
  if (Array.isArray(value)) return Promise.all(value.map((item) => signPublicAssets(item, admin)));
  if (value !== null && typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "file_url" && typeof child === "string" && child.startsWith("songs/")) {
        const signed = await admin.storage.from("pentacordis-assets").createSignedUrl(child, 3600);
        if (signed.error) throw new Error(`Não foi possível disponibilizar um arquivo público do evento: ${signed.error.message}`);
        result[key] = signed.data.signedUrl;
      } else {
        result[key] = child === undefined ? undefined : await signPublicAssets(child, admin);
      }
    }
    return result;
  }
  return value;
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ public_token: string }>;
}) {
  await connection();
  const { public_token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_event_by_token", {
    p_token: public_token,
  });

  if (error) {
    console.error("Não foi possível carregar o portal público do evento.", error.message);
  }
  if (error || !data) {
    return (
      <main className="grid min-h-screen place-items-center px-5 text-center">
        <section className="w-full max-w-sm rounded-2xl border border-border bg-surface p-7">
          <BrandLogo variant="black" size="md" className="mx-auto" />
          <h1 className="mt-3 text-xl font-semibold">Evento indisponível</h1>
          <p className="mt-2 text-sm text-muted">Verifique o link recebido ou entre em contato com a produção.</p>
        </section>
      </main>
    );
  }

  const eventData = containsStorageAsset(data)
    ? await signPublicAssets(data, createAdminClient())
    : data;

  return <PublicEvent eventData={eventData} />;
}
