import type { FormaPagamento } from '@ailow/shared';
import { mensagemGenerica } from '../../acesso/mensagens';
import type { ErroApi } from '../../api/cliente';

export const ROTULOS_FORMA: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
};

export const FORMAS = Object.keys(ROTULOS_FORMA) as FormaPagamento[];

const ERROS: Record<string, string> = {
  estoque_insuficiente: 'Peça sem estoque — chame o Dono.',
  nome_obrigatorio: 'Cliente novo: diga o nome para finalizar.',
  cliente_inativo: 'Este celular está inativo — chame o Dono.',
  pagamentos_divergem: 'A soma dos pagamentos tem de ser igual ao total.',
  desconto_acima_do_subtotal: 'O desconto não pode passar do total da venda.',
  ja_cancelada: 'Esta venda já foi cancelada.',
  sem_permissao: 'Só quem fez a venda, ou o Dono, cancela.',
  nao_encontrado: 'Não achei essa venda ou essa peça.',
};

export function mensagemVenda(e: ErroApi): string {
  return ERROS[e.codigo] ?? mensagemGenerica(e);
}
