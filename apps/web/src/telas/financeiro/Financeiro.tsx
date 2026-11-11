import { useState } from 'react';
import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconCalendarDue, IconChartBar, IconChevronRight, IconReceipt } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Moldura } from '../Moldura';
import { ContasAPagar } from './ContasAPagar';
import { NovaDespesa } from './NovaDespesa';
import { Relatorio } from './Relatorio';

type Secao = 'menu' | 'despesa' | 'contas' | 'relatorio';

const ITENS: { id: Exclude<Secao, 'menu'>; titulo: string; texto: string; icone: React.ReactNode }[] = [
  { id: 'despesa', titulo: 'Nova despesa', texto: 'Água, luz, aluguel, sacolas…', icone: <IconReceipt aria-hidden /> },
  { id: 'contas', titulo: 'Contas a pagar', texto: 'O que vence e marcar como pago', icone: <IconCalendarDue aria-hidden /> },
  { id: 'relatorio', titulo: 'Relatório', texto: 'O que entrou e saiu, no dia ou no mês', icone: <IconChartBar aria-hidden /> },
];

/** Financeiro (só Dono, RN-10): menu de 3 áreas, uma decisão por tela. */
export function Financeiro(props: { api: Api; aoVoltar: () => void }) {
  const [secao, setSecao] = useState<Secao>('menu');
  const item = ITENS.find((i) => i.id === secao);

  return (
    <Moldura
      titulo={item?.titulo ?? 'Financeiro'}
      voltar={{
        rotulo: item ? 'Financeiro' : 'Início',
        aoVoltar: item ? () => setSecao('menu') : props.aoVoltar,
      }}
    >
      {secao === 'menu' && (
        <Stack gap="sm">
          {ITENS.map((i) => (
            <UnstyledButton key={i.id} className="ailow-bloco" mih={72} p="md" w="100%" onClick={() => setSecao(i.id)}>
              <Group wrap="nowrap" gap="md">
                {i.icone}
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={650} fz="lg">
                    {i.titulo}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {i.texto}
                  </Text>
                </Stack>
                <IconChevronRight aria-hidden />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}
      {/* Despesa em aberto leva às contas a pagar (onde ela aparece); despesa paga volta ao menu. */}
      {secao === 'despesa' && <NovaDespesa api={props.api} aoSalvar={(paga) => setSecao(paga ? 'menu' : 'contas')} />}
      {secao === 'contas' && <ContasAPagar api={props.api} aoNovaDespesa={() => setSecao('despesa')} />}
      {secao === 'relatorio' && <Relatorio api={props.api} />}
    </Moldura>
  );
}
