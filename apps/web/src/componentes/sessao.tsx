import { createContext, useContext } from 'react';
import { Button, Menu } from '@mantine/core';
import { IconChevronDown, IconLogout, IconUsers } from '@tabler/icons-react';

/** UXM-06: quem está logado e o que o menu do nome pode fazer. Só existe dentro da área com sessão. */
export interface SessaoUi {
  nome: string;
  aoTrocar: () => void;
  aoSair: () => void;
}

export const SessaoContexto = createContext<SessaoUi | null>(null);

/** Nome do usuário no topo: ao tocar abre "Trocar de usuário" e "Sair". Alvos de 48 px. */
export function MenuUsuario() {
  const sessao = useContext(SessaoContexto);
  if (!sessao) return null;
  return (
    <Menu position="bottom-end" width={220} withinPortal>
      <Menu.Target>
        <Button
          variant="default"
          size="md"
          h={48}
          px="sm"
          maw={120}
          aria-label={`Menu de ${sessao.nome}`}
          rightSection={<IconChevronDown size={16} aria-hidden />}
          styles={{ label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }}
        >
          {sessao.nome}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
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
