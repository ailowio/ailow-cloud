import { useMemo, useState } from 'react';
import { Button, SimpleGrid, Stack, Text } from '@mantine/core';
import type { Perfil, RelatorioVendas as Dados } from '@ailow/shared';
import { mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { type Periodo, deslocarPeriodo, hojeEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { ROTULOS_FORMA } from './rotulos';

/** RF-VEN-09: dia ou mês; o Vendedor só vê as próprias vendas, e só do dia. */
export function RelatorioVendas(props: { api: Api; perfil: Perfil }) {
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const [periodo, setPeriodo] = useState<Periodo>('dia');
  const [data, setData] = useState(hoje);
  const efetivo: Periodo = props.perfil === 'vendedor' ? 'dia' : periodo;
  const proximo = deslocarPeriodo(efetivo, data, 1);
  const noFuturo = efetivo === 'dia' ? proximo > hoje : proximo.slice(0, 7) > hoje.slice(0, 7);

  return (
    <Stack gap="md">
      {props.perfil === 'dono' && (
        <SimpleGrid cols={2} spacing="xs">
          <Button h={48} variant={periodo === 'dia' ? 'filled' : 'default'} onClick={() => setPeriodo('dia')} aria-pressed={periodo === 'dia'}>
            Dia
          </Button>
          <Button h={48} variant={periodo === 'mes' ? 'filled' : 'default'} onClick={() => setPeriodo('mes')} aria-pressed={periodo === 'mes'}>
            Mês
          </Button>
        </SimpleGrid>
      )}
      <SimpleGrid cols={2} spacing="xs">
        <Button h={48} variant="default" onClick={() => setData(deslocarPeriodo(efetivo, data, -1))}>
          Anterior
        </Button>
        <Button h={48} variant="default" disabled={noFuturo} onClick={() => setData(proximo)}>
          Próximo
        </Button>
      </SimpleGrid>
      <Text fw={650}>{rotuloDoPeriodo(efetivo, data)}</Text>
      <Conteudo key={`${efetivo}-${data}`} api={props.api} periodo={efetivo} data={data} dono={props.perfil === 'dono'} />
    </Stack>
  );
}

function Conteudo(props: { api: Api; periodo: Periodo; data: string; dono: boolean }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.relatorioVendas(props.periodo, props.data));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Numeros dados={carga.dados} dono={props.dono} />;
}

function Numeros(props: { dados: Dados; dono: boolean }) {
  const d = props.dados;
  if (d.vendas === 0) {
    return <EstadoVazio titulo="Nenhuma venda neste período" texto="Quando uma venda for finalizada, ela aparece aqui." />;
  }
  return (
    <Stack gap="sm">
      <Text fz="xl" fw={700}>
        {d.vendas} {d.vendas === 1 ? 'venda' : 'vendas'} · <Valor centavos={d.total_centavos} destaque />
      </Text>
      <Text>
        {d.percentual_com_cliente}% das vendas têm cliente ({d.com_cliente} de {d.vendas}).
      </Text>
      <Text fw={650}>Por forma</Text>
      {d.por_forma.map((f) => (
        <Text key={f.forma}>
          {ROTULOS_FORMA[f.forma]} · <Valor centavos={f.valor_centavos} />
        </Text>
      ))}
      {props.dono && (
        <>
          <Text fw={650}>Por vendedor</Text>
          {d.por_vendedor.map((v) => (
            <Text key={v.nome} style={{ overflowWrap: 'anywhere' }}>
              {v.nome} · {v.vendas} · <Valor centavos={v.total_centavos} />
            </Text>
          ))}
        </>
      )}
      <Text fw={650}>Por categoria</Text>
      {d.por_categoria.map((c) => (
        <Text key={c.categoria} style={{ overflowWrap: 'anywhere' }}>
          {c.categoria} · <Valor centavos={c.total_centavos} />
        </Text>
      ))}
      {d.repetidos.length > 0 && (
        <>
          <Text fw={650}>Celulares repetidos</Text>
          {d.repetidos.map((c) => (
            <Text key={c.celular}>
              {mascararCelular(c.celular)} · {c.vendas} vendas
            </Text>
          ))}
        </>
      )}
      {d.suspeitos.length > 0 && (
        <>
          <Text fw={650}>Celulares suspeitos</Text>
          {d.suspeitos.map((c) => (
            <Text key={c.celular}>
              {mascararCelular(c.celular)} · {c.vendas} {c.vendas === 1 ? 'venda' : 'vendas'}
            </Text>
          ))}
        </>
      )}
    </Stack>
  );
}
