import type { AlertaEstoque, Porte, TipoMovimento } from '@ailow/shared';
import { mensagemGenerica } from '../../acesso/mensagens';
import type { ErroApi } from '../../api/cliente';

// Textos de Produtos para quem não é da tecnologia: dizem o que aconteceu e o que fazer, sem código de erro.

const PORTES: Record<Porte, string> = { slim: 'Slim', plus: 'Plus' };
export const rotuloPorte = (p: Porte): string => PORTES[p];
// Ordem do seletor = ordem do contrato (o Record exige todos os portes).
export const PORTES_DISPONIVEIS = Object.keys(PORTES) as Porte[];

const MOVIMENTOS: Record<TipoMovimento, string> = {
  inicial: 'Estoque inicial',
  entrada: 'Entrada de mercadoria',
  ajuste: 'Ajuste',
  venda: 'Venda',
  estorno_venda: 'Venda estornada',
  compra: 'Compra recebida',
};
export const rotuloMovimento = (t: TipoMovimento): string => MOVIMENTOS[t];

/** Quantidade com sinal visível no histórico; o menos é o sinal de verdade (−), não o hífen. */
export const sinalDaQuantidade = (q: number): string => (q > 0 ? `+${q}` : `−${Math.abs(q)}`);

/** Título do aviso vermelho da tela inicial. Conta SKUs (tamanho × cor), por isso "itens" e não "peças". */
export const tituloDoAlerta = (total: number): string =>
  total === 1 ? '1 item abaixo do mínimo' : `${total} itens abaixo do mínimo`;

export function linhaDoAlerta(i: Pick<AlertaEstoque, 'produto' | 'tamanho' | 'cor' | 'estoque' | 'estoque_minimo'>): string {
  return `${i.produto} · ${i.tamanho} · ${i.cor}: tem ${i.estoque}, mínimo ${i.estoque_minimo}`;
}

/** "e mais 7" quando a tela mostra só os primeiros; nada se couberem todos. */
export const resumoDeRestantes = (total: number, mostrados: number): string | null =>
  total > mostrados ? `e mais ${total - mostrados}` : null;

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Dia/mês e hora:minuto no fuso do negócio (ADR 005), para o histórico de movimentos. */
export function dataHoraCurta(iso: string): string {
  const p = Object.fromEntries(DATA_HORA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function mensagemProdutos(e: ErroApi): string {
  if (e.status === 400 && e.codigo === 'categoria_invalida') {
    return 'Essa categoria não existe ou está desativada. Escolha outra, ou cadastre em Configurações › Categorias.';
  }
  if (e.status === 400 && e.codigo === 'atributos_invalidos') {
    return 'Algum atributo escolhido não existe mais nessa categoria. Volte e escolha de novo.';
  }
  if (e.status === 409 && e.codigo === 'limite_de_produtos') {
    return 'Você chegou a 9.999 produtos, o limite desta versão.';
  }
  if (e.status === 409 && e.codigo === 'estoque_insuficiente') {
    return 'Não há peças suficientes: o estoque não pode ficar negativo.';
  }
  if (e.status === 404) return 'Não encontramos esta peça. Atualize a tela.';
  return mensagemGenerica(e);
}
