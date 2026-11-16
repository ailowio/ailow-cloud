import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useVoltar } from '../../componentes/navegacao';
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
  const navigate = useNavigate();
  // Cada tela é uma subrota de /compras (/compras/pedidos, /compras/pedidos/novo, /compras/fornecedores/novo…):
  // o Voltar do sistema (e a seta do topo) recua uma tela por vez; o pai de uma tela é a rota sem o último trecho.
  const partes = useLocation().pathname.replace(/^\/compras\/?/, '').split('/').filter(Boolean);
  const secao: Secao = (partes[0] as Secao | undefined) ?? 'menu';
  const resto = partes.slice(1);
  const pai = ['/compras', ...partes.slice(0, -1)].join('/');
  const voltarUm = useVoltar(pai);
  const item = ITENS.find((i) => i.id === secao);
  if (partes.length > 0 && (!item || resto.length > (secao === 'relatorio' ? 0 : 1))) return <Navigate to="/compras" replace />;

  return (
    <Moldura
      titulo={item?.titulo ?? 'Compras'}
      logoEmpresa
      voltar={{
        rotulo: !item ? 'Início' : resto.length > 0 ? item.titulo : 'Compras',
        aoVoltar: item ? voltarUm : props.aoVoltar,
      }}
    >
      {secao === 'menu' && (
        <Stack gap="sm">
          {ITENS.map((i) => (
            <UnstyledButton key={i.id} className="ailow-bloco" mih={72} p="md" w="100%" onClick={() => navigate(`/compras/${i.id}`)}>
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
      {secao === 'fornecedores' && <Fornecedores api={props.api} sub={resto[0]} />}
      {secao === 'pedidos' && <Pedidos api={props.api} sub={resto[0]} />}
      {secao === 'relatorio' && <RelatorioCompras api={props.api} />}
    </Moldura>
  );
}
