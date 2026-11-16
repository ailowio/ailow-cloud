import type { Porte, Produto, ProdutoEditar } from '@ailow/shared';
import { PRECO_MAXIMO_CENTAVOS } from '@ailow/shared/puro';
import { centavosParaTexto, reaisParaCentavos } from '../../lib/dinheiro';

// S09: regras do formulário "Editar produto" que não dependem da tela. A API valida tudo de novo.

export const NOME_MAXIMO = 80;

/** O que o formulário guarda: texto como a pessoa digita (custo e preço em reais, com vírgula). */
export interface FormularioProduto {
  nome: string;
  categoria_id: string;
  porte: Porte;
  atributos: string[];
  fornecedor: string;
  custoTexto: string;
  precoTexto: string;
}

export type CampoComErro = 'nome' | 'preco' | 'custo';

export type ResultadoEdicao =
  | { ok: true; corpo: ProdutoEditar }
  | { ok: false; erros: Partial<Record<CampoComErro, true>>; mensagem: string };

/**
 * Formulário preenchido com o produto atual. Só o Dono recebe o custo da API (RF-PRO-07): sem ele devolve null,
 * e a tela nem oferece "Editar".
 */
export function formularioDoProduto(p: Produto): FormularioProduto | null {
  if (p.custo_centavos === undefined) return null;
  return {
    nome: p.nome,
    categoria_id: p.categoria_id,
    porte: p.porte,
    atributos: p.atributos,
    fornecedor: p.fornecedor ?? '',
    custoTexto: centavosParaTexto(p.custo_centavos),
    precoTexto: centavosParaTexto(p.preco_centavos),
  };
}

/** Confere o formulário e monta o corpo do contrato; o erro vem como UM texto (toast) e os campos a marcar. */
export function corpoDaEdicao(f: FormularioProduto): ResultadoEdicao {
  const nome = f.nome.trim();
  const custo = f.custoTexto.trim() === '' ? null : reaisParaCentavos(f.custoTexto);
  const preco = f.precoTexto.trim() === '' ? null : reaisParaCentavos(f.precoTexto);

  const erros: Partial<Record<CampoComErro, true>> = {};
  const mensagens: string[] = [];
  if (nome === '' || nome.length > NOME_MAXIMO) {
    erros.nome = true;
    mensagens.push(`O nome precisa ter de 1 a ${NOME_MAXIMO} letras.`);
  }
  if (preco === null || preco < 1 || preco > PRECO_MAXIMO_CENTAVOS) {
    erros.preco = true;
    mensagens.push('Preço: escreva um valor maior que zero, com vírgula (ex.: 89,90), até 20 milhões.');
  }
  if (custo === null || custo > PRECO_MAXIMO_CENTAVOS) {
    erros.custo = true;
    mensagens.push('Custo: escreva o valor com vírgula (ex.: 45,00); zero vale.');
  }
  if (mensagens.length > 0 || preco === null || custo === null) {
    return { ok: false, erros, mensagem: mensagens.join(' ') };
  }
  return {
    ok: true,
    corpo: {
      nome,
      categoria_id: f.categoria_id,
      porte: f.porte,
      atributos: f.atributos,
      fornecedor: f.fornecedor.trim() === '' ? null : f.fornecedor.trim(),
      custo_centavos: custo,
      preco_centavos: preco,
    },
  };
}
