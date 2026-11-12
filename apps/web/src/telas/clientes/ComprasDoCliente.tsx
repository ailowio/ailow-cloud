import { Stack, Text } from '@mantine/core';
import { formatarData } from '../../lib/datas';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';

/** RF-CLI-02: o histórico de compras da ficha, do mais recente para o mais antigo. */
export function ComprasDoCliente(props: { api: Api; clienteId: string }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.comprasDoCliente(props.clienteId));
  return (
    <Stack gap="xs" className="ailow-cartao" p="md">
      <Text fw={650} fz="lg">
        Compras
      </Text>
      {carga.fase === 'carregando' && <Carregando linhas={2} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.compras.length === 0 && (
        <Text c="dimmed" size="sm">
          Nenhuma compra registrada ainda.
        </Text>
      )}
      {carga.fase === 'pronto' &&
        carga.dados.compras.map((c) => (
          <Text key={c.id} style={{ overflowWrap: 'anywhere' }}>
            Venda {c.numero} · {formatarData(c.criado_em.slice(0, 10))} · <Valor centavos={c.total_centavos} />
            {c.status === 'cancelada' ? ' · cancelada' : ''}
          </Text>
        ))}
    </Stack>
  );
}
