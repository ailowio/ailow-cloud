// O que a busca ampla (UXM-09) enxerga em cada lista, e o tamanho da página. Funções puras: o que for achado
// na tela é exatamente o que aparece escrito no cartão (nome, número, status, valor, vencimento).
import type { ContaAPagar, Fornecedor, StatusPedido } from '@ailow/shared';
import type { CamposBusca } from './busca';

/** Itens por página nas listas de cadastro e de contas (UXM-09: 10 a 20). */
export const ITENS_POR_PAGINA = 15;

const somenteDigitos = (t: string) => t.replace(/\D/g, '');

/** "11999990000" → "(11) 99999-0000" só para a busca; sem depender de componente de tela. */
function celularLegivel(digitos: string): string {
  const d = somenteDigitos(digitos);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

export function camposDoCliente(c: { nome: string; celular: string }): CamposBusca {
  return { textos: [c.nome, c.celular, celularLegivel(c.celular)] };
}

export function camposDoFornecedor(f: Pick<Fornecedor, 'nome' | 'whatsapp' | 'cnpj'>): CamposBusca {
  return { textos: [f.nome, f.whatsapp, celularLegivel(f.whatsapp), f.cnpj ?? '', somenteDigitos(f.cnpj ?? '')] };
}

export interface PedidoResumo {
  numero: number;
  status: StatusPedido;
  total_centavos: number;
  fornecedor_nome: string;
}

/** Nº (com ou sem "Pedido"/"#"), fornecedor, status (rótulo da tela) e valor. */
export function camposDoPedido(p: PedidoResumo, rotuloStatus: string): CamposBusca {
  return {
    textos: [String(p.numero), `#${p.numero}`, `Pedido ${p.numero}`, p.fornecedor_nome, rotuloStatus],
    precoCentavos: p.total_centavos,
  };
}

/** Descrição, categoria, situação (rótulo da tela), vencimento (ISO e dd/mm/aaaa) e valor. */
export function camposDaConta(c: Pick<ContaAPagar, 'descricao' | 'categoria' | 'vencimento' | 'valor_centavos'>, rotuloSituacao: string): CamposBusca {
  const [ano, mes, dia] = c.vencimento.split('-');
  return {
    textos: [c.descricao ?? 'Conta', c.categoria ?? '', rotuloSituacao, c.vencimento, `${dia}/${mes}/${ano}`],
    precoCentavos: c.valor_centavos,
  };
}
