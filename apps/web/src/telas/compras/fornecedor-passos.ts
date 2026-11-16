import { normalizarCelular, normalizarCnpj } from '@ailow/shared/puro';

// Mesmo limite do contrato (NOME_FORNECEDOR_MAX em compras.ts, que não está no ponto de entrada puro).
const NOME_FORNECEDOR_MAX = 80;

// S13: regras de cada passo do assistente de fornecedor (novo e editar). Mensagem devolvida = toast.
// Celular e CNPJ usam as mesmas funções do contrato da API.

export type PassoFornecedor = 'nome' | 'contato' | 'confirmar';
export const PASSOS_FORNECEDOR: PassoFornecedor[] = ['nome', 'contato', 'confirmar'];

export interface RascunhoFornecedor {
  nome: string;
  whatsapp: string;
  /** Opcional: vazio = sem CNPJ. */
  cnpj: string;
}

const PROBLEMAS: Record<Exclude<PassoFornecedor, 'confirmar'>, (r: RascunhoFornecedor) => string | null> = {
  nome: (r) => {
    if (r.nome.trim() === '') return 'Escreva o nome do fornecedor.';
    if (r.nome.trim().length > NOME_FORNECEDOR_MAX) return `O nome vai até ${NOME_FORNECEDOR_MAX} letras.`;
    return null;
  },
  contato: (r) => {
    if (r.whatsapp.trim() === '') return 'Escreva o WhatsApp do fornecedor.';
    if (normalizarCelular(r.whatsapp) === null) return 'Escreva o WhatsApp com DDD e 9 dígitos, por exemplo (11) 91234-5678.';
    if (r.cnpj.trim() !== '' && normalizarCnpj(r.cnpj) === null) return 'CNPJ com 14 dígitos, ex.: 12.345.678/0001-95.';
    return null;
  },
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPassoFornecedor(passo: PassoFornecedor, r: RascunhoFornecedor): string | null {
  if (passo !== 'confirmar') return PROBLEMAS[passo](r);
  return PROBLEMAS.nome(r) ?? PROBLEMAS.contato(r);
}

/** Corpo do POST/PUT /fornecedores, ou null se o rascunho ainda tem problema. */
export function fornecedorParaApi(r: RascunhoFornecedor): { nome: string; whatsapp: string; cnpj: string | null } | null {
  if (validarPassoFornecedor('confirmar', r) !== null) return null;
  return { nome: r.nome.trim(), whatsapp: r.whatsapp.trim(), cnpj: r.cnpj.trim() === '' ? null : r.cnpj.trim() };
}
