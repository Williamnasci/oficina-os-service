export function normalizeDocument(value: string, type: 'CPF' | 'CNPJ'): string {
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) throw new Error('Invalid document');
  const calculate = (size: number): number => {
    let total = 0;
    let factor = type === 'CPF' ? size + 1 : size - 7;
    for (let index = 0; index < size; index++) {
      total += Number(digits[index]) * factor--;
      if (type === 'CNPJ' && factor < 2) factor = 9;
    }
    if (type === 'CPF') { const remainder = total * 10 % 11; return remainder === 10 ? 0 : remainder; }
    const remainder = total % 11; return remainder < 2 ? 0 : 11 - remainder;
  };
  const size = type === 'CPF' ? 9 : 12;
  if (!new RegExp(`^\\d{${size + 2}}$`).test(digits) || calculate(size) !== Number(digits[size]) || calculate(size + 1) !== Number(digits[size + 1])) throw new Error(`Invalid ${type}`);
  return digits;
}

export function normalizePlate(value: string): string {
  const plate = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!/^[A-Z]{3}(\d{4}|\d[A-Z]\d{2})$/.test(plate)) throw new Error('Invalid Brazilian license plate');
  return plate;
}
