const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** RN-01: dinheiro é sempre inteiro em centavos; nenhum cálculo em ponto flutuante. */
export function formatarReais(centavos: number): string {
  if (!Number.isInteger(centavos)) {
    throw new Error('Valor deve ser inteiro em centavos');
  }
  return formatador.format(centavos / 100);
}
