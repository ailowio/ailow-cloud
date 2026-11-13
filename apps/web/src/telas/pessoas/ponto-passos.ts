import type { AjusteNovo } from '@ailow/shared';

// Passos do assistente "Adicionar ponto" (RF-PES-03): pessoa → quando (tipo, dia e hora) → motivo → confirmar.
export const PASSOS_PONTO = ['pessoa', 'quando', 'motivo', 'confirmar'] as const;
export type PassoPonto = (typeof PASSOS_PONTO)[number];

export interface RascunhoPonto {
  pessoa: string;
  tipo: 'entrada' | 'saida';
  data: string; // AAAA-MM-DD (São Paulo)
  hora: string; // HH:MM (São Paulo)
  motivo: string;
}

/** O "agora" de São Paulo, injetado para o teste não depender do relógio. */
export interface AgoraSP {
  hoje: string;
  hora: string;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Primeiro problema do passo (texto para o toast) ou null. O servidor revalida (futuro, sequência) e manda a palavra final. */
export function validarPassoPonto(passo: PassoPonto, r: RascunhoPonto, agora: AgoraSP): string | null {
  switch (passo) {
    case 'pessoa':
      return r.pessoa === '' ? 'Escolha a pessoa.' : null;
    case 'quando': {
      if (r.data === '') return 'Informe o dia.';
      if (!HORA.test(r.hora)) return 'Informe a hora no formato HH:MM.';
      if (r.data > agora.hoje || (r.data === agora.hoje && r.hora > agora.hora)) {
        return 'Não dá para registrar um horário que ainda não chegou.';
      }
      return null;
    }
    case 'motivo':
      return r.motivo.trim() === '' ? 'Conte o motivo do ajuste.' : null;
    case 'confirmar':
      return (
        validarPassoPonto('pessoa', r, agora) ?? validarPassoPonto('quando', r, agora) ?? validarPassoPonto('motivo', r, agora)
      );
  }
}

export function pontoParaApi(r: RascunhoPonto, agora: AgoraSP): AjusteNovo | null {
  if (validarPassoPonto('confirmar', r, agora)) return null;
  return { usuario_id: r.pessoa, tipo: r.tipo, data: r.data, hora: r.hora, motivo: r.motivo.trim() };
}
