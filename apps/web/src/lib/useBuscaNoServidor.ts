import { useEffect, useState } from 'react';
import { avisarErro } from './avisos';
import { termoParaServidor } from './busca-servidor';

/** Espera a pessoa parar de digitar (300 ms) para não chamar a API a cada letra. */
export function useTextoComEspera(texto: string, esperaMs = 300): string {
  const [valor, setValor] = useState(texto.trim());
  useEffect(() => {
    const t = setTimeout(() => setValor(texto.trim()), esperaMs);
    return () => clearTimeout(t);
  }, [texto, esperaMs]);
  return valor;
}

interface Achados<T> {
  termo: string;
  itens: readonly T[];
  truncado: boolean;
}
const NADA: readonly never[] = [];

/**
 * Quando a lista carregada foi cortada pelo servidor (`listaCortada`), consulta o servidor pelo termo mais longo da
 * busca (`?q=`). Devolve só o que o servidor achou; quem chama une com a lista local (`mesclarBusca`). Se a rede falhar,
 * devolve vazio (a lista local continua valendo) e avisa com um toast. `buscar` só é lida na hora de consultar.
 */
export function useBuscaNoServidor<T>(
  listaCortada: boolean,
  consulta: string,
  buscar: (termo: string) => Promise<{ itens: readonly T[]; truncado: boolean }>,
  /** Muda quando a lista carregada é recarregada: a consulta é refeita para não mostrar dado velho do servidor. */
  versao: unknown = null,
): { itens: readonly T[]; truncado: boolean } {
  const termo = listaCortada ? termoParaServidor(consulta) : null;
  const [achados, setAchados] = useState<Achados<T> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `buscar` muda a cada render; o gatilho é o termo.
  useEffect(() => {
    if (termo === null) return;
    let ativo = true;
    buscar(termo)
      .then((r) => {
        if (ativo) setAchados({ termo, itens: r.itens, truncado: r.truncado });
      })
      .catch(() => {
        if (!ativo) return;
        setAchados({ termo, itens: NADA, truncado: false });
        avisarErro('Não consegui buscar no servidor. Mostrando só o que já está carregado.');
      });
    return () => {
      ativo = false;
    };
  }, [termo, versao]);

  // Resultado de outro termo (ainda chegando) não vale.
  if (termo === null || achados === null || achados.termo !== termo) return { itens: NADA, truncado: false };
  return { itens: achados.itens, truncado: achados.truncado };
}
