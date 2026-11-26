import { BrandMark } from "@/components/brand/BrandMark";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { COMPANY } from "@/lib/company";
import { currencyToWordsBR, formatDateLongBR, summarizeLineup } from "@/lib/format-contract";
import type { Contract, PublicContractPayload } from "@/types/database";
import { z } from "zod";

type ContractViewData = Contract | PublicContractPayload["contract"];

type Props = {
  contract: ContractViewData;
  event: PublicContractPayload["event"];
  installments: PublicContractPayload["installments"];
  signedDocument?: PublicContractPayload["signed_document"];
};

const signedSnapshotSchema = z.object({
  document: z.object({
    contract: z.object({
      id: z.string(),
      client_name: z.string(),
      cpf_cnpj: z.string().nullable(),
      client_address: z.string().nullable(),
      client_phone: z.string().nullable(),
      client_email: z.string().nullable(),
      total_value: z.number(),
      duration_label: z.string().nullable(),
      included_structure: z.string().nullable(),
      extra_hour_fee: z.number().nullable(),
      contractor_city: z.string().nullable(),
      status: z.enum(["rascunho", "assinado", "cancelado"]),
      signed_at: z.string().nullable(),
      signer_name: z.string().nullable().optional(),
      has_electronic_signature: z.boolean().optional(),
    }),
    installments: z.array(z.object({
      installment_number: z.number(),
      amount: z.number(),
      due_date: z.string(),
      status: z.enum(["pendente", "pago", "atrasado"]),
    })),
    event: z.object({
      title: z.string(),
      event_type: z.string().nullable(),
      event_date: z.string(),
      start_time: z.string().nullable(),
      venue_name: z.string().nullable(),
      venue_address: z.string().nullable(),
      lineup: z.array(z.object({ role_needed: z.string() })),
    }).nullable(),
  }),
  company: z.object({
    name: z.string(),
    document: z.string(),
    city: z.string(),
    forum: z.string(),
  }),
  terms_version: z.string(),
  signed_at: z.string(),
});

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCurrency(value: number) {
  return currency.format(value);
}

function getLocalISODate() {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? "";
  return `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
}

function getFallbackInstallments(totalValue: number, eventDate: string | null) {
  const totalCents = Math.round((totalValue + Number.EPSILON) * 100);
  const depositCents = Math.round(totalCents * 0.3);
  let finalDueDate = "Até 7 dias antes do evento";

  if (eventDate) {
    const [year, month, day] = eventDate.slice(0, 10).split("-").map(Number);
    const due = new Date(year, month - 1, day, 12);
    due.setDate(due.getDate() - 7);
    finalDueDate = formatDateLongBR(
      `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
    );
  }

  return [
    { number: 1, label: "Na assinatura do contrato", amount: depositCents / 100 },
    { number: 2, label: finalDueDate, amount: (totalCents - depositCents) / 100 },
  ];
}

function displayField(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

function formatRecifeDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatRecifeDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "long",
  }).format(new Date(date));
}

