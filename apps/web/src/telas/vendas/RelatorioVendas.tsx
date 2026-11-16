import { useMemo, useState } from 'react';
import { Badge, Box, Button, Group, SimpleGrid, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import type { Perfil, RelatorioVendas as Dados, VendaResumo } from '@ailow/shared';
import { mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { filtrarPorBusca } from '../../lib/busca';
import { type Periodo, deslocarPeriodo, formatarData, hojeEmSaoPaulo, horaEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { DetalheVenda } from './DetalheVenda';
import { camposBuscaVenda } from './lista-vendas';
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
      <Group wrap="nowrap" justify="space-between" gap="xs">
        <Button h={48} variant="default" px="xs" onClick={() => setData(deslocarPeriodo(efetivo, data, -1))}>
          Anterior
        </Button>
        <Text fw={650} ta="center">
          {rotuloDoPeriodo(efetivo, data)}
        </Text>
        <Button h={48} variant="default" px="xs" disabled={noFuturo} onClick={() => setData(proximo)}>
          Próximo
        </Button>
      </Group>
      <Conteudo key={`${efetivo}-${data}`} api={props.api} periodo={efetivo} data={data} dono={props.perfil === 'dono'} />
    </Stack>
  );
}

function Conteudo(props: { api: Api; periodo: Periodo; data: string; dono: boolean }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.relatorioVendas(props.periodo, props.data));
  const lista = useCarregar(() => props.api.listaVendas(props.periodo, props.data));
  const [aberta, setAberta] = useState<string | null>(null);
  if (carga.fase === 'carregando' || lista.carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (lista.carga.fase === 'erro') return <ErroCarregar mensagem={lista.carga.mensagem} aoTentar={lista.tentarDeNovo} />;
  return (
    <>
      <Numeros dados={carga.dados} dono={props.dono} vendas={lista.carga.dados.vendas} aoAbrir={setAberta} />
      <DetalheVenda
        api={props.api}
        id={aberta}
        aoFechar={() => setAberta(null)}
        aoMudar={() => {
          void recarregar();
          void lista.recarregar();
        }}
      />
    </>
  );
}

const POR_PAGINA = 10;

/** Lista de vendas do período: cada venda é uma linha separada; só a lista rola; busca ampla e paginada (S07). */
function ListaDeVendas(props: { vendas: VendaResumo[]; aoAbrir: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const filtradas = useMemo(() => filtrarPorBusca(props.vendas, busca, camposBuscaVenda), [props.vendas, busca]);
  const pag = usePaginacao(filtradas, POR_PAGINA);
  return (
    <Stack gap="xs">
      <Text fw={650}>Vendas</Text>
      <TextInput
        size="lg"
        aria-label="Buscar venda"
        placeholder="Nº, nome, celular ou valor"
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
        autoComplete="off"
      />
      {pag.itens.length === 0 ? (
        <Text c="dimmed">Nada encontrado</Text>
      ) : (
        <Box className="ailow-lista-vendas" data-lista-vendas="">
          {pag.itens.map((v) => (
            <UnstyledButton
              key={v.id}
              className="ailow-venda"
              data-venda={v.numero}
              data-cancelada={v.status === 'cancelada' ? 'true' : 'false'}
              aria-label={`Venda ${v.numero}, ${v.cliente?.nome ?? 'sem cliente'}`}
              onClick={() => props.aoAbrir(v.id)}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
                <Text fw={700} fz="lg">
                  Venda {v.numero}
                </Text>
                {v.status === 'cancelada' ? <Badge color="red">Cancelada</Badge> : <Valor centavos={v.total_centavos} destaque />}
              </Group>
              <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                {v.cliente ? v.cliente.nome : 'Sem cliente'}
              </Text>
              <Text c="dimmed" fz="sm">
                {formatarData(hojeEmSaoPaulo(new Date(v.criado_em)))} {horaEmSaoPaulo(v.criado_em)} ·{v.formas.map((f) => ROTULOS_FORMA[f]).join(' + ') || 'sem pagamento'}
                {v.status === 'cancelada' && (
                  <>
                    {' · '}
                    <Valor centavos={v.total_centavos} />
                  </>
                )}
              </Text>
            </UnstyledButton>
          ))}
        </Box>
      )}
      <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
    </Stack>
  );
}

function Numeros(props: { dados: Dados; dono: boolean; vendas: VendaResumo[]; aoAbrir: (id: string) => void }) {
  const d = props.dados;
  if (d.vendas === 0 && props.vendas.length === 0) {
    return <EstadoVazio titulo="Nenhuma venda neste período" texto="Quando uma venda for finalizada, ela aparece aqui." />;
  }
  return (
    <Stack gap="sm">
      <Text fz="xl" fw={700}>
        {d.vendas} {d.vendas === 1 ? 'venda' : 'vendas'} · <Valor centavos={d.total_centavos} destaque />
      </Text>
      <ListaDeVendas vendas={props.vendas} aoAbrir={props.aoAbrir} />
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
