// Regras puras de Pessoas (S12, RF-PES-01/02). Sem Zod: o app web usa estas funções por `@ailow/shared/puro`.

export type TipoPonto = 'entrada' | 'saida';

/** Toque duplo no celular: duas batidas em menos que isto são recusadas (a segunda não é gravada). */
export const INTERVALO_MINIMO_SEGUNDOS = 30;

/** Tamanho máximo do motivo de um ajuste do Dono (RF-PES-03). */
export const MOTIVO_AJUSTE_MAX = 200;

const FUSO = 'America/Sao_Paulo';
// 'en-CA' devolve AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface Marca {
  id: string;
  tipo: TipoPonto;
  registrado_em: string; // instante ISO
  ajustado: boolean; // criado ou mudado pelo Dono
}

export interface DiaDePonto {
  data: string; // AAAA-MM-DD, dia de São Paulo da ENTRADA
  marcas: Marca[];
  trabalhado_segundos: number;
  em_aberto: boolean; // há entrada sem saída: não conta horas
}

/** RF-PES-01: o botão alterna; a primeira batida de quem nunca bateu é entrada. */
export const proximoTipo = (ultimo: TipoPonto | null): TipoPonto => (ultimo === 'entrada' ? 'saida' : 'entrada');

export type ErroSequencia = 'comecar_com_entrada' | 'nao_alterna' | 'horario_repetido';

/**
 * RF-PES-03: depois de adicionar, editar ou excluir, as marcas ATIVAS de um usuário, em ordem de relógio, têm de
 * começar em entrada e alternar entrada/saída, sem dois registros no mesmo instante. Termina em entrada = "em aberto".
 */
export function sequenciaValida(
  marcas: { tipo: TipoPonto; registrado_em: string }[],
): { ok: true } | { ok: false; erro: ErroSequencia } {
  const ordem = [...marcas].sort((a, b) => Date.parse(a.registrado_em) - Date.parse(b.registrado_em));
  for (let i = 0; i < ordem.length; i++) {
    const m = ordem[i] as { tipo: TipoPonto; registrado_em: string };
    const anterior = ordem[i - 1];
    if (anterior && Date.parse(anterior.registrado_em) === Date.parse(m.registrado_em)) {
      return { ok: false, erro: 'horario_repetido' };
    }
    if (i === 0 && m.tipo !== 'entrada') return { ok: false, erro: 'comecar_com_entrada' };
    if (anterior && anterior.tipo === m.tipo) return { ok: false, erro: 'nao_alterna' };
  }
  return { ok: true };
}

/** 30600 -> "8h30". Minutos truncados (nunca soma o que não foi trabalhado). */
export function formatarDuracao(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}

/** Instante ISO -> dia "AAAA-MM-DD" no relógio de São Paulo. */
export const diaDoPonto = (iso: string): string => formatoDia.format(new Date(iso));

/**
 * RF-PES-02: agrupa as marcas por dia. As marcas já vêm alternando entrada/saída (garantido pelo banco);
 * cada par pertence ao dia da entrada, mesmo que a saída caia depois da meia-noite.
 */
export function montarDias(marcas: Marca[]): DiaDePonto[] {
  const ordem = [...marcas].sort((a, b) => Date.parse(a.registrado_em) - Date.parse(b.registrado_em));
  const porDia = new Map<string, DiaDePonto>();
  let atual: DiaDePonto | null = null;
  let entradaEm: number | null = null;

  for (const marca of ordem) {
    if (marca.tipo === 'entrada') {
      atual = porDia.get(diaDoPonto(marca.registrado_em)) ?? {
        data: diaDoPonto(marca.registrado_em),
        marcas: [],
        trabalhado_segundos: 0,
        em_aberto: false,
      };
      porDia.set(atual.data, atual);
      atual.marcas.push(marca);
      atual.em_aberto = true;
      entradaEm = Date.parse(marca.registrado_em);
    } else if (atual && entradaEm !== null) {
      atual.marcas.push(marca);
      atual.trabalhado_segundos += Math.round((Date.parse(marca.registrado_em) - entradaEm) / 1000);
      atual.em_aberto = false;
      entradaEm = null;
    }
    // Saída sem entrada anterior (não deveria existir): ignorada, não inventa horas.
  }
  return [...porDia.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
}
