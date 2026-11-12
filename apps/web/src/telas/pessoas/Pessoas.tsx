import { useMemo, useState } from 'react';
import { Alert, Button, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconLogin2, IconLogout2, IconPlus } from '@tabler/icons-react';
import type { Espelho, Marca, PontoEstado } from '@ailow/shared';
import { diaDoPonto, formatarDuracao, type DiaDePonto } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { ErroApi } from '../../api/cliente';
import { EstadoVazio } from '../../componentes';
import { deslocarPeriodo, formatarData, hojeEmSaoPaulo, horaEmSaoPaulo, rotuloDoPeriodo } from '../../lib/datas';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { Moldura } from '../Moldura';
import { AdicionarPonto, AjustarMarca } from './AjustePonto';

function mensagemPonto(e: ErroApi): string {
  if (e.codigo === 'muito_rapido') return 'O ponto acabou de ser registrado. Espere alguns segundos para bater de novo.';
  return 'Não foi possível registrar o ponto. Tente de novo.';
}

const ROTULO_TIPO = { entrada: 'Entrada', saida: 'Saída' } as const;
const textoDaMarca = (m: Marca, dia: string) =>
  `${ROTULO_TIPO[m.tipo]} ${horaEmSaoPaulo(m.registrado_em)}${diaDoPonto(m.registrado_em) !== dia ? ' (dia seguinte)' : ''}${m.ajustado ? ' · ajustado' : ''}`;

/** Pessoas (RF-PES-01/02/03): bater ponto e espelho do mês. O Vendedor só vê o próprio; só o Dono ajusta (ADR 008). */
export function Pessoas(props: { api: Api; perfil: 'dono' | 'vendedor'; aoVoltar: () => void }) {
  // Cada batida ou ajuste muda o botão e o espelho: a versão faz os dois buscarem de novo (o mês escolhido não zera).
  const [versao, setVersao] = useState(0);
  const mudou = () => setVersao((v) => v + 1);
  return (
    <Moldura titulo="Pessoas" logoEmpresa voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <Stack gap="xl">
        <BaterPonto key={`ponto-${versao}`} api={props.api} aoBater={mudou} />
        <EspelhoDoMes api={props.api} perfil={props.perfil} versao={versao} aoMudar={mudou} />
      </Stack>
    </Moldura>
  );
}

function BaterPonto(props: { api: Api; aoBater: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.estadoDoPonto());
  if (carga.fase === 'carregando') return <Carregando linhas={1} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Botao api={props.api} estado={carga.dados} aoBater={props.aoBater} />;
}

function Botao(props: { api: Api; estado: PontoEstado; aoBater: () => void }) {
  const { pendente, erro, rodar } = useAcao(mensagemPonto);
  const entrando = props.estado.proximo === 'entrada';
  const ultima = props.estado.ultima;

  async function bater() {
    const ok = await rodar(
      () => props.api.baterPonto(),
      entrando ? 'Entrada registrada.' : 'Saída registrada.',
    );
    if (ok) props.aoBater();
  }

  return (
    <Stack gap="sm">
      <Text c="dimmed" size="sm">
        {ultima
          ? `Último registro: ${ultima.tipo === 'entrada' ? 'entrada' : 'saída'} em ${formatarData(diaDoPonto(ultima.registrado_em))}, ${horaEmSaoPaulo(ultima.registrado_em)}`
          : 'Nenhum registro ainda.'}
      </Text>
      <Button
        h={128}
        fz={26}
        fullWidth
        loading={pendente}
        variant={entrando ? 'filled' : 'outline'}
        leftSection={entrando ? <IconLogin2 size={32} aria-hidden /> : <IconLogout2 size={32} aria-hidden />}
        onClick={() => void bater()}
      >
        {entrando ? 'Bater entrada' : 'Bater saída'}
      </Button>
      {erro && (
        <Alert color="red" role="alert">
          {erro}
        </Alert>
      )}
    </Stack>
  );
}

