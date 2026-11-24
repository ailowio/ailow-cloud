import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import type { Produto } from '@ailow/shared';
import { Valor } from '../../componentes';
import { rotuloPorte } from './rotulos';

/** Tocar no cartão abre o pop-up de detalhe do produto (UXM-10); as variações ficam lá. */
export function CartaoProduto(props: { produto: Produto; dono: boolean; aoAbrir: () => void }) {
  const { produto: p } = props;
  const pecas = p.skus.reduce((soma, s) => soma + s.estoque, 0);

  return (
    <UnstyledButton className="ailow-cartao" onClick={props.aoAbrir} aria-haspopup="dialog" p="md" w="100%" mih={48} ta="left">
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {p.nome}
          </Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {p.categoria_nome} · {rotuloPorte(p.porte)} · nº {String(p.numero).padStart(4, '0')}
          </Text>
          <Group gap="sm">
            <Text fz="lg">
              <Valor centavos={p.preco_centavos} destaque />
            </Text>
            {props.dono && p.custo_centavos !== undefined && (
              <Text size="sm" c="dimmed">
                custo <Valor centavos={p.custo_centavos} />
              </Text>
            )}
          </Group>
          <Text size="sm">
            {pecas} {pecas === 1 ? 'peça' : 'peças'} · {p.skus.length} {p.skus.length === 1 ? 'variação' : 'variações'}
          </Text>
        </Stack>
        <IconChevronRight aria-hidden />
      </Group>
    </UnstyledButton>
  );
}
