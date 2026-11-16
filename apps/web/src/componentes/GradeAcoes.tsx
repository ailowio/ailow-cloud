import type { ReactNode } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { GradeModulos } from './index';

export interface AcaoDaGrade {
  id: string;
  /** Texto curto embaixo do ícone (até ~14 caracteres cabem em uma linha; mais que isso quebra em duas). */
  rotulo: string;
  icone: ReactNode;
  aoTocar: () => void;
  desabilitado?: boolean;
  /** Nome falado pelo leitor de tela quando precisa ser mais completo que o rótulo curto. */
  descricao?: string;
}

/**
 * UXM-10: menu como grade de ícones, estilo home do iPhone. 3 colunas, ícone num tile arredondado de 72 px e o
 * rótulo embaixo; o alvo de toque é o conjunto tile + rótulo. Reaproveita a grade fixa de 3 colunas (RNF-05).
 */
export function GradeAcoes({ acoes }: { acoes: AcaoDaGrade[] }) {
  return (
    <Box data-grade-acoes="">
      <GradeModulos>
        {acoes.map((a) => (
          <UnstyledButton
            key={a.id}
            className="ailow-acao-grade"
            aria-label={a.descricao ?? a.rotulo}
            disabled={a.desabilitado}
            onClick={a.aoTocar}
            data-desabilitado={a.desabilitado ? 'true' : 'false'}
          >
            <Box className="ailow-acao-tile" aria-hidden>
              {a.icone}
            </Box>
            <Text fw={600} fz={13} lh={1.25} ta="center" lang="pt-BR" aria-hidden style={{ hyphens: 'auto', overflowWrap: 'break-word' }}>
              {a.rotulo}
            </Text>
          </UnstyledButton>
        ))}
      </GradeModulos>
    </Box>
  );
}
