import { useState } from 'react';
import { Box, Button, Group, NativeSelect, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { paginar } from '../lib/paginar';

/**
 * Estado da página. A página volta a 1 sempre que `itens` muda de identidade (ex.: nova busca); quem chama deve
 * passar uma lista memorizada (`useMemo`) para não reiniciar a cada render.
 */
/**
 * Sem `busca`: a lista mudou ⇒ volta à página 1. Com `busca` (listas que o servidor pagina, ADR 016): só a BUSCA nova
 * volta à página 1; itens que chegam depois (resultado do servidor, "Carregar mais", recarga após editar) mantêm a
 * página em que a pessoa está (presa ao total). Antes, a resposta atrasada do servidor a jogava de volta à página 1.
 */
export function usePaginacao<T>(itens: readonly T[], tamanho: number, busca?: string) {
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(itens);
  const [buscaAnterior, setBuscaAnterior] = useState(busca);
  const [tamanhoAnterior, setTamanhoAnterior] = useState(tamanho);
  if (lista !== itens || buscaAnterior !== busca || tamanhoAnterior !== tamanho) {
    const manter = busca !== undefined && buscaAnterior === busca && tamanhoAnterior === tamanho;
    setLista(itens);
    setBuscaAnterior(busca);
    setTamanhoAnterior(tamanho);
    if (!manter) setPagina(1);
  }
  const p = paginar(itens, pagina, tamanho);
  return { ...p, irPara: setPagina };
}

export type ControlePorPagina = {
  valor: number;
  opcoes: readonly number[];
  aoMudar: (n: number) => void;
};

/**
 * "Anterior / Página X de Y / Próxima", fixa embaixo (UXM-01) com alvos de 48 px (UXM-03). Some quando cabe numa página
 * e não há seletor de tamanho. `porPagina` (opcional) fica junto à paginação.
 */
export function Paginacao(props: {
  pagina: number;
  totalPaginas: number;
  aoMudar: (pagina: number) => void;
  /** Empurra a barra sticky para cima (ex.: altura da barra do carrinho). */
  bottom?: number;
  porPagina?: ControlePorPagina;
}) {
  const temControle = props.porPagina !== undefined;
  if (props.totalPaginas <= 1 && !temControle) return null;
  const bottom = props.bottom ?? 0;
  return (
    <Box
      component="nav"
      aria-label="Paginação"
      pos="sticky"
      bottom={bottom}
      py="xs"
      style={{ background: 'var(--mantine-color-body)', borderTop: '1px solid var(--ailow-borda)', zIndex: 2 }}
    >
      {temControle && (
        <NativeSelect
          size="md"
          label="Por página"
          aria-label="Itens por página"
          data={props.porPagina!.opcoes.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(props.porPagina!.valor)}
          onChange={(e) => props.porPagina!.aoMudar(Number(e.currentTarget.value))}
          mb={props.totalPaginas > 1 ? 'xs' : 0}
        />
      )}
      {props.totalPaginas > 1 && (
        <Group wrap="nowrap" justify="space-between" gap={4}>
          <Button
            h={48}
            variant="default"
            px={8}
            fz="sm"
            style={{ flex: '0 0 auto' }}
            leftSection={<IconChevronLeft size={18} aria-hidden />}
            disabled={props.pagina <= 1}
            onClick={() => props.aoMudar(props.pagina - 1)}
          >
            Anterior
          </Button>
          <Text fw={600} fz="sm" ta="center" aria-live="polite" data-paginacao-texto style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }}>
            Página {props.pagina} de {props.totalPaginas}
          </Text>
          <Button
            h={48}
            variant="default"
            px={8}
            fz="sm"
            style={{ flex: '0 0 auto' }}
            rightSection={<IconChevronRight size={18} aria-hidden />}
            disabled={props.pagina >= props.totalPaginas}
            onClick={() => props.aoMudar(props.pagina + 1)}
          >
            Próxima
          </Button>
        </Group>
      )}
    </Box>
  );
}
