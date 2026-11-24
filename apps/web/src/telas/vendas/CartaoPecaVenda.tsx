import { ActionIcon, Badge, Box, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Valor } from '../../componentes';
import {
  corBadgeEstoque,
  estoqueBaixo,
  rotuloEstoqueVenda,
  tomEstoqueVenda,
} from './selo-estoque-venda';

export type PecaDoCard = {
  skuId: string;
  codigo: string;
  nome: string;
  detalhe: string;
  precoCentavos: number;
  estoque: number;
  estoqueMinimo?: number;
};

/**
 * Card de peça na Nova venda (V02): coluna direita = preço + stepper (−/qtd/+);
 * selo ok (teal), baixo (âmbar) ou zerado (vermelho).
 */
export function CartaoPecaVenda(props: {
  peca: PecaDoCard;
  amostra?: string | null;
  qtdNoCarrinho: number;
  aoTocar: () => void;
  aoMudarQtd: (delta: number) => void;
}) {
  const { peca, amostra, qtdNoCarrinho, aoTocar, aoMudarQtd } = props;
  const tom = tomEstoqueVenda(peca.estoque, peca.estoqueMinimo);
  const baixo = estoqueBaixo(peca.estoque, peca.estoqueMinimo);
  const rotuloEstoque = rotuloEstoqueVenda(peca.estoque, peca.estoqueMinimo);

  return (
    <UnstyledButton
      onClick={aoTocar}
      className="ailow-cartao"
      data-toque="peca"
      style={{ minHeight: 48, padding: 12, textAlign: 'left', width: '100%' }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {amostra && (
          <Box
            data-amostra-cor
            aria-hidden
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              flexShrink: 0,
              marginTop: 4,
              background: amostra,
              border: '1px solid var(--ailow-borda)',
            }}
          />
        )}
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
            {peca.nome}
          </Text>
          <Text size="sm" c="dimmed">
            {peca.detalhe} · {peca.codigo}
          </Text>
          <Badge
            data-estoque
            data-tom={tom}
            color={corBadgeEstoque(tom)}
            variant="light"
            style={{ alignSelf: 'flex-start' }}
            leftSection={
              baixo ? <IconAlertTriangle size={12} aria-hidden data-alerta-estoque /> : undefined
            }
          >
            {rotuloEstoque}
          </Badge>
        </Stack>
        <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
          <Text fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            <Valor centavos={peca.precoCentavos} destaque />
          </Text>
          {qtdNoCarrinho > 0 && (
            <Group
              gap={4}
              wrap="nowrap"
              data-stepper-qtd
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <ActionIcon
                variant="default"
                size={40}
                aria-label={`Menos ${peca.nome}`}
                onClick={(e) => {
                  e.stopPropagation();
                  aoMudarQtd(-1);
                }}
              >
                −
              </ActionIcon>
              <Text w={28} ta="center" fw={700} data-qtd-carrinho>
                {qtdNoCarrinho}
              </Text>
              <ActionIcon
                variant="default"
                size={40}
                aria-label={`Mais ${peca.nome}`}
                onClick={(e) => {
                  e.stopPropagation();
                  aoMudarQtd(1);
                }}
              >
                +
              </ActionIcon>
            </Group>
          )}
        </Stack>
      </Group>
    </UnstyledButton>
  );
}
