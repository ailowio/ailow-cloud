import type { ReactNode } from 'react';
import { ActionIcon, Box, Button, Container, Group, Stack, Text, Title, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconArrowLeft, IconMoon, IconSun } from '@tabler/icons-react';
import { Logo } from '../componentes/Logo';

/** Alterna claro/escuro. Alvo de 48 px; o rótulo diz a ação, não o estado. */
function AlternarTema() {
  const { setColorScheme } = useMantineColorScheme();
  const atual = useComputedColorScheme('dark');
  const escuro = atual === 'dark';
  return (
    <ActionIcon
      variant="default"
      size={48}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      onClick={() => setColorScheme(escuro ? 'light' : 'dark')}
    >
      {escuro ? <IconSun /> : <IconMoon />}
    </ActionIcon>
  );
}

/**
 * Estrutura de toda tela: topo (marca, tema, ação opcional) + conteúdo em coluna única.
 * Um só <h1> por tela; o conteúdo fica em <main> (pulo de teclado para quem navega sem mouse).
 */
export function Moldura(props: {
  titulo: string;
  subtitulo?: string;
  voltar?: { rotulo: string; aoVoltar: () => void };
  acaoTopo?: { rotulo: string; aoClicar: () => void };
  /** Com sessão aberta: tenta a logo da empresa no topo. */
  logoEmpresa?: boolean;
  children: ReactNode;
}) {
  return (
    <Box mih="100dvh" style={{ display: 'flex', flexDirection: 'column' }}>
      <a href="#conteudo" className="ailow-pular">Ir para o conteúdo</a>
      <Box component="header" className="ailow-topo">
        <Container size={560} px="md">
          <Group justify="space-between" wrap="nowrap" h={64}>
            <Group gap="xs" wrap="nowrap">
              <Logo altura={36} alt="" empresa={props.logoEmpresa === true} />
              {/* Nome Ailow ao lado da marca (produto); a logo da empresa é só o ícone. */}
              <Text ff="var(--mantine-font-family-headings)" fw={700} fz={22} c="var(--ailow-primario-texto)">
                Ailow
              </Text>
            </Group>
            <Group gap="xs" wrap="nowrap">
              {props.acaoTopo && (
                <Button variant="default" size="md" h={48} onClick={props.acaoTopo.aoClicar}>
                  {props.acaoTopo.rotulo}
                </Button>
              )}
              <AlternarTema />
            </Group>
          </Group>
        </Container>
      </Box>
      <Container component="main" id="conteudo" size={560} px="md" py="lg" w="100%" style={{ flex: 1 }} tabIndex={-1}>
        <Stack gap="lg">
          {props.voltar && (
            <Button
              variant="subtle"
              size="md"
              h={48}
              px="xs"
              w="fit-content"
              leftSection={<IconArrowLeft />}
              onClick={props.voltar.aoVoltar}
            >
              {props.voltar.rotulo}
            </Button>
          )}
          <Stack gap={4}>
            <Title order={1} fz={28} style={{ overflowWrap: 'anywhere' }}>{props.titulo}</Title>
            {props.subtitulo && <Text c="dimmed">{props.subtitulo}</Text>}
          </Stack>
          {props.children}
        </Stack>
      </Container>
    </Box>
  );
}
