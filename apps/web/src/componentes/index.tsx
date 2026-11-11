import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Badge, Box, Button, Group, Indicator, Progress, SimpleGrid, Stack, Text, UnstyledButton,
} from '@mantine/core';
import { IconBackspace } from '@tabler/icons-react';
import { formatarReais } from '../lib/dinheiro';

/** Quadrado da tela inicial: 1 palavra, ícone grande, selo de alerta opcional. */
export function BlocoAcao(props: { rotulo: string; icone: ReactNode; destaque?: boolean; alerta?: number; onClick?: () => void }) {
  const { rotulo, icone, destaque, alerta, onClick } = props;
  return (
    <Indicator label={alerta} disabled={!alerta} color="red" size={22} offset={10} zIndex={2}>
      <UnstyledButton className="ailow-bloco" data-destaque={destaque ? 'true' : 'false'} onClick={onClick} mih={104} w="100%" p="sm">
        <Stack align="center" gap={10}>
          <Box c={destaque ? '#fff' : 'var(--ailow-primario-texto)'} lh={0}>{icone}</Box>
          <Text fw={650} size="sm">{rotulo}</Text>
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
    <Text span fw={destaque ? 700 : 550} c={destaque ? 'var(--ailow-laranja-texto)' : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatarReais(centavos)}
    </Text>
  );
}

/** ok (neutro) | baixo (âmbar) | zerado (vermelho). */
export function SeloEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  if (atual <= 0) return <Badge color="red">Zerado</Badge>;
  if (atual <= minimo) return <Badge color="ambar">Baixo · {atual}</Badge>;
  return <Badge color="gray" variant="light">{atual} em estoque</Badge>;
}

/** Nunca tela vazia muda: diz o que vai aparecer e oferece a ação. */
export function EstadoVazio(props: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) {
  return (
    <Stack align="center" gap="xs" py="xl" className="ailow-cartao" px="md">
      <Text fw={650}>{props.titulo}</Text>
      <Text c="dimmed" ta="center" size="sm">{props.texto}</Text>
      {props.acao && <Button onClick={props.onAcao}>{props.acao}</Button>}
    </Stack>
  );
}

/** Teclado numérico do PIN: 4 pontos de progresso em laranja (destaque), teclas de 64 px. */
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
          <Box
            key={i}
            w={16}
            h={16}
            style={{
              borderRadius: '50%',
              border: '2px solid var(--mantine-color-coral-5)',
              background: i < pin.length ? 'var(--mantine-color-coral-5)' : 'transparent',
              boxShadow: i < pin.length ? '0 0 10px var(--mantine-color-coral-5)' : 'none',
            }}
          />
        ))}
      </Group>
      <SimpleGrid cols={3} spacing="sm" w="100%" maw={320}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((k) =>
          k === '' ? <span key="vazio" /> : k === '<' ? (
            <ActionIcon key={k} h={64} w="100%" variant="default" className="ailow-bloco" aria-label="Apagar" onClick={() => setPin(pin.slice(0, -1))}>
              <IconBackspace />
            </ActionIcon>
          ) : (
            <Button key={k} h={64} variant="default" className="ailow-bloco" fz={24} fw={600} onClick={() => tecla(k)}>{k}</Button>
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
    <Stack gap="sm" p="md" className="ailow-cartao">
      {props.itens.map((i) => (
        <Stack key={i.codigo} gap={6} pb="sm" style={{ borderBottom: '1px solid var(--ailow-borda)' }}>
          {/* Nome nunca é truncado: o vendedor precisa saber o que está no carrinho. */}
          <Text fw={600} style={{ overflowWrap: 'anywhere' }}>{i.nome}</Text>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="sm" c="dimmed">{i.detalhe}</Text>
            <Group gap={4} wrap="nowrap">
              <ActionIcon variant="default" size={44} aria-label={`Menos ${i.nome}`} onClick={() => props.onMudar(i.codigo, -1)}>−</ActionIcon>
              <Text w={28} ta="center" fw={650}>{i.qtd}</Text>
              <ActionIcon variant="default" size={44} aria-label={`Mais ${i.nome}`} onClick={() => props.onMudar(i.codigo, 1)}>+</ActionIcon>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{i.qtd} × <Valor centavos={i.precoCentavos} /></Text>
            <Valor centavos={i.precoCentavos * i.qtd} />
          </Group>
        </Stack>
      ))}
      <Group justify="space-between" pt={4}>
        <Text fz="lg" fw={700}>Total</Text>
        <Text fz="lg"><Valor centavos={total} destaque /></Text>
      </Group>
    </Stack>
  );
}

/** Etapas: uma decisão por tela. No celular mostra "Passo N de M" + barra (cabe em 360 px). */
export function Etapas(props: { passos: { titulo: string; conteudo: ReactNode }[] }) {
  const [ativo, setAtivo] = useState(0);
  const total = props.passos.length;
  const ultimo = ativo === total - 1;
  return (
    <Stack gap="sm" p="md" className="ailow-cartao">
      <Group justify="space-between" gap="xs">
        <Text fw={650}>{props.passos[ativo].titulo}</Text>
        <Text size="sm" c="dimmed">Passo {ativo + 1} de {total}</Text>
      </Group>
      <Progress value={((ativo + 1) / total) * 100} size="sm" aria-label={`Passo ${ativo + 1} de ${total}`} />
      <Box py="sm">{props.passos[ativo].conteudo}</Box>
      <Group grow>
        <Button variant="default" disabled={ativo === 0} onClick={() => setAtivo(ativo - 1)}>Voltar</Button>
        <Button onClick={() => setAtivo(ultimo ? 0 : ativo + 1)}>{ultimo ? 'Salvar' : 'Continuar'}</Button>
      </Group>
    </Stack>
  );
}
