import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, Indicator, SimpleGrid, Stack, Stepper, Text, ThemeIcon, UnstyledButton,
} from '@mantine/core';
import { IconBackspace } from '@tabler/icons-react';
import { formatarReais } from '../lib/dinheiro';

/** Quadrado da tela inicial: 1 palavra, ícone grande, selo de alerta opcional. */
export function BlocoAcao(props: { rotulo: string; icone: ReactNode; destaque?: boolean; alerta?: number; onClick?: () => void }) {
  const { rotulo, icone, destaque, alerta, onClick } = props;
  return (
    <Indicator label={alerta} disabled={!alerta} color="red" size={22} offset={10}>
      <UnstyledButton
        onClick={onClick}
        mih={104}
        w="100%"
        p="sm"
        bg={destaque ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-default)'}
        c={destaque ? 'var(--mantine-primary-color-contrast)' : undefined}
        style={{ borderRadius: 'var(--mantine-radius-md)', border: '1px solid var(--mantine-color-default-border)' }}
      >
        <Stack align="center" gap={8}>
          <ThemeIcon variant="transparent" size={36} color="inherit">{icone}</ThemeIcon>
          <Text fw={600}>{rotulo}</Text>
        </Stack>
      </UnstyledButton>
    </Indicator>
  );
}

/** Grade fixa de 3 colunas (RNF-05). */
export function GradeModulos({ children }: { children: ReactNode }) {
  return <SimpleGrid cols={3} spacing="sm">{children}</SimpleGrid>;
}

/** Valor em reais, a partir de centavos inteiros. */
export function Valor({ centavos, destaque }: { centavos: number; destaque?: boolean }) {
  return (
    <Text span fw={destaque ? 700 : 500} c={destaque ? 'ouro.7' : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatarReais(centavos)}
    </Text>
  );
}

/** ok (neutro) | baixo (alerta) | zerado (perigo). */
export function SeloEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  if (atual <= 0) return <Badge color="red">Zerado</Badge>;
  if (atual <= minimo) return <Badge color="yellow" c="dark">Baixo · {atual}</Badge>;
  return <Badge color="gray" variant="light">{atual} em estoque</Badge>;
}

/** Nunca tela vazia muda: diz o que vai aparecer e oferece a ação. */
export function EstadoVazio(props: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) {
  return (
    <Stack align="center" gap="xs" py="xl">
      <Text fw={600}>{props.titulo}</Text>
      <Text c="dimmed" ta="center" size="sm">{props.texto}</Text>
      {props.acao && <Button onClick={props.onAcao}>{props.acao}</Button>}
    </Stack>
  );
}

/** Teclado numérico do PIN: 4 pontos de progresso, teclas de 64 px. */
export function TecladoPin({ onCompleto }: { onCompleto: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const tecla = (k: string) => {
    const novo = pin + k;
    if (novo.length > 4) return;
    if (novo.length === 4) { setPin(''); onCompleto(novo); return; }
    setPin(novo);
  };
  return (
    <Stack align="center" gap="md">
      <Group gap="md" aria-label={`${pin.length} de 4 dígitos`}>
        {[0, 1, 2, 3].map((i) => (
          <ThemeIcon key={i} size={16} radius="xl" variant={i < pin.length ? 'filled' : 'outline'} />
        ))}
      </Group>
      <SimpleGrid cols={3} spacing="sm" w="100%" maw={320}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((k) =>
          k === '' ? <span key="vazio" /> : k === '<' ? (
            <ActionIcon key={k} h={64} w="100%" variant="default" aria-label="Apagar" onClick={() => setPin(pin.slice(0, -1))}>
              <IconBackspace />
            </ActionIcon>
          ) : (
            <Button key={k} h={64} variant="default" fz={24} onClick={() => tecla(k)}>{k}</Button>
          ),
        )}
      </SimpleGrid>
    </Stack>
  );
}

/** Carrinho: itens, quantidade e total em centavos. */
export interface ItemCarrinho { codigo: string; nome: string; detalhe: string; precoCentavos: number; qtd: number }
export function Carrinho(props: { itens: ItemCarrinho[]; onMudar: (codigo: string, delta: number) => void }) {
  const total = props.itens.reduce((a, i) => a + i.precoCentavos * i.qtd, 0);
  if (props.itens.length === 0) {
    return <EstadoVazio titulo="Carrinho vazio" texto="Escaneie uma peça para começar." />;
  }
  return (
    <Card withBorder>
      <Stack gap="sm">
        {props.itens.map((i) => (
          <Group key={i.codigo} wrap="nowrap" justify="space-between">
            <div style={{ minWidth: 0 }}>
              <Text truncate>{i.nome}</Text>
              <Text size="sm" c="dimmed">{i.detalhe}</Text>
            </div>
            <Group gap={4} wrap="nowrap">
              <ActionIcon variant="default" size={44} aria-label="Menos" onClick={() => props.onMudar(i.codigo, -1)}>−</ActionIcon>
              <Text w={24} ta="center" fw={600}>{i.qtd}</Text>
              <ActionIcon variant="default" size={44} aria-label="Mais" onClick={() => props.onMudar(i.codigo, 1)}>+</ActionIcon>
            </Group>
            <Valor centavos={i.precoCentavos * i.qtd} />
          </Group>
        ))}
        <Group justify="space-between">
          <Text fz="lg" fw={700}>Total</Text>
          <Text fz="lg"><Valor centavos={total} destaque /></Text>
        </Group>
      </Stack>
    </Card>
  );
}

/** Etapas: uma decisão por tela (cadastro de produto, fechamento). */
export function Etapas(props: { passos: { titulo: string; conteudo: ReactNode }[] }) {
  const [ativo, setAtivo] = useState(0);
  const ultimo = ativo === props.passos.length - 1;
  return (
    <Stack>
      <Stepper active={ativo} size="sm" iconSize={28}>
        {props.passos.map((p) => <Stepper.Step key={p.titulo} label={p.titulo}>{p.conteudo}</Stepper.Step>)}
      </Stepper>
      <Group grow>
        <Button variant="default" disabled={ativo === 0} onClick={() => setAtivo(ativo - 1)}>Voltar</Button>
        <Button onClick={() => setAtivo(ultimo ? 0 : ativo + 1)}>{ultimo ? 'Salvar' : 'Continuar'}</Button>
      </Group>
    </Stack>
  );
}
