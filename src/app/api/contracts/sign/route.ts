import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { COMPANY } from "@/lib/company";
import { CONTRACT_ACCEPTANCE_TEXT, CONTRACT_TERMS_VERSION } from "@/lib/contract-terms";
import { normalizeSignerDocument } from "@/lib/contract-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const signingSchema = z.object({
  sign_token: z.string().uuid(),
  signer_name: z.string().trim().min(3).max(150),
  signer_document: z.string()
    .trim()
    .min(11)
    .max(18)
    .regex(/^[A-Za-z0-9./\-\s]+$/)
    .transform((value, context) => {
      const normalized = normalizeSignerDocument(value);
      if (!normalized) {
        context.addIssue({ code: "custom", message: "Informe um CPF ou CNPJ válido." });
        return z.NEVER;
      }
      return normalized;
    }),
  signer_email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  document_revision: z.string().regex(/^[a-f0-9]{64}$/),
  accepted_terms: z.literal(true),
  signature_image: z.string()
    .max(800_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable()
    .optional(),
});

function getClientIp(request: NextRequest) {
  const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (!trustedHeader) return null;
  const candidate = request.headers.get(trustedHeader)?.trim();
  return candidate && !candidate.includes(",") && isIP(candidate) ? candidate : null;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Envie os dados de assinatura em JSON." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: "A assinatura enviada excede o tamanho permitido." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "O corpo da solicitação não contém JSON válido." }, { status: 400 });
  }

  const parsed = signingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados de assinatura inválidos." }, { status: 400 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "A assinatura eletrônica ainda não está configurada no servidor." }, { status: 503 });
  }

  const supabase = createAdminClient();
  const publicContractResult = await supabase.rpc("get_public_contract_by_token", { p_token: parsed.data.sign_token });
  if (publicContractResult.error) {
    console.error("Falha ao carregar o contrato para assinatura.", publicContractResult.error.message);
    return NextResponse.json({ error: "Não foi possível validar o contrato no momento." }, { status: 500 });
  }
  const publicData = publicContractResult.data;
  if (!publicData) {
    return NextResponse.json({ error: "O link de assinatura não corresponde a um contrato ativo." }, { status: 404 });
  }
  if (publicData.contract.status === "assinado") {
    return NextResponse.json({ error: "Este contrato já foi assinado." }, { status: 409 });
  }
  const documentRevision = createHash("sha256").update(stableStringify(publicData), "utf8").digest("hex");
  if (documentRevision !== parsed.data.document_revision) {
    return NextResponse.json({ error: "O contrato foi atualizado. Recarregue o link e revise o documento antes de assinar." }, { status: 409 });
  }

  const signerIp = getClientIp(request);
  const signerUserAgent = (request.headers.get("user-agent") || "unknown").slice(0, 1024);
  const signedAt = new Date().toISOString();
  const signatureImage = parsed.data.signature_image ?? null;
  const signerEmail = parsed.data.signer_email || null;
  const signedSnapshot: Json = {
    document: publicData,
    company: {
      name: COMPANY.name,
      document: COMPANY.document,
      city: publicData.contract.contractor_city?.trim() || COMPANY.city,
      forum: COMPANY.city,
    },
    terms_version: CONTRACT_TERMS_VERSION,
    accepted_terms: parsed.data.accepted_terms,
    accepted_terms_text: CONTRACT_ACCEPTANCE_TEXT,
    signed_at: signedAt,
    signature_mode: signatureImage ? "manuscrita" : "digitada",
    signature_image: signatureImage,
    signer: {
      name: parsed.data.signer_name,
      document: parsed.data.signer_document,
      email: signerEmail,
      ip: signerIp,
      user_agent: signerUserAgent,
    },
  };
  const hashInput = `${stableStringify(signedSnapshot)}\n${parsed.data.signer_name}\n${parsed.data.signer_document}\n${signerIp}\n${signedAt}`;
  const documentHash = createHash("sha256").update(hashInput, "utf8").digest("hex");

  const signatureResult = await supabase.rpc("sign_public_contract", {
    p_token: parsed.data.sign_token,
    p_signer_name: parsed.data.signer_name,
    p_signer_document: parsed.data.signer_document,
    p_signer_email: signerEmail,
    p_signer_ip: signerIp,
    p_signer_user_agent: signerUserAgent,
    p_document_hash: documentHash,
    p_signature_image: signatureImage,
    p_signed_snapshot: signedSnapshot,
  });

  if (signatureResult.error) {
    if (signatureResult.error.message.includes("Contrato já foi assinado")) {
      return NextResponse.json({ error: "Este contrato já foi assinado." }, { status: 409 });
    }
    if (signatureResult.error.message.includes("inexistente ou cancelado")) {
      return NextResponse.json({ error: "O link de assinatura não corresponde a um contrato ativo." }, { status: 404 });
    }
    if (signatureResult.error.message.includes("atualizado durante assinatura")) {
      return NextResponse.json({ error: "O contrato foi atualizado. Recarregue o link e revise o documento antes de assinar." }, { status: 409 });
    }
    console.error("Falha ao registrar assinatura do contrato.", signatureResult.error.message);
    return NextResponse.json({ error: "Não foi possível registrar a assinatura no momento." }, { status: 500 });
  }
  if (!signatureResult.data) {
    return NextResponse.json({ error: "A assinatura não retornou o certificado esperado." }, { status: 500 });
  }

  return NextResponse.json({
    certificate: {
      signed_at: signatureResult.data.signed_at,
    },
  }, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
