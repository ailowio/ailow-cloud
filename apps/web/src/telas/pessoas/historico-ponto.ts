import type { Espelho } from '@ailow/shared';
import { diaDoPonto } from '@ailow/shared/puro';
import { filtrarPorBusca } from '../../lib/busca';
import { formatarData, horaEmSaoPaulo } from '../../lib/datas';

// Histórico e relatório de ponto: as duas telas leem o mesmo espelho do mês (GET /pontos/espelho).

export interface LinhaPonto {
  id: string;
  usuario_id: string;
  nome: string;
  tipo: 'entrada' | 'saida';
  registrado_em: string;
  ajustado: boolean;
  dia: string; // AAAA-MM-DD de São Paulo
  hora: string; // HH:MM de São Paulo
}

export const ROTULO_TIPO_PONTO = { entrada: 'Entrada', saida: 'Saída' } as const;

/** Todas as marcas do mês, da mais nova para a mais antiga. */
export function linhasDoHistorico(e: Espelho): LinhaPonto[] {
  const linhas: LinhaPonto[] = [];
  for (const u of e.usuarios) {
    for (const d of u.dias) {
      for (const m of d.marcas) {
        linhas.push({
          id: m.id,
          usuario_id: u.usuario_id,
          nome: u.nome,
          tipo: m.tipo,
          registrado_em: m.registrado_em,
          ajustado: m.ajustado,
          dia: diaDoPonto(m.registrado_em),
          hora: horaEmSaoPaulo(m.registrado_em),
        });
      }
    }
  }
  return linhas.sort((a, b) => Date.parse(b.registrado_em) - Date.parse(a.registrado_em) || b.id.localeCompare(a.id));
}

/** Busca por nome, tipo, data (dd/mm/aaaa) e hora, sem acento e com termos soltos. */
export function filtrarHistorico(linhas: readonly LinhaPonto[], consulta: string): LinhaPonto[] {
  return filtrarPorBusca(linhas, consulta, (l) => ({
    textos: [l.nome, ROTULO_TIPO_PONTO[l.tipo], formatarData(l.dia), l.hora, ...(l.ajustado ? ['ajustado'] : [])],
  }));
}

export interface DiaDoRelatorio {
  data: string;
  trabalhado_segundos: number;
  em_aberto: boolean;
}
export interface PessoaDoRelatorio {
  usuario_id: string;
  nome: string;
  total_segundos: number;
  dias_trabalhados: number;
  dias: DiaDoRelatorio[];
}

/** Horas por dia e por pessoa; dia em aberto (entrada sem saída) não conta como trabalhado. */
export function resumoRelatorio(e: Espelho): { total_segundos: number; pessoas: PessoaDoRelatorio[] } {
  const pessoas = e.usuarios.map((u) => ({
    usuario_id: u.usuario_id,
    nome: u.nome,
    total_segundos: u.total_segundos,
    dias_trabalhados: u.dias.filter((d) => !d.em_aberto && d.trabalhado_segundos > 0).length,
    dias: u.dias.map((d) => ({ data: d.data, trabalhado_segundos: d.trabalhado_segundos, em_aberto: d.em_aberto })),
  }));
  return { total_segundos: pessoas.reduce((s, p) => s + p.total_segundos, 0), pessoas };
}
