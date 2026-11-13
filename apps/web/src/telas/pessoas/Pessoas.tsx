import { useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { IconChartBar, IconHistory, IconLogin2, IconLogout2, IconCircleCheck, IconUsers } from '@tabler/icons-react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { Marca, PontoEstado } from '@ailow/shared';
import { diaDoPonto } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import type { ErroApi } from '../../api/cliente';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { useVoltar } from '../../componentes/navegacao';
import { formatarData, horaEmSaoPaulo } from '../../lib/datas';
import { Usuarios } from '../config/Usuarios';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { Moldura } from '../Moldura';
import { AdicionarPonto } from './AdicionarPonto';
import { HistoricoPontos } from './HistoricoPontos';
import { RelatorioPontos } from './RelatorioPontos';

function mensagemPonto(e: ErroApi): string {
  if (e.codigo === 'muito_rapido') return 'O ponto acabou de ser registrado. Espere alguns segundos para bater de novo.';
  return 'Não foi possível registrar o ponto. Tente de novo.';
}

type Tela = 'menu' | 'gerenciar' | 'historico' | 'adicionar' | 'relatorio';

/** Cada tela é uma subrota de /pessoas: o Voltar do sistema (e a seta do topo) recua uma tela por vez. */
function telaDaRota(caminho: string): Tela | null {
  const sub = caminho.replace(/^\/pessoas\/?/, '').replace(/\/$/, '');
  switch (sub) {
    case '':
      return 'menu';
    case 'gerenciar':
    case 'historico':
    case 'relatorio':
      return sub;
    case 'historico/adicionar':
      return 'adicionar';
    default:
      return null;
  }
}

/**
 * Pessoas (RF-PES-01/02/03): bater ponto + menu em ícones (UXM-10). O Vendedor vê só o próprio histórico e relatório
 * (a API impõe, RN-10); gerenciar pessoas e ajustar ponto são só do Dono (ADR 008).
 * Lacunas do backend (sem rota): editar o nome de uma pessoa e reativar quem foi desativado.
 */
export function Pessoas(props: { api: Api; perfil: 'dono' | 'vendedor'; usuarioId: string; aoVoltar: () => void }) {
  const navigate = useNavigate();
  const tela = telaDaRota(useLocation().pathname);
  const voltarUm = useVoltar('/pessoas');
  const dono = props.perfil === 'dono';

  if (tela === null || (tela === 'gerenciar' && !dono) || (tela === 'adicionar' && !dono)) {
    return <Navigate to="/pessoas" replace />;
  }
  if (tela === 'gerenciar') {
    return (
      <Moldura titulo="Gerenciar pessoas" logoEmpresa voltar={{ rotulo: 'Pessoas', aoVoltar: voltarUm }}>
        <Usuarios api={props.api} eu={props.usuarioId} />
      </Moldura>
    );
  }
  if (tela === 'historico') {
    return (
      <Moldura titulo="Histórico de pontos" logoEmpresa voltar={{ rotulo: 'Pessoas', aoVoltar: voltarUm }}>
        <HistoricoPontos api={props.api} dono={dono} aoAdicionar={() => navigate('/pessoas/historico/adicionar', { replace: true })} />
      </Moldura>
    );
  }
  if (tela === 'adicionar') {
    return (
      // O assistente substitui o histórico na pilha (replace): o fim dele troca de novo, e o Voltar cai em Pessoas.
      <Moldura titulo="Adicionar ponto" logoEmpresa voltar={{ rotulo: 'Pessoas', aoVoltar: voltarUm }}>
        <AdicionarPonto
          api={props.api}
          aoCancelar={voltarUm}
          aoVerHistorico={(mes) => navigate('/pessoas/historico', { replace: true, state: { mes } })}
        />
      </Moldura>
    );
  }
  if (tela === 'relatorio') {
    return (
      <Moldura titulo="Relatório de pontos" logoEmpresa voltar={{ rotulo: 'Pessoas', aoVoltar: voltarUm }}>
        <RelatorioPontos api={props.api} dono={dono} />
      </Moldura>
    );
  }
  return (
    <Moldura titulo="Pessoas" logoEmpresa voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <Menu api={props.api} dono={dono} />
    </Moldura>
  );
}

function Menu(props: { api: Api; dono: boolean }) {
  const navigate = useNavigate();
  // Cada batida muda o botão: a versão faz o estado ser buscado de novo.
  const [versao, setVersao] = useState(0);
  const [batida, setBatida] = useState<Marca | null>(null);
  return (
    <Stack gap="xl">
      <Stack gap="md">
        <BaterPonto
          key={`ponto-${versao}`}
          api={props.api}
          aoBater={(m) => {
            setBatida(m);
            setVersao((v) => v + 1);
          }}
        />
        {batida && <ConfirmacaoDaBatida marca={batida} aoVer={() => navigate('/pessoas/historico')} />}
      </Stack>
      <GradeAcoes
        acoes={[
          ...(props.dono
            ? [{ id: 'gerenciar', rotulo: 'Gerenciar pessoas', icone: <IconUsers size={32} stroke={1.75} />, aoTocar: () => navigate('/pessoas/gerenciar') }]
            : []),
          { id: 'historico', rotulo: 'Histórico de pontos', icone: <IconHistory size={32} stroke={1.75} />, aoTocar: () => navigate('/pessoas/historico') },
          { id: 'relatorio', rotulo: 'Relatório de pontos', icone: <IconChartBar size={32} stroke={1.75} />, aoTocar: () => navigate('/pessoas/relatorio') },
        ]}
      />
    </Stack>
  );
}

/** Resultado explícito da batida: tipo, dia e hora gravados pelo servidor (não o que a tela supõe). */
function ConfirmacaoDaBatida(props: { marca: Marca; aoVer: () => void }) {
  const { marca } = props;
  return (
    <Stack gap="sm" className="ailow-cartao" p="md" data-resultado-ponto role="status">
      <Group gap="xs" wrap="nowrap">
        <IconCircleCheck size={28} color="var(--mantine-color-teal-6)" aria-hidden />
        <Text fw={700}>{marca.tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada às {horaEmSaoPaulo(marca.registrado_em)}</Text>
      </Group>
      <Text size="sm" c="dimmed">
        Dia {formatarData(diaDoPonto(marca.registrado_em))}. Já está no histórico.
      </Text>
      <Button h={48} variant="default" onClick={props.aoVer}>
        Ver no histórico
      </Button>
    </Stack>
  );
}

function BaterPonto(props: { api: Api; aoBater: (m: Marca) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.estadoDoPonto());
  if (carga.fase === 'carregando') return <Carregando linhas={1} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Botao api={props.api} estado={carga.dados} aoBater={props.aoBater} />;
}

function Botao(props: { api: Api; estado: PontoEstado; aoBater: (m: Marca) => void }) {
  const { pendente, rodar } = useAcao(mensagemPonto);
  const entrando = props.estado.proximo === 'entrada';
  const ultima = props.estado.ultima;

  async function bater() {
    let marca: Marca | null = null;
    const ok = await rodar(
      async () => {
        marca = (await props.api.baterPonto()).marca;
      },
      entrando ? 'Entrada registrada.' : 'Saída registrada.',
    );
    if (ok && marca) props.aoBater(marca);
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
    </Stack>
  );
}
