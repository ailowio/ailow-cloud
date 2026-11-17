import { createContext, useContext } from 'react';
import { ActionIcon, Avatar, Badge, Box, Menu, Text } from '@mantine/core';
import { IconLogout, IconUsers } from '@tabler/icons-react';
import type { Perfil } from '@ailow/shared';

/** UXM-06: quem está logado e o que o menu do nome pode fazer. Só existe dentro da área com sessão. */
export interface SessaoUi {
  nome: string;
  perfil: Perfil;
  aoTrocar: () => void;
  aoSair: () => void;
}

export const SessaoContexto = createContext<SessaoUi | null>(null);

const PERFIL = { dono: 'Dono', vendedor: 'Vendedor' } as const;

/** Primeira letra visível do nome (toolbar). */
export function inicialDoNome(nome: string): string {
  const t = nome.trim();
  if (!t) return '?';
  return [...t][0]!.toLocaleUpperCase('pt-BR');
}

/** Troca de usuário na toolbar. Alvo 48 px. */
export function BotaoTrocarUsuario() {
  const sessao = useContext(SessaoContexto);
  if (!sessao) return null;
  return (
    <ActionIcon
      variant="default"
      size={48}
      aria-label="Trocar de usuário"
      onClick={sessao.aoTrocar}
    >
      <IconUsers aria-hidden />
    </ActionIcon>
  );
}

/**
 * Inicial do usuário + badge de perfil na borda (estilo notificação).
 * Toque abre o menu com o nome completo e Sair.
 */
export function MenuUsuario() {
  const sessao = useContext(SessaoContexto);
  if (!sessao) return null;
  const perfil = PERFIL[sessao.perfil];
  const inicial = inicialDoNome(sessao.nome);
  return (
    <Menu position="bottom-end" width={220} withinPortal>
      <Menu.Target>
        <Box pos="relative" style={{ display: 'inline-flex' }}>
          <Badge
            className="ailow-menu-usuario__badge"
            variant="filled"
            color="gray"
            size="xs"
            px={6}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              pointerEvents: 'none',
              lineHeight: 1.2,
            }}
          >
            {perfil}
          </Badge>
          <ActionIcon
            variant="default"
            size={48}
            radius="xl"
            aria-label={`Menu de ${sessao.nome}, ${perfil}`}
            data-inicial-usuario
          >
            <Avatar
              size={40}
              radius="xl"
              variant="filled"
              aria-hidden
              style={{ background: 'var(--ailow-marca)', color: 'var(--ailow-sobre-acao)' }}
            >
              <Text fw={700} fz={18} lh={1}>
                {inicial}
              </Text>
            </Avatar>
          </ActionIcon>
        </Box>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label style={{ overflowWrap: 'anywhere' }}>{sessao.nome}</Menu.Label>
        <Menu.Item mih={48} color="red" leftSection={<IconLogout size={20} aria-hidden />} onClick={sessao.aoSair}>
          Sair
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
