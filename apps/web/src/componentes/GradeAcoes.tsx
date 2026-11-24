import type { ReactNode } from 'react';
import { Box, SimpleGrid, Text, UnstyledButton } from '@mantine/core';

export interface AcaoDaGrade {
  id: string;
  /** Texto curto embaixo do ícone (até ~14 caracteres cabem em uma linha; mais que isso quebra em duas). */
  rotulo: string;
  icone: ReactNode;
  aoTocar: () => void;
  desabilitado?: boolean;
  /** Nome falado pelo leitor de tela quando precisa ser mais completo que o rótulo curto. */
  descricao?: string;
  /** CTA preenchido com a cor de ação (ex.: Finalizar na venda). */
  destaque?: boolean;
}

/**
 * UXM-10: menu como grade de ícones, estilo home do iPhone.
 * Padrão 3 colunas (RNF-05); `densidade="compacta"` (V03: 2 fileiras na venda) usa tile menor para não empurrar a paginação.
 */
export function GradeAcoes({
  acoes,
  cols = 3,
  densidade = 'normal',
}: {
  acoes: AcaoDaGrade[];
  cols?: 2 | 3 | 4;
  densidade?: 'normal' | 'compacta';
}) {
  const compacta = densidade === 'compacta' || cols === 4;
  return (
    <Box data-grade-acoes="" data-cols={cols} data-densidade={densidade}>
      <SimpleGrid cols={cols} spacing={compacta ? 6 : 'sm'}>
        {acoes.map((a) => (
          <UnstyledButton
            key={a.id}
            className="ailow-acao-grade"
            aria-label={a.descricao ?? a.rotulo}
            disabled={a.desabilitado}
            onClick={a.aoTocar}
            data-desabilitado={a.desabilitado ? 'true' : 'false'}
            data-destaque={a.destaque ? 'true' : 'false'}
          >
            <Box className="ailow-acao-tile" aria-hidden>
              {a.icone}
            </Box>
            <Text fw={600} fz={compacta ? 12 : 13} lh={1.25} ta="center" lang="pt-BR" aria-hidden style={{ hyphens: 'auto', overflowWrap: 'break-word' }}>
              {a.rotulo}
            </Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Box>
  );
}
