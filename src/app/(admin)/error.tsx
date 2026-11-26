"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("A página administrativa não pôde ser renderizada.", error);
  }, [error]);

  return (
    <main role="alert" className="mx-auto max-w-xl border border-neutral-200 bg-white p-8 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">Falha ao carregar</p>
      <h1 className="mt-3 font-display text-3xl">Não foi possível abrir esta página</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com a administração.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex h-10 items-center gap-2 bg-black px-4 text-xs font-medium uppercase tracking-[0.12em] text-white hover:bg-neutral-800"
      >
        <RefreshCw size={14} />
        Tentar novamente
      </button>
    </main>
  );
}
