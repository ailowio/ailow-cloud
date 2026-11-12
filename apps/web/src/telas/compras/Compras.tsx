import { useState } from 'react';
import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChartBar, IconChevronRight, IconClipboardList, IconTruck } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Moldura } from '../Moldura';
import { Fornecedores } from './Fornecedores';
import { Pedidos } from './Pedidos';
import { RelatorioCompras } from './RelatorioCompras';

type Secao = 'menu' | 'fornecedores' | 'pedidos' | 'relatorio';

const ITENS: { id: Exclude<Secao, 'menu'>; titulo: string; texto: string; icone: React.ReactNode }[] = [
  { id: 'pedidos', titulo: 'Pedidos', texto: 'Rascunho, enviar e receber', icone: <IconClipboardList aria-hidden /> },
  { id: 'fornecedores', titulo: 'Fornecedores', texto: 'Nome, WhatsApp e CNPJ', icone: <IconTruck aria-hidden /> },
  { id: 'relatorio', titulo: 'Relatório', texto: 'Compras do mês por fornecedor', icone: <IconChartBar aria-hidden /> },
];

/** Compras (só Dono, RN-10): menu com pedidos, fornecedores e relatório. */
export function Compras(props: { api: Api; aoVoltar: () => void }) {
  const [secao, setSecao] = useState<Secao>('menu');
  const item = ITENS.find((i) => i.id === secao);

  return (
    <Moldura
      titulo={item?.titulo ?? 'Compras'}
      logoEmpresa
      voltar={{
        rotulo: item ? 'Compras' : 'Início',
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
      {secao === 'fornecedores' && <Fornecedores api={props.api} />}
      {secao === 'pedidos' && <Pedidos api={props.api} />}
      {secao === 'relatorio' && <RelatorioCompras api={props.api} />}
    </Moldura>
  );
}
