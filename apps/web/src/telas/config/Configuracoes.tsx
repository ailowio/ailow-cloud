import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useSairDoAssistente, useVoltar } from '../../componentes/navegacao';
import { IconBuildingStore, IconCategory, IconChevronRight, IconPercentage, IconUsers } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Moldura } from '../Moldura';
import { Categorias } from './Categorias';
import { DadosDaEmpresa, Markup } from './Empresa';
import { Usuarios } from './Usuarios';

type Secao = 'menu' | 'usuarios' | 'empresa' | 'markup' | 'categorias';

const ITENS: { id: Exclude<Secao, 'menu'>; titulo: string; texto: string; icone: React.ReactNode }[] = [
  { id: 'usuarios', titulo: 'Usuários', texto: 'Vendedores, PINs e acessos', icone: <IconUsers aria-hidden /> },
  { id: 'empresa', titulo: 'Empresa', texto: 'Nome, telefone, endereço e trava do app', icone: <IconBuildingStore aria-hidden /> },
  { id: 'markup', titulo: 'Markup', texto: 'Percentual para sugerir o preço', icone: <IconPercentage aria-hidden /> },
  { id: 'categorias', titulo: 'Categorias', texto: 'De produto e financeiras', icone: <IconCategory aria-hidden /> },
];

/** Configurações (só Dono, RN-10): menu de 4 áreas, uma decisão por tela. */
export function Configuracoes(props: {
  api: Api;
  usuarioId: string;
  aoVoltar: () => void;
  aoMudarInatividade: (minutos: number) => void;
}) {
  const navigate = useNavigate();
  // Cada área é uma subrota de /configuracoes: o Voltar do sistema (e a seta do topo) recua uma tela por vez.
  const sub = useLocation().pathname.replace(/^\/configuracoes\/?/, '').replace(/\/$/, '');
  const voltarUm = useVoltar('/configuracoes');
  const sair = useSairDoAssistente('/configuracoes');
  const item = ITENS.find((i) => i.id === sub);
  const secao: Secao = item ? item.id : 'menu';
  if (sub !== '' && !item) return <Navigate to="/configuracoes" replace />;

  return (
    <Moldura
      titulo={item?.titulo ?? 'Configurações'}
      logoEmpresa
      voltar={{
        rotulo: item ? 'Configurações' : 'Início',
        aoVoltar: item ? voltarUm : props.aoVoltar,
      }}
    >
      {secao === 'menu' && (
        <Stack gap="sm">
          {ITENS.map((i) => (
            <UnstyledButton key={i.id} className="ailow-bloco" mih={72} p="md" w="100%" onClick={() => navigate(`/configuracoes/${i.id}`)}>
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
      {secao === 'usuarios' && <Usuarios api={props.api} eu={props.usuarioId} />}
      {secao === 'empresa' && <DadosDaEmpresa api={props.api} aoMudarInatividade={props.aoMudarInatividade} aoConcluir={() => sair()} />}
      {secao === 'markup' && <Markup api={props.api} />}
      {secao === 'categorias' && <Categorias api={props.api} />}
    </Moldura>
  );
}
