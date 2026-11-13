import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Divider, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { Lancamento, Relatorio as DadosRelatorio } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { type Periodo, deslocarPeriodo, hojeEmSaoPaulo, horaEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { formatarReais } from '../../lib/dinheiro';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { EstornarModal } from './Modais';
import { pagamentosDaVenda, rotuloForma, tituloLancamento } from './rotulos';

/** RF-FIN-05: entradas × saídas do dia ou do mês, por forma de pagamento e por categoria; no dia, o extrato com estorno. */
export function Relatorio({ api }: { api: Api }) {
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [data, setData] = useState(hoje);
  // Sobe a cada estorno para o relatório (totais, por forma, por categoria) buscar tudo de novo.
  const [versao, setVersao] = useState(0);

  const proximo = deslocarPeriodo(periodo, data, 1);
  const noFuturo = periodo === 'dia' ? proximo > hoje : proximo.slice(0, 7) > hoje.slice(0, 7);
  const noPresente = periodo === 'dia' ? data === hoje : data.slice(0, 7) === hoje.slice(0, 7);

  return (
    <Stack gap="md">
      <SegmentedControl
        fullWidth
        size="lg"
        value={periodo}
        onChange={(v) => setPeriodo(v as Periodo)}
        data={[
          { label: 'Dia', value: 'dia' },
          { label: 'Mês', value: 'mes' },
        ]}
        styles={{ label: { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
      />
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <ActionIcon
          variant="default"
          size={48}
          aria-label={periodo === 'dia' ? 'Dia anterior' : 'Mês anterior'}
          onClick={() => setData(deslocarPeriodo(periodo, data, -1))}
        >
          <IconChevronLeft />
        </ActionIcon>
        <Stack gap={0} align="center" style={{ flex: 1 }}>
          <Text fw={700} fz="lg" ta="center" aria-live="polite">
            {rotuloDoPeriodo(periodo, data)}
          </Text>
          {noPresente && (
            <Text size="sm" c="dimmed">
              {periodo === 'dia' ? 'Hoje' : 'Este mês'}
            </Text>
          )}
        </Stack>
        <ActionIcon
          variant="default"
          size={48}
          disabled={noFuturo}
          aria-label={periodo === 'dia' ? 'Próximo dia' : 'Próximo mês'}
          onClick={() => setData(proximo)}
        >
          <IconChevronRight />
        </ActionIcon>
      </Group>
      {!noPresente && (
        <Button h={48} variant="default" onClick={() => setData(hoje)}>
          {periodo === 'dia' ? 'Voltar para hoje' : 'Voltar para este mês'}
        </Button>
      )}

      {/* key: ao trocar de período ou de data — ou depois de um estorno — o conteúdo é remontado e busca de novo:
          os totais do topo mudam junto com a lista. */}
      <ConteudoRelatorio
        key={`${periodo}-${data}-${versao}`}
        api={api}
        periodo={periodo}
        data={data}
        aoEstornar={() => setVersao((v) => v + 1)}
      />
    </Stack>
  );
}

function ConteudoRelatorio(props: { api: Api; periodo: Periodo; data: string; aoEstornar: () => void }) {
  const { api, periodo, data } = props;
  const { carga, tentarDeNovo } = useCarregar(() => api.relatorio(periodo, data));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const r = carga.dados;
  const vazio = r.por_forma.length === 0;

  return (
    <Stack gap="lg">
      <Totais r={r} />
      {vazio && (
        <EstadoVazio
          titulo={periodo === 'dia' ? 'Nenhum movimento neste dia' : 'Nenhum movimento neste mês'}
          texto="Aqui aparece o que entrou e saiu do caixa: vendas, compras e despesas pagas."
        />
      )}
      {!vazio && (
        <>
          <Quebra titulo="Por forma de pagamento" linhas={r.por_forma.map((f) => ({ nome: rotuloForma(f.forma_pagamento), ...f }))} />
          <Quebra titulo="Por categoria" linhas={r.por_categoria.map((c) => ({ nome: c.categoria, ...c }))} />
        </>
      )}
      {periodo === 'dia' && <ExtratoDoDia api={api} data={data} aoEstornar={props.aoEstornar} />}
    </Stack>
  );
}

function Totais({ r }: { r: DadosRelatorio }) {
  return (
    <Stack gap="sm" p="md" className="ailow-cartao" component="section" aria-label="Totais">
      <Group justify="space-between" wrap="nowrap">
        <Text>Entrou</Text>
        <Text fw={650}>
          <Valor centavos={r.entradas_centavos} />
        </Text>
      </Group>
      <Group justify="space-between" wrap="nowrap">
        <Text>Saiu</Text>
        <Text fw={650}>
          <Valor centavos={r.saidas_centavos} />
        </Text>
      </Group>
      <Divider />
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} fz="lg">
          Saldo
        </Text>
        <Text fz={26} fw={700} c="var(--ailow-marca-texto)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatarReais(r.saldo_centavos)}
        </Text>
      </Group>
    </Stack>
  );
}

function Quebra(props: {
  titulo: string;
  linhas: { nome: string; entradas_centavos: number; saidas_centavos: number }[];
}) {
  return (
    <Stack gap="sm" component="section" aria-label={props.titulo}>
      <Text fw={700} fz="lg">
        {props.titulo}
      </Text>
      {props.linhas.map((l) => (
        <Stack key={l.nome} gap={4} p="md" className="ailow-cartao">
          <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
            {l.nome}
          </Text>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm" c="dimmed">
              Entrou
            </Text>
            <Valor centavos={l.entradas_centavos} />
          </Group>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm" c="dimmed">
              Saiu
            </Text>
            <Valor centavos={l.saidas_centavos} />
          </Group>
        </Stack>
      ))}
    </Stack>
  );
}

// O que o modal de estorno mostra: uma venda é estornada inteira (todos os pagamentos dela); o resto, um a um.
function alvoDoEstorno(l: Lancamento, lancamentos: Lancamento[]) {
  if (l.origem_tipo === 'venda' && l.origem_id) {
    const pagamentos = pagamentosDaVenda(lancamentos, l.origem_id);
    return {
      titulo: 'Estornar esta venda?',
      alvo: {
        id: l.id,
        descricao: 'Venda',
        valor_centavos: pagamentos.reduce((total, p) => total + p.valor_centavos, 0),
      },
      venda: { id: l.origem_id, pagamentos: pagamentos.length },
    };
  }
  return {
    titulo: 'Estornar este lançamento?',
    alvo: { id: l.id, descricao: tituloLancamento(l), valor_centavos: l.valor_centavos },
  };
}

function ExtratoDoDia({ api, data, aoEstornar }: { api: Api; data: string; aoEstornar: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => api.extrato(data));
  const [estornando, setEstornando] = useState<Lancamento | null>(null);

  if (carga.fase === 'carregando') return <Carregando linhas={2} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { lancamentos } = carga.dados;
  if (lancamentos.length === 0) return null;

  return (
    <Stack gap="sm" component="section" aria-label="Lançamentos do dia">
      <Text fw={700} fz="lg">
        Lançamentos do dia
      </Text>
      {lancamentos.map((l) => {
        const podeEstornar = l.status === 'pago' && l.origem_tipo !== 'estorno';
        return (
          <Stack key={l.id} gap="xs" p="md" className="ailow-cartao">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Text fw={650} style={{ overflowWrap: 'anywhere', flex: 1 }}>
                {tituloLancamento(l)}
              </Text>
              {/* O sentido é dito pelo sinal, não só pela cor. */}
              <Text fw={650} style={{ whiteSpace: 'nowrap' }}>
                {l.tipo === 'entrada' ? '+ ' : '− '}
                <Valor centavos={l.valor_centavos} />
              </Text>
            </Group>
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              {l.pago_em ? `${horaEmSaoPaulo(l.pago_em)} · ` : ''}
              {l.forma_pagamento ? rotuloForma(l.forma_pagamento) : ''}
              {l.categoria ? ` · ${l.categoria}` : ''}
            </Text>
            {l.estorno_motivo && (
              <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                Motivo: {l.estorno_motivo}
              </Text>
            )}
            {l.status === 'estornado' && (
              <Badge color="gray" variant="light" w="fit-content">
                Estornado
              </Badge>
            )}
            {podeEstornar && (
              <Button
                h={48}
                variant="default"
                onClick={() => setEstornando(l)}
                aria-label={`${l.origem_tipo === 'venda' ? 'Estornar venda' : 'Estornar'} ${tituloLancamento(l)}`}
              >
                {/* Uma venda se estorna inteira (RN-08): o botão diz isso. */}
                {l.origem_tipo === 'venda' ? 'Estornar venda' : 'Estornar'}
              </Button>
            )}
          </Stack>
        );
      })}
      {estornando && (
        <EstornarModal
          api={api}
          {...alvoDoEstorno(estornando, lancamentos)}
          aoFechar={() => setEstornando(null)}
          aoEstornado={() => {
            setEstornando(null);
            aoEstornar();
          }}
        />
      )}
    </Stack>
  );
}
