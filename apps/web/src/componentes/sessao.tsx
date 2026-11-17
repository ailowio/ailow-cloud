import { createContext, useContext } from 'react';
import { ActionIcon, Badge, Button, Group, Menu, Text } from '@mantine/core';
import { IconChevronDown, IconLogout, IconUsers } from '@tabler/icons-react';
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

/** Troca de usuário na toolbar (fora do menu). Alvo 48 px. */
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

/** Nome do usuário no topo: badge de perfil + menu Trocar/Sair. Nome nunca truncado (D23). */
export function MenuUsuario() {
  const sessao = useContext(SessaoContexto);
  if (!sessao) return null;
  const perfil = PERFIL[sessao.perfil];
  return (
    <Menu position="bottom-end" width={220} withinPortal>
      <Menu.Target>
        <Button
          variant="default"
          size="md"
          h={48}
          px="sm"
          aria-label={`Menu de ${sessao.nome}, ${perfil}`}
          rightSection={<IconChevronDown size={16} aria-hidden />}
        >
          <Group gap={6} wrap="nowrap" maw={140} style={{ minWidth: 0 }}>
            <Text
              component="span"
              size="sm"
              fw={600}
              style={{ overflowWrap: 'anywhere', whiteSpace: 'normal', lineHeight: 1.2, textAlign: 'left' }}
            >
              {sessao.nome}
            </Text>
            <Badge variant="light" color="gray" size="sm" style={{ flexShrink: 0 }}>
              {perfil}
            </Badge>
          </Group>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label style={{ overflowWrap: 'anywhere' }}>{sessao.nome}</Menu.Label>
        <Menu.Item mih={48} leftSection={<IconUsers size={20} aria-hidden />} onClick={sessao.aoTrocar}>
          Trocar de usuário
        </Menu.Item>
        <Menu.Item mih={48} color="red" leftSection={<IconLogout size={20} aria-hidden />} onClick={sessao.aoSair}>
          Sair
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
