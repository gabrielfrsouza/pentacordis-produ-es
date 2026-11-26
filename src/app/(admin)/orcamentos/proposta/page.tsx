import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PrintProposalButton } from "@/components/budget/print-proposal-button";
import { z } from "zod";

type ProposalPageProps = {
  searchParams: Promise<{
    proposalId?: string;
  }>;
};

export const instant = false;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function ProposalPage({ searchParams }: ProposalPageProps) {
  const params = await searchParams;
  if (!params.proposalId || !z.string().uuid().safeParse(params.proposalId).success) notFound();
  const proposal = await loadProposal(params.proposalId);
  if (!proposal) notFound();
  const items = proposal.items;
  const finalValue = Number(proposal.total_value);
  const eventDate = proposal.event_date;
  const date = eventDate
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${eventDate}T12:00:00`))
    : "Data a definir";

  return (
    <main className="proposal-shell min-h-screen bg-white px-5 py-8 print:px-0 print:py-0">
      <div className="proposal-actions mb-6 flex justify-end">
        <PrintProposalButton />
      </div>

      <article className="proposal-page mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-[14mm] text-black print:w-[210mm] print:max-w-none">
        <header className="border-b border-black pb-7 text-center">
          <BrandLogo variant="black" size="lg" className="mx-auto" />
          <p className="mt-5 text-[9px] font-medium uppercase tracking-[0.28em]">Curadoria e Produção Musical</p>
          <p className="mx-auto mt-4 max-w-xl text-xs leading-6 text-neutral-600">
            Criamos atmosferas sonoras sob medida para cerimônias, recepções corporativas e concertos. Unimos arranjos exclusivos,
            direção musical em cena e um elenco selecionado de cantores e instrumentistas para entregar rigor técnico, discrição
            operacional e elegância do primeiro acorde ao encerramento.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-2 gap-8 border-b border-neutral-300 pb-8">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Apresentado a</p>
            <p className="mt-2 font-display text-3xl font-light">{proposal.client_name}</p>
            {proposal.client_document ? <p className="mt-1 text-xs text-neutral-500">{proposal.client_document}</p> : null}
            <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-neutral-500">Proposta #{proposal.proposal_number} · {proposal.status}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Evento</p>
            <p className="mt-2 font-display text-2xl font-light">{proposal.event_type ? `Proposta para ${proposal.event_type}` : "Proposta artística"}</p>
            <p className="mt-2 text-xs text-neutral-500">{proposal.event_type ?? "Evento"} · {date}</p>
            {proposal.venue_name ? <p className="mt-1 text-xs text-neutral-500">{proposal.venue_name}</p> : null}
          </div>
        </section>

        <section className="mt-10">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Formação proposta</p>
          {items.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-500">Formação a definir.</p>
          ) : (
            <div className="mt-4 border-t border-neutral-300">
              {items.map((item, index) => (
                <div key={`${item.description}-${index}`} className="grid grid-cols-[1fr_auto] border-b border-neutral-200 py-4">
                  <p className="text-sm capitalize">{item.description.replaceAll("_", " ")}</p>
                  <p className="text-xs text-neutral-500">{item.quantity} × {money(item.total_price / item.quantity)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 border-t border-neutral-300 pt-6">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">O que está incluso</p>
          <div className="mt-4 space-y-4 text-xs leading-5 text-neutral-600">
            <p><strong className="text-black">Curadoria e Arranjos:</strong> Planejamento de repertório alinhado à identidade do evento, com arranjos próprios e leitura de partitura de alto nível.</p>
            <p><strong className="text-black">Elenco e Direção Musical:</strong> Músicos e cantores escalados sob medida para a formação escolhida, com reserva técnica mapeada para garantia de execução.</p>
            <p><strong className="text-black">Estrutura e Logística:</strong> Gestão completa de horários, passagem de som, sonorização compatível com o ambiente e apresentação visual padronizada.</p>
          </div>
        </section>

        <section className="mt-12 flex justify-end">
          <div className="w-72 border-t border-b border-black py-6 text-right">
            <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Investimento</p>
            <p className="tabular-nums mt-2 font-display text-4xl font-light">{money(finalValue)}</p>
          </div>
        </section>

        <section className="mt-12 border-t border-neutral-300 pt-6">
          <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500">Condições comerciais</p>
          <ul className="mt-4 space-y-2 text-xs leading-5 text-neutral-600">
            <li><strong className="text-black">Validade:</strong> 15 (quinze) dias corridos a partir da data de emissão.</li>
            <li><strong className="text-black">Reserva de data:</strong> bloqueio mediante assinatura do contrato e pagamento do sinal de 30% do valor total. O saldo remanescente deve ser quitado até 7 (sete) dias antes do evento.</li>
            <li><strong className="text-black">Condições do local:</strong> apresentações ao ar livre requerem cobertura contra sol e chuva para músicos e instrumentos, além de ponto de energia elétrica estabilizado próximo à área de execução.</li>
            <li><strong className="text-black">Tolerância e hora extra:</strong> equipe à disposição conforme o cronograma contratado, com tolerância de 30 minutos para atrasos operacionais do evento.</li>
          </ul>
        </section>

        <footer className="mt-16 flex items-end justify-between border-t border-neutral-300 pt-6">
          <BrandLogo variant="muted" size="xs" />
        </footer>
      </article>
    </main>
  );
}

async function loadProposal(proposalId: string) {
  await connection();
  const supabase = await createClient();
  const [proposalResult, itemsResult] = await Promise.all([
    supabase
      .from("proposals")
      .select("id,proposal_number,client_name,client_document,event_type,event_date,venue_name,total_value,status")
      .eq("id", proposalId)
      .maybeSingle(),
    supabase.from("proposal_items").select("description,quantity,total_price").eq("proposal_id", proposalId).order("sort_order"),
  ]);
  if (proposalResult.error) throw new Error(`Não foi possível carregar a proposta: ${proposalResult.error.message}`);
  if (itemsResult.error) throw new Error(`Não foi possível carregar os itens da proposta: ${itemsResult.error.message}`);
  if (!proposalResult.data) return null;
  return { ...proposalResult.data, items: itemsResult.data ?? [] };
}
