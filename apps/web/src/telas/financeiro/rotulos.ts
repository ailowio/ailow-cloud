import type { FormaPagamento, Lancamento, SituacaoConta, TipoCategoria } from '@ailow/shared';
import { mensagemGenerica } from '../../acesso/mensagens';
import type { ErroApi } from '../../api/cliente';

// Textos do Financeiro para quem não é da tecnologia: dizem o que aconteceu e o que fazer, sem código de erro.

const ROTULOS_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
};
export const rotuloForma = (f: FormaPagamento): string => ROTULOS_FORMA[f];
// Ordem do seletor = ordem do contrato (o Record exige todas as formas; o teste confere a ordem).
export const FORMAS = Object.keys(ROTULOS_FORMA) as FormaPagamento[];

const ORIGENS: Record<OrigemLancamento, string> = {
  venda: 'Venda',
  compra: 'Compra',
  despesa: 'Despesa',
  estorno: 'Estorno',
};
/** O que a pessoa lê na lista: a descrição, ou de onde veio o lançamento. */
export const tituloLancamento = (l: { descricao: string | null; origem_tipo: OrigemLancamento }): string =>
  l.descricao ?? ORIGENS[l.origem_tipo];

type OrigemLancamento = Lancamento['origem_tipo'];

const ROTULOS_SITUACAO: Record<SituacaoConta, string> = {
  vencida: 'Vencidas',
  hoje: 'Vencem hoje',
  proximos_7_dias: 'Próximos 7 dias',
  depois: 'Depois',
};
export const rotuloSituacao = (s: SituacaoConta): string => ROTULOS_SITUACAO[s];
// Ordem das seções em "Contas a pagar": as vencidas primeiro.
export const SITUACOES = Object.keys(ROTULOS_SITUACAO) as SituacaoConta[];

const CONFLITOS: Record<string, string> = {
  ja_pago: 'Esta conta já foi paga.',
  ja_estornado: 'Este lançamento já foi estornado.',
  e_estorno: 'Um estorno não pode ser estornado.',
  lancamento_estornado: 'Esta conta foi cancelada e não pode ser paga.',
};

const ROTULOS_TIPO_CATEGORIA: Record<TipoCategoria, string> = {
  produto: 'Produtos',
  financeira: 'Financeiras',
};
/** Nome das duas listas de categorias (abas em Configurações). */
export const rotuloTipoCategoria = (t: TipoCategoria): string => ROTULOS_TIPO_CATEGORIA[t];
// Ordem das abas = ordem do contrato (o Record exige todos os tipos; o teste confere a ordem).
export const TIPOS_DE_CATEGORIA = Object.keys(ROTULOS_TIPO_CATEGORIA) as TipoCategoria[];

/**
 * Os pagamentos de uma venda que ainda podem ser estornados, entre os lançamentos já carregados na tela.
 * Estornar a venda é estornar todos eles de uma vez (RN-08); a lista serve para dizer ao Dono quanto será estornado.
 */
export function pagamentosDaVenda(lancamentos: Lancamento[], origemId: string): Lancamento[] {
  return lancamentos.filter((l) => l.origem_tipo === 'venda' && l.origem_id === origemId && l.status !== 'estornado');
}

export function mensagemFinanceiro(e: ErroApi): string {
  if (e.status === 400 && e.codigo === 'categoria_invalida') {
    return 'Essa categoria não existe ou está desativada. Escolha outra, ou cadastre em Configurações › Categorias.';
  }
  if (e.status === 409 && CONFLITOS[e.codigo]) return CONFLITOS[e.codigo] as string;
  if (e.status === 404) return 'Não encontramos este lançamento. Atualize a tela.';
  return mensagemGenerica(e);
}
