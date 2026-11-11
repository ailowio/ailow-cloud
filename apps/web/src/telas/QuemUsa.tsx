import { Alert, Badge, Button, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconInfoCircle, IconLock, IconUser } from '@tabler/icons-react';
import type { QuemUsaItem } from '../api/endpoints';
import { EstadoVazio } from '../componentes';
import { Moldura } from './Moldura';

const PERFIL = { dono: 'Dono', vendedor: 'Vendedor' } as const;

/** RF-ACE-03: aparelho vinculado lista as pessoas ativas; tocar no nome leva ao PIN. */
export function QuemUsa(props: {
  usuarios: QuemUsaItem[];
  aviso?: string;
  aoEscolher: (u: QuemUsaItem) => void;
  aoEntrarComSenha: () => void;
}) {
  return (
    <Moldura titulo="Quem está usando?" subtitulo="Toque no seu nome e digite o PIN.">
      <Stack gap="sm">
        {props.aviso && <Alert color="blue" icon={<IconInfoCircle />} role="status">{props.aviso}</Alert>}
        {props.usuarios.length === 0 && (
          <EstadoVazio
            titulo="Ninguém com PIN ainda"
            texto="Entre como Dono com e-mail e senha para definir o seu PIN."
          />
        )}
        {props.usuarios.map((u) => (
          <UnstyledButton
            key={u.id}
            className="ailow-bloco"
            mih={72}
            p="md"
            w="100%"
            onClick={() => props.aoEscolher(u)}
            aria-label={`${u.nome}, ${PERFIL[u.perfil]}${u.bloqueado ? ', bloqueado' : ''}`}
          >
            <Group wrap="nowrap" gap="md">
              <IconUser aria-hidden />
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                {/* Nome inteiro, nunca cortado (D23): quebra de linha em vez de reticências. */}
                <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>{u.nome}</Text>
                <Text size="sm" c="dimmed">{PERFIL[u.perfil]}</Text>
              </Stack>
              {u.bloqueado && (
                <Badge color="red" variant="light" leftSection={<IconLock size={12} aria-hidden />} style={{ flexShrink: 0 }}>
                  Bloqueado
                </Badge>
              )}
            </Group>
          </UnstyledButton>
        ))}
        <Button variant="subtle" onClick={props.aoEntrarComSenha}>Entrar com e-mail e senha</Button>
      </Stack>
    </Moldura>
  );
}
