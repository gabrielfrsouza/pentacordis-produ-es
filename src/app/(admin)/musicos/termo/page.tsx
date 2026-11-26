import { BrandLogo } from "@/components/brand/BrandLogo";
import { PrintProposalButton } from "@/components/budget/print-proposal-button";

export const instant = false;

const clauses = [
  {
    title: "1. Natureza da Parceria",
    body: "Este termo estabelece as diretrizes de atuação de músicos, cantores e técnicos convidados em produções assinadas pela Pentacordis. A participação ocorre de forma eventual e autônoma, por evento previamente acordado, sem vínculo empregatício ou exclusividade de agenda fora das datas confirmadas.",
  },
  {
    title: "2. Confirmação de Escala e Substituições",
    body: "O convite para cada evento é formalizado com data, local, função e cachê definidos. Uma vez confirmada a participação, o profissional compromete-se integralmente com a data. Em caso de imprevisto grave ou força maior, a comunicação à direção musical deve ser imediata. Não é permitido enviar substitutos por conta própria sem aprovação expressa da direção da Pentacordis.",
  },
  {
    title: "3. Preparo Técnico e Pontualidade",
    body: "O repertório, partituras e áudios-guia são disponibilizados antecipadamente no Portal do Músico. Espera-se preparo prévio compatível com o padrão artístico da casa. O horário de referência para chegada é sempre o de montagem e passagem de som (Call Sheet), e não o horário de início do evento.",
  },
  {
    title: "4. Padrão Visual e Zelo pelo Patrimônio",
    body: "O traje padrão para apresentações é Social All Black (salvo especificação distinta na Call Sheet). Acessórios institucionais fornecidos no dia — como broches de lapela, pastas de partitura ou itens de sonorização — pertencem à produtora e devem ser devolvidos à coordenação ao término do evento.",
  },
  {
    title: "5. Ética Comercial e Representação de Marca",
    body: "Durante a execução de eventos contratados pela Pentacordis, todos os integrantes representam exclusivamente a marca. Qualquer solicitação de orçamento, contato profissional ou pedido de informações feito por contratantes, cerimonialistas ou convidados no local deve ser direcionado à produção da Pentacordis, sendo vedada a entrega de cartões pessoais ou negociação paralela.",
  },
  {
    title: "6. Cachê e Prazo de Pagamento",
    body: "O valor do cachê é acordado previamente na confirmação da escala. A Pentacordis compromete-se a efetuar o repasse integral via Pix em até 2 (dois) dias úteis após a realização do evento, na chave cadastrada pelo profissional.",
  },
  {
    title: "7. Uso de Imagem e Áudio",
    body: "O profissional autoriza o registro e a utilização de fotos, vídeos e trechos de áudio captados durante as apresentações para fins de portfólio, divulgação institucional e redes sociais da Pentacordis.",
  },
];

export default function MusicianTermPage() {
  return (
    <main className="proposal-shell min-h-screen bg-white px-5 py-8 print:px-0 print:py-0">
      <div className="proposal-actions mb-6 flex justify-end">
        <PrintProposalButton />
      </div>
      <article className="proposal-page mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white p-[14mm] text-black print:w-[210mm] print:max-w-none">
        <header className="border-b border-black pb-6 text-center">
          <BrandLogo variant="black" size="lg" className="mx-auto" />
          <h1 className="mt-5 font-display text-2xl font-light uppercase tracking-[0.04em]">
            Termo de Parceria Artística e Conduta Operacional
          </h1>
          <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.24em] text-neutral-500">
            Músicos e Cantores Convidados
          </p>
        </header>

        <section className="mt-7 space-y-5">
          {clauses.map((clause) => (
            <div key={clause.title}>
              <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em]">{clause.title}</h2>
              <p className="mt-1.5 text-[11px] leading-[1.65] text-neutral-700">{clause.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-5 text-[11px]">
          <p>Nome Completo: ___________________________________________ <span className="ml-3">CPF: ____________________</span></p>
          <p>Instrumento/Naipe: ________________________________________ <span className="ml-3">Chave Pix: __________________</span></p>
          <p>Data e Assinatura: _______ / _______ / 20____ — __________________________________________</p>
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-neutral-300 pt-4">
          <BrandLogo variant="muted" size="xs" />
        </footer>
      </article>
    </main>
  );
}
