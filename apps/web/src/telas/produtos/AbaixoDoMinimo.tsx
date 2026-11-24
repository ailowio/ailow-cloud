import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import type { SkuAberto } from './SkuFolha';
import { linhaDoAlerta, tituloDoAlerta } from './rotulos';

export function AbaixoDoMinimo(props: { api: Api; aoAbrir: (s: SkuAberto) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.alertasEstoque());
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { total, itens } = carga.dados;
  if (total === 0) {
    return <EstadoVazio titulo="Tudo certo" texto="Nenhuma peça está abaixo do mínimo que você definiu." />;
  }
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color="red" size="lg">
          {tituloDoAlerta(total)}
        </Badge>
      </Group>
      {itens.map((i) => (
        <UnstyledButton
          key={i.sku_id}
          className="ailow-bloco"
          mih={56}
          p="sm"
          w="100%"
          onClick={() =>
            props.aoAbrir({ id: i.sku_id, codigo: i.codigo, produto: i.produto, tamanho: i.tamanho, cor: i.cor, estoque: i.estoque, estoque_minimo: i.estoque_minimo })
          }
        >
          <Stack gap={2}>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {linhaDoAlerta(i)}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {i.codigo}
            </Text>
          </Stack>
        </UnstyledButton>
      ))}
      {total > itens.length && <Text size="sm" c="dimmed">Mostrando os {itens.length} mais urgentes de {total}.</Text>}
    </Stack>
  );
}
