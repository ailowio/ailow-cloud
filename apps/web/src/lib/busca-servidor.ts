// Busca em listas que o servidor corta em 200 (`truncado`): a tela filtra o que já carregou (busca ampla, caracteres
// soltos) e, só quando a lista foi cortada, pergunta ao servidor (`?q=`, pedaço contínuo do nome/código/preço) e une
// os dois. Funções puras; o efeito de rede fica em `useBuscaNoServidor`.
import { type CamposBusca, filtrarPorBusca, normalizarBusca } from './busca';

/** Termos de 1 caractere casariam quase tudo no servidor: só consulta a partir de 2. */
const TERMO_MINIMO_NO_SERVIDOR = 2;

export const AVISO_CORTE = 'Mostrando os primeiros 200; refine a busca.';

/** Mostra o aviso de corte? Sem busca: se a lista veio cortada. Com busca: só se a resposta do servidor também veio. */
export function avisoDeCorte(listaCortada: boolean, consulta: string, servidorCortado: boolean): boolean {
  if (!listaCortada) return false;
  return normalizarBusca(consulta) === '' ? true : servidorCortado;
}

/**
 * O que mandar em `?q=`: o servidor só entende UM pedaço contínuo, então vai o termo mais longo (empate: o primeiro).
 * Os demais termos e os caracteres soltos são aplicados depois, no cliente, sobre o que voltar.
 */
export function termoParaServidor(consulta: string): string | null {
  const termos = normalizarBusca(consulta).split(/\s+/).filter(Boolean);
  let melhor: string | null = null;
  for (const t of termos) {
    if (t.length >= TERMO_MINIMO_NO_SERVIDOR && (melhor === null || t.length > melhor.length)) melhor = t;
  }
  return melhor;
}

/**
 * Une a lista já carregada com o que o servidor achou. Sem repetir (mesmo `chave` → vale o dado do servidor, mais
 * novo); ordem por relevância da busca ampla, com o servidor na frente em caso de empate. Com um termo só o servidor
 * tem a palavra final (a faixa de preço "89" dele é mais larga que a local): o que a busca local não casou vai ao fim.
 * Com vários termos o resultado do servidor passa pelo filtro completo, senão traria itens que casam só um termo.
 */
export function mesclarBusca<T>(
  locais: readonly T[],
  servidor: readonly T[],
  consulta: string,
  campos: (item: T) => CamposBusca,
  chave: (item: T) => string,
): T[] {
  if (normalizarBusca(consulta) === '') return [...locais];
  const vistos = new Set<string>();
  const uniao: T[] = [];
  for (const item of [...servidor, ...locais]) {
    const k = chave(item);
    if (vistos.has(k)) continue;
    vistos.add(k);
    uniao.push(item);
  }
  const casados = filtrarPorBusca(uniao, consulta, campos);
  const umTermo = normalizarBusca(consulta).split(/\s+/).filter(Boolean).length === 1;
  if (!umTermo) return casados;
  const jaTem = new Set(casados.map(chave));
  return [...casados, ...servidor.filter((s) => !jaTem.has(chave(s)))].filter(
    // O servidor pode repetir um item que veio também da lista local: `uniao` já desduplicou, aqui só o resto.
    (item, i, todos) => todos.findIndex((o) => chave(o) === chave(item)) === i,
  );
}
