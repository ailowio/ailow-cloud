import { useState } from 'react';
import { Badge, Box, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconBan, IconRefresh } from '@tabler/icons-react';
import type { Venda } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Modal } from '../../componentes/navegacao';
import { formatarData, hojeEmSaoPaulo, horaEmSaoPaulo } from '../../lib/datas';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import type { ItemVenda } from './carrinho';
import { itensParaRefazer } from './refazer';
import { ROTULOS_FORMA, mensagemVenda } from './rotulos';

/** Carrinho montado a partir de uma venda cancelada para refazer (ADR 014, opção 1). */
export interface Refazer {
  itens: ItemVenda[];
  faltando: string[];
  numeroCancelado: number;
  /** Celular do cliente da venda cancelada: o fechamento já abre com ele (null = venda sem cliente). */
  celular: string | null;
}

/**
 * Modal de detalhe da venda (UXM-10, S08): nº, cliente, data/hora, itens, total, pagamentos e status; as ações
 * vêm em GradeAcoes. "Cancelar venda" devolve estoque e estorna o caixa (nada é apagado). "Refazer venda" (ADR 014,
 * opção 1) cancela do mesmo jeito e devolve as peças para um carrinho novo: corrigir é refazer (o número muda).
 */
export function DetalheVenda(props: {
  api: Api;
  id: string | null;
  aoFechar: () => void;
  aoMudar: () => void;
  aoRefazer?: (r: Refazer) => void;
}) {
  return (
    <Modal opened={props.id !== null} onClose={props.aoFechar} title="Detalhe da venda" closeButtonProps={fecharModal}>
      {props.id && <Corpo key={props.id} api={props.api} id={props.id} aoMudar={props.aoMudar} aoRefazer={props.aoRefazer} />}
    </Modal>
  );
}

function Corpo(props: { api: Api; id: string; aoMudar: () => void; aoRefazer?: (r: Refazer) => void }) {
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
      aoRefazer={props.aoRefazer}
    />
  );
}

function Folha(props: { api: Api; venda: Venda; aoCancelada: () => void; aoRefazer?: (r: Refazer) => void }) {
  const v = props.venda;
  const { pendente, rodar } = useAcao(mensagemVenda);
  const [confirmando, setConfirmando] = useState<'cancelar' | 'refazer' | null>(null);
  const [motivo, setMotivo] = useState('');

  async function cancelar() {
    if (motivo.trim().length < 3) return;
    if (await rodar(() => props.api.cancelarVenda(v.id, motivo.trim()), 'Venda cancelada')) {
      setConfirmando(null);
      props.aoCancelada();
    }
  }

  // Refazer = cancelar (a API devolve o estoque e estorna o caixa) + montar o carrinho com as mesmas peças, já com o
  // preço e o estoque atuais. Se a busca das peças falhar, a venda já está cancelada: o app avisa e a pessoa monta à mão.
  async function refazer() {
    const aoRefazer = props.aoRefazer;
    if (motivo.trim().length < 3 || !aoRefazer) return;
    const ok = await rodar(() => props.api.cancelarVenda(v.id, motivo.trim()), `Venda ${v.numero} cancelada. Corrija o carrinho e feche de novo.`);
    if (!ok) return;
    const codigos = [...new Set(v.itens.map((i) => i.codigo))];
    const skus = await Promise.all(codigos.map((c) => props.api.skuPorCodigo(c).catch(() => null)));
    const r = itensParaRefazer(v, skus.filter((s) => s !== null));
    // Sem fechar os pop-ups aqui: fechar devolve a entrada do histórico (Voltar) DEPOIS da ida para o carrinho e a
    // tela voltaria ao relatório. Quem chama troca de tela (replace) e os pop-ups desmontam junto.
    aoRefazer({ ...r, numeroCancelado: v.numero, celular: v.cliente?.celular ?? null });
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
            ...(props.aoRefazer
              ? [
                  {
                    id: 'refazer-venda',
                    rotulo: 'Refazer venda',
                    icone: <IconRefresh size={32} stroke={1.75} />,
                    aoTocar: () => setConfirmando('refazer' as const),
                  },
                ]
              : []),
            {
              id: 'cancelar-venda',
              rotulo: 'Cancelar venda',
              icone: <IconBan size={32} stroke={1.75} />,
              aoTocar: () => setConfirmando('cancelar' as const),
            },
          ]}
        />
      )}

      <Modal
        opened={confirmando !== null}
        onClose={() => setConfirmando(null)}
        title={confirmando === 'refazer' ? 'Refazer esta venda' : 'Cancelar esta venda'}
        closeButtonProps={fecharModal}
      >
        <Stack gap="md">
          {confirmando === 'refazer' ? (
            <Text>
              A venda {v.numero} será cancelada (o estoque volta e o dinheiro sai do caixa) e as mesmas peças vão para um
              carrinho novo, para você corrigir e fechar de novo. A venda nova recebe outro número.
            </Text>
          ) : (
            <Text>
              A venda {v.numero} será cancelada: o estoque volta e o dinheiro sai do caixa. Ela continua na lista, marcada
              como cancelada (nada é apagado).
            </Text>
          )}
          <TextInput size="lg" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} autoComplete="off" />
          {confirmando === 'refazer' ? (
            <Button h={48} loading={pendente} disabled={motivo.trim().length < 3} onClick={() => void refazer()}>
              Cancelar e refazer
            </Button>
          ) : (
            <Button h={48} color="red" loading={pendente} disabled={motivo.trim().length < 3} onClick={() => void cancelar()}>
              Confirmar cancelamento
            </Button>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
