import { useMemo, useState } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import type { Espelho } from '@ailow/shared';
import { formatarDuracao } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { formatarData, hojeEmSaoPaulo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { resumoRelatorio } from './historico-ponto';
import { MesNav } from './HistoricoPontos';

/** Relatório de pontos: horas por dia e total do mês, por pessoa (mesmos dados do espelho). O Vendedor vê só as suas. */
export function RelatorioPontos(props: { api: Api; dono: boolean }) {
  const [mes, setMes] = useState(`${hojeEmSaoPaulo().slice(0, 7)}-01`);
  return (
    <Stack gap="md">
      <MesNav mes={mes} aoMudar={setMes} />
      <Conteudo key={mes} api={props.api} mes={mes} dono={props.dono} />
    </Stack>
  );
}

function Conteudo(props: { api: Api; mes: string; dono: boolean }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.espelhoDePonto(props.mes));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Resumo espelho={carga.dados} dono={props.dono} />;
}

function Resumo(props: { espelho: Espelho; dono: boolean }) {
  const r = useMemo(() => resumoRelatorio(props.espelho), [props.espelho]);
  if (r.pessoas.length === 0) {
    return <EstadoVazio titulo="Nenhum ponto neste mês" texto="Quando alguém bater o ponto, as horas aparecem aqui." />;
  }
  return (
    <Stack gap="md">
      {props.dono && (
        <Group justify="space-between" wrap="nowrap" className="ailow-bloco" p="md" data-relatorio-total>
          <Text fw={650}>Total da equipe</Text>
          <Text fw={700} fz="lg">
            {formatarDuracao(r.total_segundos)}
          </Text>
        </Group>
      )}
      {r.pessoas.map((p) => (
        <Stack key={p.usuario_id} gap="xs" className="ailow-bloco" p="md" data-relatorio-pessoa>
          <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
            {p.nome}
          </Text>
          <Text size="sm" c="dimmed">
            Total no mês: <strong>{formatarDuracao(p.total_segundos)}</strong> · {p.dias_trabalhados}{' '}
            {p.dias_trabalhados === 1 ? 'dia' : 'dias'} trabalhados
          </Text>
          {p.dias.map((d) => (
            <Group
              key={d.data}
              justify="space-between"
              wrap="nowrap"
              py={6}
              data-relatorio-dia
              style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
            >
              <Text size="sm" fw={600}>
                {formatarData(d.data)}
              </Text>
              <Text size="sm">{d.em_aberto ? 'em aberto' : formatarDuracao(d.trabalhado_segundos)}</Text>
            </Group>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
