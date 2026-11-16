import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { avisarErro } from './avisos';

const NADA: readonly never[] = [];

/**
 * ADR 016: listas que o servidor entrega em páginas (cursor `proximo`). Junta a primeira página (já carregada por quem
 * chama) com as páginas pedidas em "Carregar mais". Quando a primeira página muda (recarregou), recomeça do zero.
 * Falha de rede: avisa em toast e mantém o que já foi carregado.
 */
export function useMaisPaginas<T>(
  primeira: { itens: readonly T[]; proximo: string | null } | null,
  buscarPagina: (depois: string) => Promise<{ itens: readonly T[]; proximo: string | null }>,
): { todos: readonly T[]; proximo: string | null; carregando: boolean; carregarMais: () => void } {
  const [extras, setExtras] = useState<readonly T[]>(NADA);
  const [proximo, setProximo] = useState<string | null>(primeira?.proximo ?? null);
  const [carregando, setCarregando] = useState(false);
  const buscar = useRef(buscarPagina);
  buscar.current = buscarPagina;
  // Identidade da primeira página: outra rodada de carga invalida as páginas extras (e uma resposta atrasada).
  const rodada = useRef(0);

  // Sem trocar o estado à toa: um array vazio NOVO mudaria a identidade de `todos` e a paginação voltaria à página 1
  // (a pessoa que já tocou em "Próxima" seria jogada de volta).
  useEffect(() => {
    rodada.current += 1;
    setExtras((x) => (x.length === 0 ? x : NADA));
    setProximo(primeira?.proximo ?? null);
    setCarregando(false);
  }, [primeira]);

  const carregarMais = useCallback(() => {
    if (!proximo || carregando) return;
    const minha = rodada.current;
    setCarregando(true);
    buscar
      .current(proximo)
      .then((p) => {
        if (minha !== rodada.current) return;
        setExtras((x) => [...x, ...p.itens]);
        setProximo(p.proximo);
      })
      .catch(() => {
        if (minha === rodada.current) avisarErro('Não consegui carregar mais. Tente de novo.');
      })
      .finally(() => {
        if (minha === rodada.current) setCarregando(false);
      });
  }, [proximo, carregando]);

  // Mesma referência enquanto nada muda: as listas usam `todos` em useMemo (filtro e paginação).
  const todos = useMemo(
    () => (primeira ? (extras.length === 0 ? primeira.itens : [...primeira.itens, ...extras]) : NADA),
    [primeira, extras],
  );
  return { todos: todos as readonly T[], proximo, carregando, carregarMais };
}
