const SMALL_NUMBERS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
] as const;

const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"] as const;
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"] as const;
const SCALES = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
  ["trilhão", "trilhões"],
] as const;

function underThousand(value: number): string {
  if (value < 20) return SMALL_NUMBERS[value];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const units = value % 10;
    return units === 0 ? TENS[tens] : `${TENS[tens]} e ${SMALL_NUMBERS[units]}`;
  }
  if (value === 100) return "cem";

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return remainder === 0 ? HUNDREDS[hundreds] : `${HUNDREDS[hundreds]} e ${underThousand(remainder)}`;
}

function integerToWords(value: number): string {
  if (value === 0) return "zero";
  const groups: number[] = [];
  let remainder = value;
  while (remainder > 0) {
    groups.push(remainder % 1000);
    remainder = Math.floor(remainder / 1000);
  }

  const parts: { text: string; value: number }[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index];
    if (group === 0) continue;
    if (index === 1 && group === 1) {
      parts.push({ text: "mil", value: group });
    } else if (index > 0) {
      const scale = SCALES[index];
      parts.push({
        text: `${underThousand(group)} ${group === 1 ? scale[0] : scale[1]}`,
        value: group,
      });
    } else {
      parts.push({ text: underThousand(group), value: group });
    }
  }

  return parts.reduce((result, part, index) => {
    if (index === 0) return part.text;
    const isFinalSmallGroup = index === parts.length - 1 && (part.value < 100 || part.value % 100 === 0);
    return `${result}${isFinalSmallGroup ? " e " : ", "}${part.text}`;
  }, "");
}

export function currencyToWordsBR(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) {
    throw new RangeError("O valor monetário está fora do intervalo suportado.");
  }

  const totalCents = Math.round((Math.abs(value) + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(totalCents)) {
    throw new RangeError("O valor monetário está fora do intervalo suportado.");
  }
  const reais = Math.floor(totalCents / 100);
  const centavos = totalCents % 100;
  const parts: string[] = [];

  if (reais > 0 || centavos === 0) {
    const currencyUnit = reais === 1 ? "real" : reais >= 1_000_000 && reais % 1_000_000 === 0 ? "de reais" : "reais";
    parts.push(`${integerToWords(reais)} ${currencyUnit}`);
  }
  if (centavos > 0) {
    parts.push(`${integerToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  const wording = parts.join(" e ");
  return value < 0 ? `menos ${wording}` : wording;
}

export function formatDateLongBR(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    if (date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(date);
    }
  }

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(parsed);
}

export function formatDateTimeRecifeBR(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

const ROLE_PLURALS: Record<string, string> = {
  baixo: "baixos",
  piano: "pianos",
  soprano: "sopranos",
  tenor: "tenores",
  violino: "violinos",
  vocal: "vocais",
  "técnico de som": "técnicos de som",
};

function pluralizeRole(role: string): string {
  const lower = role.toLocaleLowerCase("pt-BR");
  if (ROLE_PLURALS[lower]) return ROLE_PLURALS[lower];
  if (lower.endsWith("s")) return lower;
  if (lower.endsWith("l")) return `${lower.slice(0, -1)}is`;
  if (lower.endsWith("m")) return `${lower.slice(0, -1)}ns`;
  return `${lower}s`;
}

function capitalizeRole(role: string): string {
  return role.charAt(0).toLocaleUpperCase("pt-BR") + role.slice(1);
}

export function summarizeLineup(lineup: { role_needed: string }[]): string {
  if (lineup.length === 0) return "Formação conforme proposta comercial anexa";

  const grouped = new Map<string, { label: string; count: number }>();
  for (const item of lineup) {
    const role = item.role_needed.trim();
    if (!role) continue;
    const key = role.toLocaleLowerCase("pt-BR");
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { label: role, count: 1 });
  }

  if (grouped.size === 0) return "Formação conforme proposta comercial anexa";
  return Array.from(grouped.values(), ({ label, count }) => {
    const displayedRole = count === 1 ? label : pluralizeRole(label);
    return `${String(count).padStart(2, "0")} ${capitalizeRole(displayedRole)}`;
  }).join(", ");
}
