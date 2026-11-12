// Regras puras de Compras (S11, RF-COM-03/04, RN-01/11). Sem Zod: o app web usa estas funções por `@ailow/shared/puro`.

const TETO_CENTAVOS = 2_000_000_000;

export type TotalPedido =
  | { ok: true; totalCentavos: number }
  | { ok: false; erro: 'sem_itens' | 'total_acima_do_limite' };

export type ParcelasOk =
  | { ok: true }
  | { ok: false; erro: 'sem_parcelas' | 'parcelas_divergem' | 'parcela_invalida' };

/** Soma dos itens do pedido (quantidade × custo), em centavos inteiros. */
export function totalDoPedido(itens: { quantidade: number; custoCentavos: number }[]): TotalPedido {
  if (itens.length === 0) return { ok: false, erro: 'sem_itens' };
  let total = 0;
  for (const i of itens) total += i.quantidade * i.custoCentavos;
  if (!Number.isSafeInteger(total) || total < 1 || total > TETO_CENTAVOS) {
    return { ok: false, erro: 'total_acima_do_limite' };
  }
  return { ok: true, totalCentavos: total };
}

/** RN-11 / RF-COM-04: a soma das parcelas tem que fechar exatamente o total do pedido. */
export function parcelasFecham(totalCentavos: number, parcelas: number[]): ParcelasOk {
  if (parcelas.length === 0) return { ok: false, erro: 'sem_parcelas' };
  if (parcelas.some((v) => !Number.isInteger(v) || v < 1)) return { ok: false, erro: 'parcela_invalida' };
  const soma = parcelas.reduce((a, v) => a + v, 0);
  if (soma !== totalCentavos) return { ok: false, erro: 'parcelas_divergem' };
  return { ok: true };
}

/** Texto do pedido para o WhatsApp do fornecedor (RF-COM-03): código, cor e quantidade. */
export function textoDoPedido(p: {
  numero: number;
  itens: { codigo: string; cor: string; quantidade: number }[];
}): string {
  const linhas = p.itens.map((i) => `${i.codigo} · ${i.cor} · ${i.quantidade}`);
  return [`Pedido ${p.numero}`, ...linhas].join('\n');
}

/** Abre a conversa do fornecedor com o pedido já escrito (RF-COM-03). WhatsApp normalizado, sem o 55. */
export function linkPedidoWhatsApp(whatsapp: string, texto: string): string {
  return `https://wa.me/55${whatsapp}?text=${encodeURIComponent(texto)}`;
}

/** CNPJ só com dígitos (14) ou `null` se vazio/inválido. Aceita máscara. */
export function normalizarCnpj(entrada: string | null | undefined): string | null {
  if (entrada == null) return null;
  const texto = entrada.trim();
  if (texto === '') return null;
  if (!/^[0-9.\s/-]+$/.test(texto)) return null;
  const digitos = texto.replace(/\D/g, '');
  return digitos.length === 14 ? digitos : null;
}
