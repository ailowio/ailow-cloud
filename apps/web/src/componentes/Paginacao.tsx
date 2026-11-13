import { useState } from 'react';
import { Box, Button, Group, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { paginar } from '../lib/paginar';

/**
 * Estado da página. A página volta a 1 sempre que `itens` muda de identidade (ex.: nova busca); quem chama deve
 * passar uma lista memorizada (`useMemo`) para não reiniciar a cada render.
 */
export function usePaginacao<T>(itens: readonly T[], tamanho: number) {
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState(itens);
  if (lista !== itens) {
    setLista(itens);
    setPagina(1);
  }
  const p = paginar(itens, pagina, tamanho);
  return { ...p, irPara: setPagina };
}

/**
 * "Anterior / Página X de Y / Próxima", fixa embaixo (UXM-01) com alvos de 48 px (UXM-03). Some quando cabe numa página.
 */
export function Paginacao(props: { pagina: number; totalPaginas: number; aoMudar: (pagina: number) => void }) {
  if (props.totalPaginas <= 1) return null;
  return (
    <Box
      component="nav"
      aria-label="Paginação"
      pos="sticky"
      bottom={0}
      py="xs"
      style={{ background: 'var(--mantine-color-body)', borderTop: '1px solid var(--ailow-borda)', zIndex: 2 }}
    >
      {/* A 360 px os 3 itens têm de caber: botões do tamanho do conteúdo (flex 0 0 auto), texto da página numa
          linha só e com a sobra da linha (UXM-11). */}
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
    </Box>
  );
}
