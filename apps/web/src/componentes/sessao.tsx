import { createContext, useContext } from 'react';
import { ActionIcon, Avatar, Badge, Box, Menu, Text } from '@mantine/core';
import { IconDoorExit, IconReplaceUser } from '@tabler/icons-react';
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

/** Troca de usuário na toolbar: setas de ida e volta entre 2 pessoas (M03). Alvo 48 px. */
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
      <IconReplaceUser aria-hidden />
    </ActionIcon>
  );
}

/**
 * Inicial do usuário + selo de perfil no baixo-centro do avatar, sobre a borda inferior (M03/M05): avatar na
 * marca (`--ailow-marca`); selo com cor própria (`--ailow-selo`, neutro forte), inteiro dentro do topo de 64 px.
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
        <Box pos="relative" style={{ display: 'inline-flex', overflow: 'visible' }}>
          <Badge
            className="ailow-menu-usuario__badge"
            variant="filled"
            size="xs"
            px={4}
            styles={{
              root: {
                overflow: 'visible',
                maxWidth: 'none',
                background: 'var(--ailow-selo)',
                color: 'var(--ailow-sobre-selo)',
                boxShadow: '0 0 0 2px var(--ailow-topo)',
              },
              // Sem espaçamento extra entre letras: "VENDEDOR" cabe sem encostar no botão de Trocar em 360 px.
              label: { overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap', letterSpacing: 0 },
            }}
            style={{
              position: 'absolute',
              // 4 px abaixo do botão de 48 px: o selo cobre a borda inferior do avatar e termina 4 px antes do
              // fim do topo (64 px = 8 + 48 + 8), sem encostar.
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%)',
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
              // M05/D-A6: placeholder na marca (#07bdd5) com letra escura (--ailow-sobre-marca) nos 2 temas.
              // (Antes usava --ailow-acao; no claro o avatar ficava teal escuro, não o ciano da marca.)
              styles={{ placeholder: { background: 'var(--ailow-marca)', color: 'var(--ailow-sobre-marca)' } }}
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
        <Menu.Item mih={48} color="red" leftSection={<IconDoorExit size={20} aria-hidden />} onClick={sessao.aoSair}>
          Sair
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
