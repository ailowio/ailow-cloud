import { useMemo, useState } from 'react';
import { Badge, Button, Group, SimpleGrid, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconLogin2, IconLogout2, IconPlus, IconSearch } from '@tabler/icons-react';
import { useLocation } from 'react-router';
import type { Espelho, Marca } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { deslocarPeriodo, formatarData, hojeEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { AjustarMarca } from './AjustePonto';
import { type LinhaPonto, ROTULO_TIPO_PONTO, filtrarHistorico, linhasDoHistorico } from './historico-ponto';

const POR_PAGINA = 10;

/** "Mês anterior / Próximo mês" + o mês escolhido. Não deixa ir para o futuro. */
export function MesNav(props: { mes: string; aoMudar: (mes: string) => void }) {
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const proximo = deslocarPeriodo('mes', props.mes, 1);
  const noFuturo = proximo.slice(0, 7) > hoje.slice(0, 7);
  return (
    <Stack gap="xs">
      <SimpleGrid cols={2} spacing="xs">
        <Button h={48} px="xs" variant="default" leftSection={<IconChevronLeft size={18} aria-hidden />} onClick={() => props.aoMudar(deslocarPeriodo('mes', props.mes, -1))}>
          Mês anterior
        </Button>
        <Button h={48} px="xs" variant="default" rightSection={<IconChevronRight size={18} aria-hidden />} disabled={noFuturo} onClick={() => props.aoMudar(proximo)}>
          Próximo mês
        </Button>
      </SimpleGrid>
      <Text fw={650} ta="center" data-mes-ponto>
        {rotuloDoPeriodo('mes', props.mes)}
      </Text>
    </Stack>
  );
}

/** Histórico de pontos (RF-PES-02): registro a registro, do mais novo ao mais antigo, com busca e páginas. O Vendedor vê só os seus. */
export function HistoricoPontos(props: { api: Api; dono: boolean; aoAdicionar: () => void }) {
  // Vindo do assistente, abre no mês do ponto recém-salvo (pode não ser o mês atual).
  const mesDoEstado = (useLocation().state as { mes?: string } | null)?.mes;
  const [mes, setMes] = useState(mesDoEstado ?? `${hojeEmSaoPaulo().slice(0, 7)}-01`);
  const [texto, setTexto] = useState('');
  const [rodada, setRodada] = useState(0);
  const [ajustando, setAjustando] = useState<{ marca: Marca; nome: string } | null>(null);

  return (
    <Stack gap="md">
      {props.dono && (
        <Button h={48} leftSection={<IconPlus size={20} aria-hidden />} onClick={props.aoAdicionar}>
          Adicionar ponto
        </Button>
      )}
      <MesNav mes={mes} aoMudar={setMes} />
      <TextInput
        size="lg"
        aria-label="Buscar ponto"
        placeholder="Nome, tipo, data ou hora"
        leftSection={<IconSearch aria-hidden />}
        autoComplete="off"
        maxLength={80}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      <Conteudo
        key={`${mes}-${rodada}`}
        api={props.api}
        mes={mes}
        busca={texto}
        aoAjustar={props.dono ? (l) => setAjustando({ marca: { id: l.id, tipo: l.tipo, registrado_em: l.registrado_em, ajustado: l.ajustado }, nome: l.nome }) : undefined}
      />
      {ajustando && (
        <AjustarMarca
          api={props.api}
          marca={ajustando.marca}
          nome={ajustando.nome}
          aoFechar={() => setAjustando(null)}
          aoMudou={() => setRodada((r) => r + 1)}
        />
      )}
    </Stack>
  );
}

function Conteudo(props: { api: Api; mes: string; busca: string; aoAjustar?: (l: LinhaPonto) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.espelhoDePonto(props.mes));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Lista espelho={carga.dados} busca={props.busca} aoAjustar={props.aoAjustar} />;
}

function Lista(props: { espelho: Espelho; busca: string; aoAjustar?: (l: LinhaPonto) => void }) {
  const todas = useMemo(() => linhasDoHistorico(props.espelho), [props.espelho]);
  const filtradas = useMemo(() => filtrarHistorico(todas, props.busca), [todas, props.busca]);
  const pag = usePaginacao(filtradas, POR_PAGINA);

  if (todas.length === 0) {
    return <EstadoVazio titulo="Nenhum ponto neste mês" texto="Quando alguém bater o ponto, aparece aqui." />;
  }
  if (filtradas.length === 0) {
    return <EstadoVazio titulo="Nenhum ponto encontrado" texto="Tente outro nome, data ou hora." />;
  }
  return (
    <>
      <Stack gap="xs">
        {pag.itens.map((l) => (
          <Linha key={l.id} linha={l} aoAjustar={props.aoAjustar} />
        ))}
      </Stack>
      <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
    </>
  );
}

function Linha(props: { linha: LinhaPonto; aoAjustar?: (l: LinhaPonto) => void }) {
  const l = props.linha;
  const Icone = l.tipo === 'entrada' ? IconLogin2 : IconLogout2;
  const conteudo = (
    <Group wrap="nowrap" gap="sm" align="center">
      <Icone size={26} aria-hidden style={{ flex: 'none' }} />
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
          {l.nome}
        </Text>
        <Text size="sm">
          {ROTULO_TIPO_PONTO[l.tipo]} · {formatarData(l.dia)} · {l.hora}
        </Text>
      </Stack>
      {l.ajustado && (
        <Badge variant="light" color="gray" style={{ flex: 'none' }}>
          ajustado
        </Badge>
      )}
      {props.aoAjustar && <IconChevronRight size={18} aria-hidden style={{ flex: 'none' }} />}
    </Group>
  );
  if (!props.aoAjustar) {
    return (
      <Stack className="ailow-bloco" mih={56} p="sm" justify="center" data-linha-ponto>
        {conteudo}
      </Stack>
    );
  }
  const ajustar = props.aoAjustar;
  return (
    <UnstyledButton className="ailow-bloco" mih={56} p="sm" w="100%" data-linha-ponto onClick={() => ajustar(l)} aria-label={`Ajustar: ${l.nome}, ${ROTULO_TIPO_PONTO[l.tipo]} ${formatarData(l.dia)} ${l.hora}`}>
      {conteudo}
    </UnstyledButton>
  );
}
