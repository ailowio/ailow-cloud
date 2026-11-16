import { normalizarCelular } from '@ailow/shared/puro';

// S13: regras de cada passo do assistente "Novo cliente". Funções puras: a mensagem devolvida vira toast.
// Reaproveita a regra do celular do contrato (normalizarCelular), sem duplicá-la.

export type PassoCliente = 'nome' | 'celular' | 'aviso' | 'confirmar';
export const PASSOS_CLIENTE: PassoCliente[] = ['nome', 'celular', 'aviso', 'confirmar'];

export interface RascunhoCliente {
  nome: string;
  /** Como a pessoa digitou (com ou sem máscara). */
  celular: string;
  aviso: boolean;
}

const MSG_CELULAR = 'Escreva o celular com DDD e 9 dígitos, por exemplo (21) 98888-0001.';

const PROBLEMAS: Record<Exclude<PassoCliente, 'confirmar'>, (r: RascunhoCliente) => string | null> = {
  nome: (r) => (r.nome.trim() === '' ? 'Escreva o nome do cliente.' : null),
  celular: (r) => {
    if (r.celular.trim() === '') return 'Escreva o celular do cliente.';
    return normalizarCelular(r.celular) === null ? MSG_CELULAR : null;
  },
  aviso: () => null,
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPassoCliente(passo: PassoCliente, r: RascunhoCliente): string | null {
  if (passo !== 'confirmar') return PROBLEMAS[passo](r);
  for (const p of ['nome', 'celular', 'aviso'] as const) {
    const m = PROBLEMAS[p](r);
    if (m) return m;
  }
  return null;
}

/** Corpo do POST /clientes, ou null se o rascunho ainda tem problema. */
export function clienteParaApi(r: RascunhoCliente): { nome: string; celular: string; aviso_lgpd: boolean } | null {
  if (validarPassoCliente('confirmar', r) !== null) return null;
  return { nome: r.nome.trim(), celular: r.celular, aviso_lgpd: r.aviso };
}