function SignatureCertificate({ contract }: { contract: Contract }) {
  if (!contract.document_hash || !contract.signed_at) return null;

  return (
    <section className="contract-signature-certificate mt-8 border border-[#0A0A0A] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[#E5E5E5] pb-3">
        <BrandMark variant="black" size="xs" />
        <h2 className="text-[10pt] font-semibold uppercase tracking-wide">
          Certificado de Assinatura Eletrônica — Pentacordis
        </h2>
      </div>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        <div>
          <dt className="text-[8pt] uppercase tracking-wide text-neutral-500">Signatário</dt>
          <dd>{contract.signer_name ?? contract.client_name}</dd>
        </div>
        <div>
          <dt className="text-[8pt] uppercase tracking-wide text-neutral-500">CPF/CNPJ</dt>
          <dd>{displayField(contract.signer_document)}</dd>
        </div>
        <div>
          <dt className="text-[8pt] uppercase tracking-wide text-neutral-500">Data e hora — Brasília / Recife</dt>
          <dd className="tabular-nums">{formatRecifeDateTime(contract.signed_at)}</dd>
        </div>
        <div>
          <dt className="text-[8pt] uppercase tracking-wide text-neutral-500">Endereço IP registrado</dt>
          <dd className="tabular-nums">{displayField(contract.signer_ip)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[8pt] uppercase tracking-wide text-neutral-500">Hash SHA-256 do documento assinado</dt>
          <dd className="break-all font-mono text-[8pt]">{contract.document_hash}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ContractDocument({ contract, event, installments, signedDocument }: Props) {
  const parsedSnapshot = "signed_snapshot" in contract && contract.signed_snapshot
    ? signedSnapshotSchema.safeParse(contract.signed_snapshot)
    : null;
  const snapshot = parsedSnapshot?.success ? parsedSnapshot.data : null;
  const documentContract = signedDocument?.contract ?? snapshot?.document.contract ?? contract;
  const documentEvent = signedDocument?.event ?? snapshot?.document.event ?? event;
  const documentInstallments = signedDocument?.installments ?? snapshot?.document.installments ?? installments;
  const company = snapshot?.company ?? COMPANY;
  const contractCity = documentContract.contractor_city?.trim() || company.city;
  const eventDate = documentEvent?.event_date ?? null;
  const lineup = documentEvent?.lineup ?? [];
  const paymentSchedule = documentInstallments.length > 0
    ? documentInstallments.map((item) => ({
        number: item.installment_number,
        label: formatDateLongBR(item.due_date),
        amount: Number(item.amount),
      }))
    : getFallbackInstallments(Number(documentContract.total_value), eventDate);
  const documentDate = snapshot
    ? formatRecifeDate(snapshot.signed_at)
    : contract.signed_at
      ? formatRecifeDate(contract.signed_at)
    : formatDateLongBR(getLocalISODate());
  const electronicallySigned = Boolean(
    "has_electronic_signature" in contract
      ? contract.has_electronic_signature
      : "document_hash" in contract
        ? contract.document_hash
        : contract.status === "assinado",
  );
  const signatureImage = "signature_image" in contract ? contract.signature_image : null;
  const signerDocument = "signer_document" in contract ? contract.signer_document : null;

  return (
    <article className="contract-document mx-auto min-h-[297mm] w-full max-w-[210mm] bg-white px-7 py-9 text-[10.5pt] leading-relaxed text-[#0A0A0A] sm:px-12 sm:py-12 print:min-h-0 print:w-full print:max-w-none print:p-0">
      <div className="mb-5 flex flex-col items-center text-center">
        <BrandLogo variant="black" size="md" className="contract-brand-mark mb-3" />
        <div className="w-full border-t border-[#E5E5E5] pt-4">
          <h1 className="font-display text-2xl font-medium uppercase leading-tight tracking-wide sm:text-3xl">
            Contrato de Prestação de Serviços Musicais e Produção Artística
          </h1>
          <p className="tabular-nums mt-3 text-[9pt] uppercase tracking-[0.18em] text-neutral-500">
            Referência {contract.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      <section className="contract-clause mb-5">
        <h2 className="mb-2 text-[10pt] font-semibold uppercase tracking-wide">Qualificação das Partes</h2>
        <p>
          <strong>CONTRATADA:</strong> {company.name}, inscrito no CPF sob nº {company.document}, com sede em {contractCity}, atuando como representante legal de PENTACORDIS PRODUÇÕES MUSICAIS.
        </p>
        <p className="mt-2">
          <strong>CONTRATANTE:</strong> {documentContract.client_name}, inscrito(a) no CPF/CNPJ sob nº {displayField(documentContract.cpf_cnpj)}, residente/sediado(a) em {displayField(documentContract.client_address)}.
          {" "}Telefone: {displayField(documentContract.client_phone)}. E-mail: {displayField(documentContract.client_email)}.
        </p>
        <p className="mt-2">
          As partes acima qualificadas celebram o presente Contrato de Prestação de Serviços Musicais e Produção Artística, mediante as condições seguintes.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 1ª — DO OBJETO E DAS ESPECIFICAÇÕES DO EVENTO</h2>
        <p>
          A CONTRATADA prestará serviços de produção e execução musical para o evento <strong>{documentEvent?.title ?? "a definir"}</strong>, do tipo <strong>{documentEvent?.event_type ?? "a definir"}</strong>, a realizar-se em <strong>{eventDate ? formatDateLongBR(eventDate) : "data a definir"}</strong>, no local <strong>{documentEvent?.venue_name ?? "a definir"}</strong>, situado à {documentEvent?.venue_address ?? "endereço a definir"}. O início está previsto para {documentEvent?.start_time?.slice(0, 5) ?? "horário a definir"}.
        </p>
        <p className="mt-1">
          A apresentação terá duração de {documentContract.duration_label || "Até 1h30 de apresentação"}. A formação prevista é: {summarizeLineup(lineup)}. Está incluída a seguinte estrutura: {documentContract.included_structure || "Sonorização compatível com o ambiente, microfonação da equipe e direção musical em cena"}.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 2ª — DO REPERTÓRIO E CURADORIA</h2>
        <p>
          A CONTRATADA apresentará a lista final de repertório para validação do CONTRATANTE com antecedência mínima de 30 (trinta) dias da data do evento, sempre que a contratação ocorrer em prazo hábil. Arranjos inéditos ou adaptações especiais dependerão de análise de viabilidade técnica e poderão gerar taxa adicional, previamente informada e aprovada pelo CONTRATANTE. Alterações no repertório deverão ser solicitadas com antecedência mínima de 15 (quinze) dias, sujeitas à viabilidade artística e operacional.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 3ª — DO VALOR E DA FORMA DE PAGAMENTO</h2>
        <p>
          O valor total dos serviços é de <strong className="tabular-nums">{formatCurrency(Number(documentContract.total_value))}</strong> ({currencyToWordsBR(Number(documentContract.total_value))}), a ser pago conforme as parcelas abaixo:
        </p>
        <ol className="my-2 list-inside list-decimal space-y-0.5">
          {paymentSchedule.map((item, index) => (
            <li key={`${item.number}-${index}`}>
              Parcela {String(item.number).padStart(2, "0")}: <strong className="tabular-nums">{formatCurrency(item.amount)}</strong> — vencimento: {item.label}.
            </li>
          ))}
        </ol>
        <p>
          {documentInstallments.length === 0
            ? "Na ausência de parcelas cadastradas, aplica-se o padrão de 30% (trinta por cento) na assinatura deste contrato e 70% (setenta por cento) até 7 (sete) dias antes do evento."
            : "As datas e valores das parcelas acima correspondem ao cronograma financeiro cadastrado para este contrato."} O atraso no pagamento sujeitará o CONTRATANTE à multa moratória de 2% (dois por cento) sobre o valor em atraso e juros de 1% (um por cento) ao mês, calculados proporcionalmente. A quitação integral deverá ocorrer até 48 (quarenta e oito) horas antes do evento. A CONTRATADA emitirá a respectiva nota fiscal, conforme a legislação aplicável.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 4ª — DAS CONDIÇÕES ESTRUTURAIS E LOGÍSTICAS DO LOCAL</h2>
        <p>
          O CONTRATANTE deverá garantir acesso da equipe ao local com antecedência mínima de 1h30 (uma hora e trinta minutos) para montagem e preparação, bem como ponto de energia elétrica estabilizada a até 10 (dez) metros da área de execução. Em apresentações ao ar livre, é obrigatória cobertura adequada contra sol e chuva para músicos e instrumentos. Sob chuva ou condição que ofereça risco à equipe ou aos equipamentos, a CONTRATADA poderá interromper a apresentação, sem prejuízo do valor contratado. O local deverá dispor de espaço nivelado e seguro. Para permanência superior a 4 (quatro) horas ou evento fora de Recife e Região Metropolitana, o CONTRATANTE deverá providenciar carga e alimentação para a equipe, conforme previamente acordado.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 5ª — DA PONTUALIDADE, TOLERÂNCIA E HORAS EXTRAS</h2>
        <p>
          Será observada tolerância máxima de 30 (trinta) minutos para atrasos operacionais do evento. O período de apresentação contratado não se estende automaticamente em razão de atrasos. A hora extra, quando previamente solicitada e aceita pela CONTRATADA, será cobrada pelo valor de <strong className="tabular-nums">{formatCurrency(Number(documentContract.extra_hour_fee ?? 450))}</strong> por hora, sujeita à disponibilidade da equipe.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 6ª — DA GESTÃO DE ELENCO E SUBSTITUIÇÕES</h2>
        <p>
          A CONTRATADA será exclusivamente responsável pela contratação, remuneração e encargos de músicos, cantores e técnicos integrantes da equipe, inexistindo vínculo trabalhista entre estes e o CONTRATANTE. Em caso de força maior que impeça a participação de profissional escalado, a CONTRATADA garantirá sua substituição por profissional de nível técnico e artístico equivalente.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 7ª — DO REAGENDAMENTO E CANCELAMENTO</h2>
        <p>
          Em caso de cancelamento pelo CONTRATANTE, serão retidos 30% (trinta por cento) do valor contratado quando comunicado com mais de 60 (sessenta) dias de antecedência; 50% (cinquenta por cento) quando comunicado entre 30 (trinta) e 59 (cinquenta e nove) dias; e 100% (cem por cento) quando comunicado com menos de 30 (trinta) dias. O reagendamento deverá ser solicitado com antecedência mínima de 30 (trinta) dias, ficará condicionado à disponibilidade da agenda da CONTRATADA e deverá ocorrer em até 12 (doze) meses da data original. Em caso de inexecução injustificada pela CONTRATADA, esta pagará multa compensatória de 20% (vinte por cento) do valor contratado e devolverá integralmente os valores recebidos.
        </p>
      </section>

      <section className="contract-clause mb-4">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 8ª — DOS DIREITOS DE IMAGEM, ÁUDIO E PROPRIEDADE INTELECTUAL</h2>
        <p>
          Os arranjos musicais e materiais artísticos desenvolvidos ou disponibilizados pela CONTRATADA permanecem de sua propriedade intelectual, vedada sua reprodução ou utilização fora do evento sem autorização. O CONTRATANTE autoriza o registro e uso de imagens, vídeos e trechos de áudio da apresentação para portfólio e divulgação institucional da CONTRATADA, ressalvada solicitação expressa de confidencialidade apresentada previamente.
        </p>
      </section>

      <section className="contract-clause mb-5">
        <h2 className="mb-1 text-[10pt] font-semibold uppercase tracking-wide">CLÁUSULA 9ª — DO FORO</h2>
        <p>
          Fica eleito o foro da Comarca de <strong>{company.forum}</strong> para dirimir eventuais controvérsias decorrentes deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>
      </section>

      <p className="mb-8 text-right">{contractCity}, {documentDate}.</p>

      <section className="contract-signatures grid grid-cols-2 gap-8 pt-3">
        <div className="contract-signature text-center">
          <div className="min-h-12 border-b border-[#0A0A0A]" />
          <p className="mt-2 font-semibold uppercase">CONTRATADA</p>
          <p>{company.name}</p>
          <p>CNPJ/CPF: {company.document}</p>
        </div>
        <div className="contract-signature text-center">
          <div className="flex min-h-12 items-end justify-center border-b border-[#0A0A0A]">
            {electronicallySigned && signatureImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signatureImage} alt="Assinatura manuscrita do contratante" className="max-h-12 max-w-full object-contain" />
            ) : electronicallySigned ? (
              <p className="font-display text-xl italic">{contract.signer_name ?? documentContract.client_name}</p>
            ) : null}
          </div>
          <p className="mt-2 font-semibold uppercase">CONTRATANTE</p>
          <p>{electronicallySigned ? contract.signer_name ?? documentContract.client_name : documentContract.client_name}</p>
          <p>CPF/CNPJ: {displayField(electronicallySigned ? signerDocument ?? documentContract.cpf_cnpj : documentContract.cpf_cnpj)}</p>
        </div>
      </section>

      {"document_hash" in contract ? <SignatureCertificate contract={contract} /> : null}
      {electronicallySigned && !("document_hash" in contract) && contract.signed_at ? (
        <section className="contract-signature-certificate mt-8 border border-[#0A0A0A] p-4">
          <p className="text-[9pt]">
            Assinatura eletrônica registrada em {formatRecifeDateTime(contract.signed_at)}.
          </p>
        </section>
      ) : null}
    </article>
  );
}
