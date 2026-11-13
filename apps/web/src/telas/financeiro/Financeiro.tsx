import { useState } from 'react';
import { IconCalendarDue, IconChartBar, IconReceipt } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { GradeAcoes } from '../../componentes/GradeAcoes';
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

/**
 * Financeiro (só Dono, RN-10): menu em ícones (UXM-10), uma decisão por tela. Nova receita e Contas a receber não
 * têm botão: o backend não permite entrada manual nem conta a receber (ADR 013).
 */
export function Financeiro(props: { api: Api; aoVoltar: () => void }) {
  const [secao, setSecao] = useState<Secao>('menu');
  const titulo = secao === 'menu' ? undefined : TITULOS[secao];

  return (
    <Moldura
      titulo={titulo ?? 'Financeiro'}
      logoEmpresa
      voltar={{
        rotulo: titulo ? 'Financeiro' : 'Início',
        aoVoltar: titulo ? () => setSecao('menu') : props.aoVoltar,
      }}
    >
      {secao === 'menu' && (
        <GradeAcoes
          acoes={[
            { id: 'despesa', rotulo: 'Nova despesa', icone: <IconReceipt size={32} stroke={1.75} />, aoTocar: () => setSecao('despesa') },
            { id: 'contas', rotulo: 'Contas a pagar', icone: <IconCalendarDue size={32} stroke={1.75} />, aoTocar: () => setSecao('contas') },
            { id: 'relatorio', rotulo: 'Relatório', icone: <IconChartBar size={32} stroke={1.75} />, aoTocar: () => setSecao('relatorio') },
          ]}
        />
      )}
      {/* Despesa em aberto leva às contas a pagar (onde ela aparece); despesa paga volta ao menu. */}
      {secao === 'despesa' && (
        <NovaDespesa api={props.api} aoSalvar={(paga) => setSecao(paga ? 'menu' : 'contas')} aoCancelar={() => setSecao('menu')} />
      )}
      {secao === 'contas' && <ContasAPagar api={props.api} aoNovaDespesa={() => setSecao('despesa')} />}
      {secao === 'relatorio' && <Relatorio api={props.api} />}
    </Moldura>
  );
}
