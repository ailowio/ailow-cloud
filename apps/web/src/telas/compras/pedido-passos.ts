import { totalDoPedido } from '@ailow/shared/puro';
import { reaisParaCentavos } from '../../lib/dinheiro';

// S13: regras de cada passo do assistente "Novo pedido" (fornecedor → peças → confirmar). Mensagem devolvida = toast.

export type PassoPedido = 'fornecedor' | 'pecas' | 'confirmar';
export const PASSOS_PEDIDO: PassoPedido[] = ['fornecedor', 'pecas', 'confirmar'];

export interface LinhaPedido {
  sku_id: string;
  rotulo: string;
  quantidade: number;
  /** Como a pessoa digitou ("40,00"); vira centavos inteiros só na hora de enviar (RN-01). */
  custoTexto: string;
}

export interface RascunhoPedido {
  fornecedorId: string | null;
  linhas: LinhaPedido[];
}

const PROBLEMAS: Record<Exclude<PassoPedido, 'confirmar'>, (r: RascunhoPedido) => string | null> = {
  fornecedor: (r) => (r.fornecedorId === null ? 'Escolha o fornecedor.' : null),
  pecas: (r) => {
    if (r.linhas.length === 0) return 'Adicione pelo menos uma peça ao pedido.';
    for (const l of r.linhas) {
      if (!Number.isInteger(l.quantidade) || l.quantidade < 1) return `Confira a quantidade de ${l.rotulo}.`;
      const c = reaisParaCentavos(l.custoTexto);
      if (c === null || c < 1) return `Digite o custo de ${l.rotulo}.`;
    }
    const total = totalDoPedido(
      r.linhas.map((l) => ({ quantidade: l.quantidade, custoCentavos: reaisParaCentavos(l.custoTexto) ?? 0 })),
    );
    return total.ok ? null : 'O total do pedido passou do limite. Reduza quantidades ou custos.';
  },
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPassoPedido(passo: PassoPedido, r: RascunhoPedido): string | null {
  if (passo !== 'confirmar') return PROBLEMAS[passo](r);
  return PROBLEMAS.fornecedor(r) ?? PROBLEMAS.pecas(r);
}

/** Corpo do POST /compras, ou null se o rascunho ainda tem problema. */
export function pedidoParaApi(
  r: RascunhoPedido,
): { fornecedor_id: string; itens: { sku_id: string; quantidade: number; custo_centavos: number }[] } | null {
  if (validarPassoPedido('confirmar', r) !== null || r.fornecedorId === null) return null;
  return {
    fornecedor_id: r.fornecedorId,
    itens: r.linhas.map((l) => ({
      sku_id: l.sku_id,
      quantidade: l.quantidade,
      custo_centavos: reaisParaCentavos(l.custoTexto) as number,
    })),
  };
}
