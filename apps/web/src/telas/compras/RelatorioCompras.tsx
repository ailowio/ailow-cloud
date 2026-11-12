import { useMemo, useState } from 'react';
import { Button, SimpleGrid, Stack, Text } from '@mantine/core';
import type { RelatorioCompras as Dados } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { deslocarPeriodo, hojeEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';

/** RF-COM-05: compras recebidas do mês, por fornecedor. */
export function RelatorioCompras(props: { api: Api }) {
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const [data, setData] = useState(`${hoje.slice(0, 7)}-01`);
  const proximo = deslocarPeriodo('mes', data, 1);
  const noFuturo = proximo.slice(0, 7) > hoje.slice(0, 7);

  return (
    <Stack gap="md">
      <SimpleGrid cols={2} spacing="xs">
        <Button h={48} variant="default" onClick={() => setData(deslocarPeriodo('mes', data, -1))}>
          Anterior
        </Button>
        <Button h={48} variant="default" disabled={noFuturo} onClick={() => setData(proximo)}>
          Próximo
        </Button>
      </SimpleGrid>
      <Text fw={650}>{rotuloDoPeriodo('mes', data)}</Text>
      <Conteudo key={data} api={props.api} data={data} />
    </Stack>
  );
}

function Conteudo(props: { api: Api; data: string }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.relatorioCompras(props.data));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Numeros dados={carga.dados} />;
}

function Numeros(props: { dados: Dados }) {
  const d = props.dados;
  if (d.pedidos === 0) {
    return <EstadoVazio titulo="Nenhuma compra neste mês" texto="Quando um pedido for recebido, ele aparece aqui." />;
  }
  return (
    <Stack gap="sm">
      <Text fz="xl" fw={700}>
        {d.pedidos} {d.pedidos === 1 ? 'pedido' : 'pedidos'} · <Valor centavos={d.total_centavos} destaque />
      </Text>
      {d.por_fornecedor.map((f) => (
        <Stack key={f.fornecedor_id} gap={2} className="ailow-bloco" p="md">
          <Text fw={650}>{f.nome}</Text>
          <Text size="sm" c="dimmed">
            {f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'} · <Valor centavos={f.total_centavos} />
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}
