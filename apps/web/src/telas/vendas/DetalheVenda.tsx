import { useState } from 'react';
import { Badge, Box, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconBan } from '@tabler/icons-react';
import type { Venda } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Modal } from '../../componentes/navegacao';
import { formatarData, hojeEmSaoPaulo, horaEmSaoPaulo } from '../../lib/datas';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { ROTULOS_FORMA, mensagemVenda } from './rotulos';

/**
 * Modal de detalhe da venda (UXM-10, S08): nº, cliente, data/hora, itens, total, pagamentos e status; as ações
 * vêm em GradeAcoes. Só "Cancelar venda" existe porque é o que a API suporta (devolve estoque e estorna o caixa;
 * nada é apagado). "Editar venda" não tem endpoint: ver docs/adr/012-editar-venda.md.
 */
export function DetalheVenda(props: { api: Api; id: string | null; aoFechar: () => void; aoMudar: () => void }) {
  return (
    <Modal opened={props.id !== null} onClose={props.aoFechar} title="Detalhe da venda" closeButtonProps={fecharModal}>
      {props.id && <Corpo key={props.id} api={props.api} id={props.id} aoMudar={props.aoMudar} />}
    </Modal>
  );
}

function Corpo(props: { api: Api; id: string; aoMudar: () => void }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.venda(props.id));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return (
    <Folha
      api={props.api}
      venda={carga.dados}
      aoCancelada={() => {
        void recarregar();
        props.aoMudar();
      }}
    />
  );
}

function Folha(props: { api: Api; venda: Venda; aoCancelada: () => void }) {
  const v = props.venda;
  const { pendente, rodar } = useAcao(mensagemVenda);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState('');

  async function cancelar() {
    if (motivo.trim().length < 3) return;
    if (await rodar(() => props.api.cancelarVenda(v.id, motivo.trim()), 'Venda cancelada')) {
      setConfirmando(false);
      props.aoCancelada();
    }
  }

  return (
    <Stack gap="md" data-detalhe-venda={v.numero}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={700} fz="xl">
          Venda {v.numero}
        </Text>
        {v.status === 'cancelada' ? <Badge color="red">Cancelada</Badge> : <Badge color="teal">Finalizada</Badge>}
      </Group>
      <Stack gap={2}>
        <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
          {v.cliente ? v.cliente.nome : 'Sem cliente'}
        </Text>
        <Text c="dimmed" fz="sm">
          {formatarData(hojeEmSaoPaulo(new Date(v.criado_em)))} às {horaEmSaoPaulo(v.criado_em)} · {v.vendedor_nome}
        </Text>
        {v.status === 'cancelada' && (
          <Text c="red" fz="sm" style={{ overflowWrap: 'anywhere' }}>
            Motivo: {v.motivo_cancelamento}
          </Text>
        )}
      </Stack>

      <Box className="ailow-cartao" data-itens-venda="">
        {v.itens.map((i) => (
          <Box key={i.sku_id} p="sm" style={{ borderBottom: '1px solid var(--ailow-borda)' }} data-item-venda={i.codigo}>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {i.nome}
            </Text>
            <Text c="dimmed" fz="sm" style={{ overflowWrap: 'anywhere' }}>
              {i.codigo} · {i.tamanho} · {i.cor}
            </Text>
            <Text fz="sm">
              {i.quantidade} × <Valor centavos={i.preco_unitario_centavos} /> = <Valor centavos={i.preco_unitario_centavos * i.quantidade} />
            </Text>
          </Box>
        ))}
      </Box>

      <Stack gap={4}>
        {v.desconto_centavos > 0 && (
          <Text>
            Desconto <Valor centavos={v.desconto_centavos} />
          </Text>
        )}
        <Text fz="xl" fw={700} data-total-venda="">
          Total <Valor centavos={v.total_centavos} destaque />
        </Text>
        {v.pagamentos.map((p) => (
          <Text key={`${p.forma}-${p.valor_centavos}`}>
            {ROTULOS_FORMA[p.forma]} · <Valor centavos={p.valor_centavos} />
          </Text>
        ))}
      </Stack>

      {v.status === 'finalizada' && (
        <GradeAcoes
          acoes={[
            {
              id: 'cancelar-venda',
              rotulo: 'Cancelar venda',
              icone: <IconBan size={32} stroke={1.75} />,
              aoTocar: () => setConfirmando(true),
            },
          ]}
        />
      )}

      <Modal opened={confirmando} onClose={() => setConfirmando(false)} title="Cancelar esta venda" closeButtonProps={fecharModal}>
        <Stack gap="md">
          <Text>
            A venda {v.numero} será cancelada: o estoque volta e o dinheiro sai do caixa. Ela continua na lista, marcada
            como cancelada (nada é apagado).
          </Text>
          <TextInput size="lg" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} autoComplete="off" />
          <Button h={48} color="red" loading={pendente} disabled={motivo.trim().length < 3} onClick={() => void cancelar()}>
            Confirmar cancelamento
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
