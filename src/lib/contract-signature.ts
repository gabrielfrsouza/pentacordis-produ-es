function isValidCpf(digits: string) {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const firstSum = digits.slice(0, 9).split("").reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0);
  const firstDigit = (firstSum * 10) % 11 % 10;
  const secondSum = digits.slice(0, 10).split("").reduce((sum, digit, index) => sum + Number(digit) * (11 - index), 0);
  const secondDigit = (secondSum * 10) % 11 % 10;
  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
}

function isValidCnpj(value: string) {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^([A-Z0-9])\1{13}$/.test(value)) return false;
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const firstSum = firstWeights.reduce((sum, weight, index) => sum + (value.charCodeAt(index) - 48) * weight, 0);
  const firstDigit = firstSum % 11 < 2 ? 0 : 11 - (firstSum % 11);
  const secondSum = secondWeights.reduce((sum, weight, index) => sum + (value.charCodeAt(index) - 48) * weight, 0);
  const secondDigit = secondSum % 11 < 2 ? 0 : 11 - (secondSum % 11);
  return firstDigit === Number(value[12]) && secondDigit === Number(value[13]);
}

export function normalizeSignerDocument(value: string) {
  const normalized = value.replace(/[./\-\s]/g, "").toUpperCase();
  return isValidCpf(normalized) || isValidCnpj(normalized) ? normalized : null;
}