function EspelhoDoMes(props: { api: Api; perfil: 'dono' | 'vendedor'; versao: number; aoMudar: () => void }) {
  const hoje = useMemo(() => hojeEmSaoPaulo(), []);
  const [mes, setMes] = useState(`${hoje.slice(0, 7)}-01`);
  const [adicionando, setAdicionando] = useState(false);
  const [ajustando, setAjustando] = useState<{ marca: Marca; nome: string } | null>(null);
  const proximo = deslocarPeriodo('mes', mes, 1);
  const noFuturo = proximo.slice(0, 7) > hoje.slice(0, 7);
  const dono = props.perfil === 'dono';

  return (
    <Stack gap="md">
      <Text fw={700} fz="lg" component="h2">
        {dono ? 'Espelho de ponto da equipe' : 'Meu espelho de ponto'}
      </Text>
      <SimpleGrid cols={2} spacing="xs">
        <Button h={48} variant="default" onClick={() => setMes(deslocarPeriodo('mes', mes, -1))}>
          Anterior
        </Button>
        <Button h={48} variant="default" disabled={noFuturo} onClick={() => setMes(proximo)}>
          Próximo
        </Button>
      </SimpleGrid>
      <Text fw={650}>{rotuloDoPeriodo('mes', mes)}</Text>
      {dono && (
        <Button h={48} variant="default" leftSection={<IconPlus size={20} aria-hidden />} onClick={() => setAdicionando(true)}>
          Adicionar ponto
        </Button>
      )}
      <Conteudo
        key={`${mes}-${props.versao}`}
        api={props.api}
        mes={mes}
        aoAjustar={dono ? (marca, nome) => setAjustando({ marca, nome }) : undefined}
      />
      {adicionando && <AdicionarPonto api={props.api} aoFechar={() => setAdicionando(false)} aoMudou={props.aoMudar} />}
      {ajustando && (
        <AjustarMarca
          api={props.api}
          marca={ajustando.marca}
          nome={ajustando.nome}
          aoFechar={() => setAjustando(null)}
          aoMudou={props.aoMudar}
        />
      )}
    </Stack>
  );
}

function Conteudo(props: { api: Api; mes: string; aoAjustar?: (m: Marca, nome: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.espelhoDePonto(props.mes));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <ListaEspelho dados={carga.dados} aoAjustar={props.aoAjustar} />;
}

function ListaEspelho(props: { dados: Espelho; aoAjustar?: (m: Marca, nome: string) => void }) {
  if (props.dados.usuarios.length === 0) {
    return <EstadoVazio titulo="Nenhum ponto neste mês" texto="Quando alguém bater o ponto, aparece aqui." />;
  }
  return (
    <Stack gap="md">
      {props.dados.usuarios.map((u) => (
        <Stack key={u.usuario_id} gap="xs" className="ailow-bloco" p="md">
          <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
            {u.nome}
          </Text>
          <Text size="sm" c="dimmed">
            Total no mês: <strong>{formatarDuracao(u.total_segundos)}</strong>
          </Text>
          {u.dias.map((d) => (
            <Dia key={d.data} dia={d} aoAjustar={props.aoAjustar ? (m) => props.aoAjustar?.(m, u.nome) : undefined} />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

function Dia(props: { dia: DiaDePonto; aoAjustar?: (m: Marca) => void }) {
  const { dia, aoAjustar } = props;
  return (
    <Stack gap={2} py={6} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Text fw={650} size="sm">
        {formatarData(dia.data)} · {dia.em_aberto ? 'em aberto' : formatarDuracao(dia.trabalhado_segundos)}
        {dia.em_aberto && dia.trabalhado_segundos > 0 ? ` (fechado: ${formatarDuracao(dia.trabalhado_segundos)})` : ''}
      </Text>
      {aoAjustar ? (
        // Dono: cada registro é um alvo de toque que abre o ajuste (editar horário ou excluir).
        dia.marcas.map((m) => (
          <UnstyledButton key={m.id} mih={48} px="xs" onClick={() => aoAjustar(m)} aria-label={`Ajustar: ${textoDaMarca(m, dia.data)}`}>
            <Text size="sm" component="span" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ overflowWrap: 'anywhere' }}>{textoDaMarca(m, dia.data)}</span>
              <IconChevronRight size={18} aria-hidden />
            </Text>
          </UnstyledButton>
        ))
      ) : (
        <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
          {dia.marcas.map((m) => textoDaMarca(m, dia.data)).join(' · ')}
        </Text>
      )}
    </Stack>
  );
}
