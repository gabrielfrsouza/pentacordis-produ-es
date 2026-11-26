"use client";

import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, Eraser, PenLine } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { createClient } from "@/lib/supabase/client";
import { CONTRACT_ACCEPTANCE_TEXT } from "@/lib/contract-terms";
import { EASE_EDITORIAL } from "@/lib/motion";
import type { PublicContractPayload } from "@/types/database";

type Props = {
  signToken: string;
  initialData: PublicContractPayload;
};

type SignatureMode = "manuscrita" | "digitada";

const certificateResponseSchema = z.object({
  certificate: z.object({
    signed_at: z.string(),
  }),
});

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

async function getDocumentRevision(value: unknown) {
  const encoded = new TextEncoder().encode(stableStringify(value));
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatStatusDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

export function PublicContractSigning({ signToken, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [signerName, setSignerName] = useState(initialData.contract.client_name);
  const [signerDocument, setSignerDocument] = useState(initialData.contract.cpf_cnpj ?? "");
  const [signerEmail, setSignerEmail] = useState(initialData.contract.client_email ?? "");
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("manuscrita");
  const [hasInk, setHasInk] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const isSigned = data.contract.status === "assinado";
  const isUnavailable = data.contract.status === "cancelado";
  const hasElectronicSignature = data.contract.has_electronic_signature ?? data.contract.status === "assinado";
  const canDownloadSignedCopy = isSigned && hasElectronicSignature && Boolean(data.contract.signer_name);

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getCanvasPoint(event);
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.strokeStyle = "#0A0A0A";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.fillStyle = "#0A0A0A";
    context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(point.x, point.y);
    isDrawing.current = true;
    setHasInk(true);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const point = getCanvasPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    isDrawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function changeSignatureMode(mode: SignatureMode) {
    if (mode === "digitada") clearSignature();
    setSignatureMode(mode);
  }

  async function submitSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedTerms) {
      toast.error("Confirme a leitura e o aceite do contrato para continuar.");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentResult = await createClient().rpc("get_public_contract_by_token", { p_token: signToken });
      if (currentResult.error) throw new Error("Não foi possível atualizar o documento antes da assinatura.");
      if (!currentResult.data) {
        setData((current) => ({ ...current, contract: { ...current.contract, status: "cancelado" } }));
        throw new Error("Este contrato não está mais disponível para assinatura.");
      }
      if (stableStringify(currentResult.data) !== stableStringify(data)) {
        setData(currentResult.data);
        setSignerName(currentResult.data.contract.client_name);
        setSignerDocument(currentResult.data.contract.cpf_cnpj ?? "");
        setSignerEmail(currentResult.data.contract.client_email ?? "");
        setAcceptedTerms(false);
        throw new Error("O contrato foi atualizado. Revise as alterações e confirme o aceite novamente.");
      }

      const signatureImage = signatureMode === "manuscrita" && hasInk
        ? canvasRef.current?.toDataURL("image/png") ?? null
        : null;
      const documentRevision = await getDocumentRevision(data);
      const response = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign_token: signToken,
          signer_name: signerName,
          signer_document: signerDocument,
          signer_email: signerEmail,
          document_revision: documentRevision,
          accepted_terms: acceptedTerms,
          signature_image: signatureImage,
        }),
      });

      const responseBody: unknown = await response.json();
      if (!response.ok) {
        const errorResult = z.object({ error: z.string() }).safeParse(responseBody);
        throw new Error(errorResult.success ? errorResult.data.error : "Não foi possível registrar a assinatura.");
      }
      const parsedResponse = certificateResponseSchema.safeParse(responseBody);
      if (!parsedResponse.success) throw new Error("O certificado retornado pelo servidor é inválido.");
      const certificate = parsedResponse.data.certificate;

      setData((current) => ({
        ...current,
        contract: {
          ...current.contract,
          status: "assinado",
          signed_at: certificate.signed_at,
          signer_name: signerName,
          signer_document: signerDocument,
          signature_image: signatureImage,
          has_electronic_signature: true,
        },
      }));
      toast.success("Contrato assinado eletronicamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a assinatura.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function printSignedCopy() {
    window.print();
  }

  return (
    <main className="public-contract-route min-h-screen bg-[#F5F5F5] px-0 py-0 text-[#0A0A0A] sm:px-5 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="print:hidden flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E5E5] bg-white px-5 py-5 sm:mb-5 sm:border sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo variant="black" size="sm" />
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-neutral-500">Documento digital</p>
              <p className="mt-1 text-xs">Referência {data.contract.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 border border-[#E5E5E5] px-3 py-2 text-[9px] uppercase tracking-[0.15em] ${isUnavailable ? "text-neutral-500" : isSigned ? "text-emerald-700" : "text-amber-700"}`}>
            <span className={`size-2 rounded-full ${isUnavailable ? "bg-neutral-400" : isSigned ? "bg-emerald-600" : "bg-amber-500"}`} />
            {isUnavailable ? "Contrato Indisponível" : isSigned ? "Contrato Assinado" : "Aguardando Assinatura"}
          </div>
        </header>

        <section className="border-y border-[#E5E5E5] bg-white p-5 sm:border sm:p-8">
          <ContractDocument
            contract={data.contract}
            event={data.event}
            installments={data.installments}
            signedDocument={data.signed_document}
          />

          <AnimatePresence mode="wait" initial={false}>
            {isUnavailable ? (
              <motion.section
                key="unavailable"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE_EDITORIAL }}
                className="mt-8 border-t border-[#E5E5E5] pt-6"
              >
                <h2 className="font-display text-2xl">Contrato indisponível</h2>
                <p className="mt-2 text-sm text-neutral-600">Este contrato foi cancelado ou o link de assinatura não está mais ativo.</p>
              </motion.section>
            ) : isSigned ? (
              <motion.section
                key="signed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: EASE_EDITORIAL }}
                className="print:hidden mt-8 border-t border-[#E5E5E5] pt-6"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check size={18} /></span>
                  <div>
                    <h2 className="font-display text-2xl">Assinatura registrada</h2>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                      {hasElectronicSignature && data.contract.signed_at
                        ? `Assinatura registrada em ${formatStatusDate(data.contract.signed_at)}.`
                        : "Este contrato foi marcado como assinado pela produtora; não há certificado eletrônico associado."}
                    </p>
                    {hasElectronicSignature && !data.contract.signer_name ? (
                      <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                        A via assinada pode ser solicitada diretamente à produção.
                      </p>
                    ) : null}
                  </div>
                </div>
                {canDownloadSignedCopy ? (
                  <div className="print:hidden mt-6 flex justify-end">
                    <button type="button" onClick={printSignedCopy} className="inline-flex h-10 items-center gap-2 border border-[#0A0A0A] px-4 text-[10px] uppercase tracking-[0.16em]">
                      <Download size={15} /> Baixar Via Assinada (PDF)
                    </button>
                  </div>
                ) : null}
              </motion.section>
            ) : (
              <motion.section
                key="signing-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: EASE_EDITORIAL }}
                className="mt-8 border-t border-[#E5E5E5] pt-6"
              >
                <div className="mb-5 flex items-center gap-3">
                  <PenLine size={17} />
                  <h2 className="font-display text-2xl uppercase tracking-wide">Assinatura Eletrônica</h2>
                </div>

                <form onSubmit={submitSignature} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-[10px] uppercase tracking-[0.14em] sm:col-span-2">Nome Completo do Signatário
                      <input value={signerName} onChange={(event) => setSignerName(event.target.value)} required minLength={3} maxLength={150} className="mt-2 h-11 w-full border-0 border-b border-[#A3A3A3] bg-transparent px-0 text-base normal-case tracking-normal outline-none focus:border-[#0A0A0A]" />
                    </label>
                    <label className="block text-[10px] uppercase tracking-[0.14em]">CPF ou CNPJ
                      <input value={signerDocument} onChange={(event) => setSignerDocument(event.target.value)} required maxLength={18} autoComplete="off" autoCapitalize="characters" className="tabular-nums mt-2 h-11 w-full border-0 border-b border-[#A3A3A3] bg-transparent px-0 text-base normal-case tracking-normal outline-none focus:border-[#0A0A0A]" />
                    </label>
                    <label className="block text-[10px] uppercase tracking-[0.14em]">E-mail para registro <span className="text-neutral-400">(opcional)</span>
                      <input value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} type="email" maxLength={254} className="mt-2 h-11 w-full border-0 border-b border-[#A3A3A3] bg-transparent px-0 text-base normal-case tracking-normal outline-none focus:border-[#0A0A0A]" />
                    </label>
                  </div>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.14em]">Rubrica / Assinatura <span className="text-neutral-400">(opcional)</span></p>
                      <div className="flex border border-[#E5E5E5]">
                        <button type="button" onClick={() => changeSignatureMode("manuscrita")} aria-pressed={signatureMode === "manuscrita"} className={`px-3 py-2 text-[9px] uppercase tracking-wide ${signatureMode === "manuscrita" ? "bg-[#0A0A0A] text-white" : "bg-white text-neutral-600"}`}>
                          Manuscrita
                        </button>
                        <button type="button" onClick={() => changeSignatureMode("digitada")} aria-pressed={signatureMode === "digitada"} className={`border-l border-[#E5E5E5] px-3 py-2 text-[9px] uppercase tracking-wide ${signatureMode === "digitada" ? "bg-[#0A0A0A] text-white" : "bg-white text-neutral-600"}`}>
                          Digitada
                        </button>
                      </div>
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      {signatureMode === "manuscrita" ? (
                        <motion.div key="handwritten" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE_EDITORIAL }}>
                          <canvas
                            ref={canvasRef}
                            width={1200}
                            height={320}
                            aria-label="Área opcional para desenhar sua assinatura"
                            onPointerDown={startDrawing}
                            onPointerMove={draw}
                            onPointerUp={stopDrawing}
                            onPointerCancel={stopDrawing}
                            className="h-40 w-full touch-none border border-[#E5E5E5] bg-[#FAFAFA]"
                          />
                          <button type="button" onClick={clearSignature} disabled={!hasInk} className="mt-2 inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-neutral-500 disabled:opacity-40">
                            <Eraser size={13} /> Limpar
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div key="typed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE_EDITORIAL }} className="flex h-40 items-center justify-center border border-[#E5E5E5] bg-[#FAFAFA]">
                          <p className="font-display text-4xl italic">{signerName || "Seu nome"}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 border border-[#E5E5E5] p-4 text-sm leading-relaxed">
                    <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 size-4 accent-[#0A0A0A]" />
                    <span>{CONTRACT_ACCEPTANCE_TEXT}</span>
                  </label>

                  <button type="submit" disabled={isSubmitting || !acceptedTerms} className="flex h-12 w-full items-center justify-center gap-3 bg-[#0A0A0A] px-5 text-[10px] font-medium uppercase tracking-[0.22em] text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmitting ? (
                      <motion.span animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.4, repeat: Infinity, ease: EASE_EDITORIAL }}>
                        Registrando assinatura...
                      </motion.span>
                    ) : "Confirmar e Assinar Contrato"}
                  </button>
                  <p className="text-center text-[10px] leading-relaxed text-neutral-500">
                    O registro incluirá data/hora do servidor, endereço IP, navegador e hash SHA-256 do documento.
                  </p>
                </form>
              </motion.section>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}
