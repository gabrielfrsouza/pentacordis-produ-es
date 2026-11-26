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

async function signPublicAssets(
  value: Json,
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ data: Json; assetsUnavailable: boolean }> {
  if (Array.isArray(value)) {
    const items = await Promise.all(value.map((item) => signPublicAssets(item, admin)));
    return {
      data: items.map((item) => item.data),
      assetsUnavailable: items.some((item) => item.assetsUnavailable),
    };
  }
  if (value !== null && typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    let assetsUnavailable = false;
    for (const [key, child] of Object.entries(value)) {
      if (key === "file_url" && typeof child === "string" && child.startsWith("songs/")) {
        try {
          const signed = await admin.storage.from("pentacordis-assets").createSignedUrl(child, 3600);
          if (signed.error) {
            console.error("Não foi possível assinar um arquivo do portal do evento.", signed.error.message);
            result[key] = null;
            assetsUnavailable = true;
          } else {
            result[key] = signed.data.signedUrl;
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : "falha inesperada";
          console.error("Não foi possível assinar um arquivo do portal do evento.", detail);
          result[key] = null;
          assetsUnavailable = true;
        }
      } else {
        if (child === undefined) {
          result[key] = undefined;
        } else {
          const nested = await signPublicAssets(child, admin);
          result[key] = nested.data;
          assetsUnavailable = assetsUnavailable || nested.assetsUnavailable;
        }
      }
    }
    return { data: result, assetsUnavailable };
  }
  return { data: value, assetsUnavailable: false };
}

function redactPrivateStorageUrls(value: Json): Json {
  if (Array.isArray(value)) return value.map(redactPrivateStorageUrls);
  if (value !== null && typeof value === "object") {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = key === "file_url" && typeof child === "string" && child.startsWith("songs/")
        ? null
        : child === undefined
          ? undefined
          : redactPrivateStorageUrls(child);
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

  const record = typeof data === "object" && !Array.isArray(data) ? data : null;
  if (!record || typeof record.title !== "string" || typeof record.event_date !== "string") {
    console.error("O RPC do portal retornou um formato inesperado.", {
      dataType: Array.isArray(data) ? "array" : typeof data,
      rootKeys: record ? Object.keys(record) : [],
      titleType: record ? typeof record.title : "not-object",
      eventDateType: record ? typeof record.event_date : "not-object",
    });
  }

  let eventData: Json = data;
  let assetsUnavailable = false;
  if (containsStorageAsset(data)) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY não está configurada; arquivos privados do portal não serão expostos.");
      eventData = redactPrivateStorageUrls(data);
      assetsUnavailable = true;
    } else {
      const signedAssets = await signPublicAssets(data, createAdminClient());
      eventData = signedAssets.data;
      assetsUnavailable = signedAssets.assetsUnavailable;
    }
  }

  return <PublicEvent eventData={eventData} assetsUnavailable={assetsUnavailable} />;
}
