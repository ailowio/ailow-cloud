// S13: regras de cada passo do assistente "Dados da empresa". Mensagem devolvida = toast.
// O contrato da API (configuracoes.ts) aceita telefone com 10 ou 11 dígitos e inatividade inteira de 1 a 120.

export type PassoEmpresa = 'nome' | 'contato' | 'trava' | 'confirmar';
export const PASSOS_EMPRESA: PassoEmpresa[] = ['nome', 'contato', 'trava', 'confirmar'];

export interface RascunhoEmpresa {
  nome: string;
  /** Como a pessoa digitou; vazio = sem telefone. */
  telefone: string;
  endereco: string;
  /** Vem do NumberInput: número, ou texto vazio se apagado. */
  minutos: number | string;
}

const SO_TELEFONE = /^[0-9\s()+.-]+$/;

const PROBLEMAS: Record<Exclude<PassoEmpresa, 'confirmar'>, (r: RascunhoEmpresa) => string | null> = {
  nome: (r) => (r.nome.trim() === '' ? 'Escreva o nome da empresa.' : null),
  contato: (r) => {
    const t = r.telefone.trim();
    if (t === '') return null;
    const digitos = t.replace(/\D/g, '');
    return SO_TELEFONE.test(t) && /^\d{10,11}$/.test(digitos) ? null : 'Escreva o telefone com DDD, por exemplo (11) 98765-4321.';
  },
  trava: (r) => {
    const n = typeof r.minutos === 'number' ? r.minutos : r.minutos.trim() === '' ? Number.NaN : Number(r.minutos);
    return Number.isInteger(n) && n >= 1 && n <= 120 ? null : 'Escolha entre 1 e 120 minutos para travar o app.';
  },
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPassoEmpresa(passo: PassoEmpresa, r: RascunhoEmpresa): string | null {
  if (passo !== 'confirmar') return PROBLEMAS[passo](r);
  return PROBLEMAS.nome(r) ?? PROBLEMAS.contato(r) ?? PROBLEMAS.trava(r);
}

/** Campos que o assistente edita no PUT /empresa (o resto do cadastro é preservado pela tela), ou null se há problema. */
export function empresaParaApi(
  r: RascunhoEmpresa,
): { nome: string; telefone: string | null; endereco: string | null; inatividade_minutos: number } | null {
  if (validarPassoEmpresa('confirmar', r) !== null) return null;
  return {
    nome: r.nome.trim(),
    telefone: r.telefone.trim() === '' ? null : r.telefone.trim(),
    endereco: r.endereco.trim() === '' ? null : r.endereco.trim(),
    inatividade_minutos: Number(r.minutos),
  };
}
