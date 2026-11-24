import { useState } from 'react';
import { Alert, Box, Button, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { MAX_CORES_POR_PRODUTO, MAX_SKUS_POR_PRODUTO, chaveCor } from '@ailow/shared/puro';
import { type Combinacao, amostraDaCor, gruposDeTamanho } from './grade';

// S10: a antiga etapa "Tamanhos e cores" virou três passos curtos: Tamanhos, Cores e a grade resultante.
// Os chips são botões de alternância (aria-pressed): marcado = tinta da marca, borda forte e check.
// ADR 017: os tamanhos e as cores oferecidos vêm da configuração da empresa (só os ativos), mais os digitados agora.

const TITULOS_DE_GRUPO: Record<string, string> = {
  letras: 'Letras',
  sutia: 'Numeração (sutiã)',
  unico: 'Tamanho único',
  outros: 'Outros',
};
const ROTULO_DO_GRUPO: Record<string, string> = { outros: 'Outros tamanhos' };

/** Chip selecionável de 48 px; marcado não depende só da cor (check + borda mais grossa). */
function Chip(props: { rotulo: string; marcado: boolean; aoTocar: () => void; amostra?: string | null; comAmostra?: boolean }) {
  return (
    <Button
      h={48}
      px={6}
      variant={props.marcado ? 'light' : 'default'}
      aria-pressed={props.marcado}
      data-chip={props.marcado ? 'marcado' : 'livre'}
      onClick={props.aoTocar}
      style={props.marcado ? { borderWidth: 2, borderColor: 'var(--ailow-acao)' } : undefined}
      leftSection={
        props.comAmostra ? (
          <Box
            data-amostra-cor
            aria-hidden
            w={20}
            h={20}
            style={{
              borderRadius: '50%',
              background: props.amostra ?? 'transparent',
              border: props.amostra ? '1px solid var(--ailow-borda)' : '1px dashed var(--ailow-apagado)',
            }}
          />
        ) : props.marcado ? (
          <IconCheck size={16} aria-hidden />
        ) : undefined
      }
      rightSection={props.comAmostra && props.marcado ? <IconCheck size={16} aria-hidden /> : undefined}
      styles={{ label: { overflowWrap: 'anywhere' } }}
    >
      {props.rotulo}
    </Button>
  );
}

export function PassoTamanhos(props: {
  /** Tamanhos ATIVOS da configuração da empresa (ADR 017). */
  disponiveis: string[];
  tamanhos: string[];
  extras: string[];
  aoAlternar: (t: string) => void;
  aoAdicionar: (t: string) => void;
}) {
  const [outro, setOutro] = useState('');
  return (
    <Stack gap="lg" data-passo="tamanhos">
      <Text size="sm" c="dimmed">
        Toque em todos os tamanhos que esta peça tem.
      </Text>
      {gruposDeTamanho(props.disponiveis, props.extras).map((g) => (
        <Stack key={g.id} gap="xs" role="group" aria-label={ROTULO_DO_GRUPO[g.id] ?? TITULOS_DE_GRUPO[g.id] ?? g.id}>
          <Text fw={600}>{TITULOS_DE_GRUPO[g.id] ?? g.id}</Text>
          <SimpleGrid cols={4} spacing="xs">
            {g.tamanhos.map((t) => (
              <Chip key={t} rotulo={t} marcado={props.tamanhos.includes(t)} aoTocar={() => props.aoAlternar(t)} />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
      <Group wrap="nowrap" align="flex-end" gap="xs">
        <TextInput
          label="Outro tamanho"
          size="lg"
          maxLength={3}
          autoComplete="off"
          placeholder="Ex.: G1"
          style={{ flex: 1 }}
          value={outro}
          onChange={(e) => setOutro(e.currentTarget.value)}
        />
        <Button
          h={50}
          variant="light"
          disabled={outro.trim() === ''}
          onClick={() => {
            props.aoAdicionar(outro);
            setOutro('');
          }}
        >
          Incluir
        </Button>
      </Group>
      <Text fw={600} role="status">
        {props.tamanhos.length === 0
          ? 'Escolha ao menos um tamanho.'
          : `${props.tamanhos.length} ${props.tamanhos.length === 1 ? 'tamanho escolhido' : 'tamanhos escolhidos'}`}
      </Text>
    </Stack>
  );
}

export function PassoCores(props: {
  /** Cores ATIVAS da configuração da empresa, com a amostra (ADR 017). */
  disponiveis: { nome: string; amostra: string | null }[];
  cores: string[];
  extras: string[];
  aoAlternar: (c: string) => void;
  aoAdicionar: (c: string) => void;
}) {
  const [outra, setOutra] = useState('');
  const amostras = new Map(props.disponiveis.map((c) => [chaveCor(c.nome), c.amostra]));
  const conhecidas = new Set(amostras.keys());
  const todas = [...props.disponiveis.map((c) => c.nome), ...props.extras.filter((e) => !conhecidas.has(chaveCor(e)))];
  return (
    <Stack gap="lg" data-passo="cores">
      <Text size="sm" c="dimmed">
        Toque em todas as cores que esta peça tem (até {MAX_CORES_POR_PRODUTO}).
      </Text>
      <SimpleGrid cols={2} spacing="xs" role="group" aria-label="Cores">
        {todas.map((c) => (
          <Chip
            key={c}
            rotulo={c}
            comAmostra
            amostra={amostras.get(chaveCor(c)) ?? amostraDaCor(c)}
            marcado={props.cores.some((x) => x.toLowerCase() === c.toLowerCase())}
            aoTocar={() => props.aoAlternar(c)}
          />
        ))}
      </SimpleGrid>
      <Group wrap="nowrap" align="flex-end" gap="xs">
        <TextInput
          label="Outra cor"
          size="lg"
          maxLength={30}
          autoComplete="off"
          placeholder="Ex.: Rosa chá"
          style={{ flex: 1 }}
          value={outra}
          onChange={(e) => setOutra(e.currentTarget.value)}
        />
        <Button
          h={50}
          variant="light"
          disabled={outra.trim() === ''}
          onClick={() => {
            props.aoAdicionar(outra);
            setOutra('');
          }}
        >
          Incluir
        </Button>
      </Group>
      <Text fw={600} role="status">
        {props.cores.length === 0
          ? 'Escolha ao menos uma cor.'
          : `${props.cores.length} ${props.cores.length === 1 ? 'cor escolhida' : 'cores escolhidas'}`}
      </Text>
    </Stack>
  );
}

/** Passo de eixo extra (ex.: Taça): chips marca/desmarca, mesma metáfora de tamanhos. */
export function PassoEixoExtra(props: {
  nome: string;
  disponiveis: readonly string[];
  escolhidos: readonly string[];
  aoAlternar: (valor: string) => void;
}) {
  return (
    <Stack gap="lg" data-passo={`eixo-${props.nome}`}>
      <Text size="sm" c="dimmed">
        Toque em todos os valores de {props.nome.toLowerCase()} que esta peça tem.
      </Text>
      <SimpleGrid cols={4} spacing="xs" role="group" aria-label={props.nome}>
        {props.disponiveis.map((v) => (
          <Chip key={v} rotulo={v} marcado={props.escolhidos.includes(v)} aoTocar={() => props.aoAlternar(v)} />
        ))}
      </SimpleGrid>
      <Text fw={600} role="status">
        {props.escolhidos.length === 0
          ? `Escolha ao menos um valor de ${props.nome.toLowerCase()}.`
          : `${props.escolhidos.length} escolhido${props.escolhidos.length === 1 ? '' : 's'}`}
      </Text>
    </Stack>
  );
}

/** Passo de conferência: a grade (tamanho × cor × extras) que vira uma peça (SKU) cada. Só leitura. */
export function PassoGrade(props: { grade: Combinacao[]; tamanhos: string[]; cores: string[] }) {
  const total = props.grade.length;
  const fatorExtra = props.tamanhos.length * props.cores.length > 0 ? Math.max(1, total / (props.tamanhos.length * props.cores.length)) : 1;
  const dims =
    fatorExtra > 1
      ? `${props.tamanhos.length} × ${props.cores.length} × ${fatorExtra}`
      : `${props.tamanhos.length} × ${props.cores.length}`;
  return (
    <Stack gap="md" data-passo="grade">
      <Text fw={600} role="status">
        {total} {total === 1 ? 'variação' : 'variações'} ({dims})
      </Text>
      <Text size="sm" c="dimmed">
        Cada combinação é uma peça com código próprio. Para mudar, toque em Voltar.
      </Text>
      <Stack gap={6}>
        {props.grade.map((g) => (
          <Text key={g.chave} component="span" px="xs" py={4} className="ailow-bloco" fz="sm" fw={600} style={{ borderRadius: 8 }}>
            {[g.tamanho, g.cor, ...g.extras.map((e) => e.valor)].join(' · ')}
          </Text>
        ))}
      </Stack>
      {total > MAX_SKUS_POR_PRODUTO && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          O máximo é {MAX_SKUS_POR_PRODUTO} variações por produto. Volte e tire alguns tamanhos, cores ou eixos.
        </Alert>
      )}
    </Stack>
  );
}
