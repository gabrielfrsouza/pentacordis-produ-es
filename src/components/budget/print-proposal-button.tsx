"use client";

export function PrintProposalButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden h-11 rounded-none bg-black px-6 text-[10px] font-medium uppercase tracking-[0.18em] text-white"
    >
      Imprimir / Salvar PDF
    </button>
  );
}
