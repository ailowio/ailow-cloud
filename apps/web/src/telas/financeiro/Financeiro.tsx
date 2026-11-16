import { IconCalendarDue, IconChartBar, IconReceipt } from '@tabler/icons-react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { Api } from '../../api/endpoints';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { useSairDoAssistente, useVoltar } from '../../componentes/navegacao';
import { Moldura } from '../Moldura';
import { ContasAPagar } from './ContasAPagar';
import { NovaDespesa } from './NovaDespesa';
import { Relatorio } from './Relatorio';

type Secao = 'menu' | 'despesa' | 'contas' | 'relatorio';

const TITULOS: Record<Exclude<Secao, 'menu'>, string> = {
  despesa: 'Nova despesa',
  contas: 'Contas a pagar',
  relatorio: 'Relatório',
};

/** Cada seção é uma subrota de /financeiro: o Voltar do sistema (e a seta do topo) recua uma tela por vez. */
const ROTAS: Record<Exclude<Secao, 'menu'>, string> = {
  despesa: '/financeiro/nova-despesa',
  contas: '/financeiro/contas-a-pagar',
  relatorio: '/financeiro/relatorio',
};

function secaoDaRota(caminho: string): Secao | null {
  const sub = caminho.replace(/^\/financeiro\/?/, '').replace(/\/$/, '');
  if (sub === '') return 'menu';
  const achada = (Object.keys(ROTAS) as Exclude<Secao, 'menu'>[]).find((s) => ROTAS[s] === `/financeiro/${sub}`);
  return achada ?? null;
}

/**
 * Financeiro (só Dono, RN-10): menu em ícones (UXM-10), uma decisão por tela. Nova receita e Contas a receber não
 * têm botão: o backend não permite entrada manual nem conta a receber (ADR 013).
 */
export function Financeiro(props: { api: Api; aoVoltar: () => void }) {
  const navigate = useNavigate();
  const secao = secaoDaRota(useLocation().pathname);
  const voltarUm = useVoltar('/financeiro');
  const sair = useSairDoAssistente('/financeiro');
  if (secao === null) return <Navigate to="/financeiro" replace />;
  const titulo = secao === 'menu' ? undefined : TITULOS[secao];

  return (
    <Moldura
      titulo={titulo ?? 'Financeiro'}
      logoEmpresa
      voltar={{
        rotulo: titulo ? 'Financeiro' : 'Início',
        aoVoltar: titulo ? voltarUm : props.aoVoltar,
      }}
    >
      {secao === 'menu' && (
        <GradeAcoes
          acoes={[
            { id: 'despesa', rotulo: 'Nova despesa', icone: <IconReceipt size={32} stroke={1.75} />, aoTocar: () => navigate(ROTAS.despesa) },
            { id: 'contas', rotulo: 'Contas a pagar', icone: <IconCalendarDue size={32} stroke={1.75} />, aoTocar: () => navigate(ROTAS.contas) },
            { id: 'relatorio', rotulo: 'Relatório', icone: <IconChartBar size={32} stroke={1.75} />, aoTocar: () => navigate(ROTAS.relatorio) },
          ]}
        />
      )}
      {/* Despesa em aberto leva às contas a pagar (onde ela aparece); despesa paga volta a quem abriu o assistente. */}
      {secao === 'despesa' && (
        <NovaDespesa api={props.api} aoSalvar={(paga) => sair(paga ? undefined : ROTAS.contas)} aoCancelar={() => sair()} />
      )}
      {secao === 'contas' && <ContasAPagar api={props.api} aoNovaDespesa={() => navigate(ROTAS.despesa)} />}
      {secao === 'relatorio' && <Relatorio api={props.api} />}
    </Moldura>
  );
}
