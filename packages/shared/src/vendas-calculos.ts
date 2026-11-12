// Regras puras da venda (S10, RN-01/02/05, RF-VEN-05/07/09). Sem Zod: o app web usa estas funções por `@ailow/shared/puro`.
// Dinheiro é inteiro em centavos. Desconto percentual trunca o centavo (1% de R$ 0,50 = 0). Sem teto por perfil (D19).

// O mesmo teto do lançamento (R$ 20 milhões). Duplicado de propósito: este arquivo não pode importar Zod (vai para o navegador).
const TETO_CENTAVOS = 2_000_000_000;

export type DescontoVenda =
  | { tipo: 'nenhum' }
  | { tipo: 'percentual'; percentual: number }
  | { tipo: 'valor'; centavos: number };

export interface LinhaParaFechar {
  precoCentavos: number;
  quantidade: number;
}

export type Fechamento =
  | { ok: true; subtotalCentavos: number; descontoCentavos: number; totalCentavos: number }
  | { ok: false; erro: 'sem_itens' | 'desconto_acima_do_subtotal' | 'pagamentos_divergem' | 'total_acima_do_limite' };

/** RN-02: subtotal, desconto e total, sem olhar o pagamento. A tela usa isto enquanto a pessoa ainda não pagou. */
export function totaisDaVenda(
  linhas: LinhaParaFechar[],
  desconto: DescontoVenda,
): Extract<Fechamento, { ok: true }> | Exclude<Fechamento, { erro: 'pagamentos_divergem' }> {
  if (linhas.length === 0) return { ok: false, erro: 'sem_itens' };
  let subtotal = 0;
  for (const l of linhas) subtotal += l.precoCentavos * l.quantidade;
  if (!Number.isSafeInteger(subtotal) || subtotal > TETO_CENTAVOS) return { ok: false, erro: 'total_acima_do_limite' };

  const descontoCentavos =
    desconto.tipo === 'nenhum' ? 0 : desconto.tipo === 'valor' ? desconto.centavos : Math.floor((subtotal * desconto.percentual) / 100);
  if (descontoCentavos > subtotal) return { ok: false, erro: 'desconto_acima_do_subtotal' };
  const total = subtotal - descontoCentavos;
  if (total > TETO_CENTAVOS) return { ok: false, erro: 'total_acima_do_limite' };
  return { ok: true, subtotalCentavos: subtotal, descontoCentavos, totalCentavos: total };
}

/** RN-02: total = Σ itens − desconto ≥ 0, e Σ pagamentos = total. Total zero não leva pagamento. */
export function calcularFechamento(linhas: LinhaParaFechar[], desconto: DescontoVenda, pagamentos: number[]): Fechamento {
  const totais = totaisDaVenda(linhas, desconto);
  if (!totais.ok) return totais;
  const soma = pagamentos.reduce((a, v) => a + v, 0);
  const pagamentosOk =
    totais.totalCentavos === 0 ? pagamentos.length === 0 : pagamentos.length > 0 && pagamentos.every((v) => v >= 1) && soma === totais.totalCentavos;
  if (!pagamentosOk) return { ok: false, erro: 'pagamentos_divergem' };
  return totais;
}

/**
 * RF-VEN-09 / D8: número inventado para fechar rápido. Vale para um celular já normalizado (11 dígitos).
 * Suspeito: os 11 dígitos iguais, os 8 depois do 9 todos iguais, ou esses 8 em sequência (12345678 / 87654321).
 */
export function celularSuspeito(celular: string): boolean {
  if (/^(\d)\1{10}$/.test(celular)) return true;
  const finais = celular.slice(3);
  if (/^(\d)\1{7}$/.test(finais)) return true;
  return finais === '12345678' || finais === '87654321';
}

function reais(centavos: number): string {
  const abs = Math.abs(centavos);
  const inteiro = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = String(abs % 100).padStart(2, '0');
  return `R$ ${inteiro},${cents}`;
}

/** Texto curto para o WhatsApp e para a versão imprimível. Não leva custo nem dado além da venda. */
export function textoDoComprovante(v: {
  numero: number;
  itens: { nome: string; quantidade: number; totalCentavos: number }[];
  totalCentavos: number;
}): string {
  const linhas = v.itens.map((i) => `${i.quantidade}× ${i.nome} — ${reais(i.totalCentavos)}`);
  return [`Venda ${v.numero}`, ...linhas, `Total ${reais(v.totalCentavos)}`].join('\n');
}

/** Abre a conversa do cliente com o comprovante já escrito (RF-VEN-07). Celular normalizado, sem o 55. */
export function linkComprovanteWhatsApp(celular: string, texto: string): string {
  return `https://wa.me/55${celular}?text=${encodeURIComponent(texto)}`;
}
