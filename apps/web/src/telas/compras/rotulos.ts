import type { StatusPedido } from '@ailow/shared';
import { ErroApi } from '../../api/cliente';

export const ROTULO_STATUS: Record<StatusPedido, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  recebido: 'Recebido',
};

export function mensagemCompras(e: unknown): string {
  if (!(e instanceof ErroApi)) return 'Algo deu errado. Tente de novo.';
  switch (e.codigo) {
    case 'whatsapp_ja_cadastrado':
      return 'Já existe um fornecedor com este WhatsApp.';
    case 'parcelas_divergem':
      return 'As parcelas precisam somar exatamente o total do pedido.';
    case 'status_invalido':
      return 'Este pedido não está no status certo para essa ação.';
    case 'ja_recebido':
      return 'Este pedido já foi recebido.';
    case 'nao_encontrado':
    case 'fornecedor_nao_encontrado':
      return 'Não encontramos esse item.';
    default:
      return 'Algo deu errado. Tente de novo.';
  }
}
