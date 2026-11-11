const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** RN-01: dinheiro é sempre inteiro em centavos; nenhum cálculo em ponto flutuante. */
export function formatarReais(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error('Valor deve ser inteiro em centavos');
  }
  return formatador.format(centavos / 100);
}

/** Caminho de volta de `reaisParaCentavos`: 8990 -> "89,90", 5 -> "0,05". Só aritmética inteira (RN-01). */
export function centavosParaTexto(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error('Valor deve ser inteiro em centavos, não negativo');
  }
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

const MAX_DIGITOS_INTEIROS = 9; // até 999.999.999 reais: o produto de 100 continua inteiro seguro

/**
 * RN-01: converte o que a pessoa digitou ("1.234,56", "12,5", "R$ 25") em centavos inteiros, só com texto
 * (sem Number("12.34") * 100, que erra: 0,29 * 100 = 28,999…). Devolve null se não for um valor válido.
 * A vírgula é o separador decimal; o ponto vale como milhar ("1.234") ou, sozinho com 1–2 casas, como decimal ("12.5").
 */
export function reaisParaCentavos(texto: string): number | null {
  const t = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(t)) return null;

  let inteiro = t;
  let decimal = '';
  const partesVirgula = t.split(',');
  if (partesVirgula.length > 2) return null;
  if (partesVirgula.length === 2) {
    [inteiro, decimal] = partesVirgula as [string, string];
  } else if (t.includes('.')) {
    const pontos = t.split('.');
    const ultimo = pontos[pontos.length - 1] as string;
    if (pontos.length === 2 && ultimo.length >= 1 && ultimo.length <= 2) {
      inteiro = pontos[0] as string;
      decimal = ultimo;
    }
  }

  if (inteiro.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(inteiro)) return null;
    inteiro = inteiro.split('.').join('');
  } else if (!/^\d*$/.test(inteiro)) {
    return null;
  }
  if (!/^\d{0,2}$/.test(decimal)) return null;
  if (inteiro === '' && decimal === '') return null;
  if (inteiro.length > MAX_DIGITOS_INTEIROS) return null;

  return Number(inteiro || '0') * 100 + Number(decimal.padEnd(2, '0'));
}
