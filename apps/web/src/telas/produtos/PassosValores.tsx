import { ActionIcon, Alert, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertTriangle, IconMinus, IconPlus } from '@tabler/icons-react';
import { formatarReais } from '../../lib/dinheiro';
import { CampoDinheiro } from './CampoDinheiro';
import { ajustarMarkupBps, bpsParaTexto, markupBpsDoPreco, percentualParaBps, precoPorMarkup } from './valores-produto';

/** Passo "Quanto custou?": custo em destaque e o fornecedor (opcional), só o que é do custo. */
export function PassoCusto(props: {
  custo: number | null;
  aoMudarCusto: (c: number | null) => void;
  fornecedor: string;
  aoMudarFornecedor: (f: string) => void;
}) {
  return (
    <Stack gap="lg" data-passo="custo">
      <CampoDinheiro label="Custo de cada peça" valor={props.custo} aoMudar={props.aoMudarCusto} descricao="Quanto você pagou em cada peça. Só o Dono vê." />
      <TextInput
        label="Fornecedor (opcional)"
        size="lg"
        maxLength={80}
        placeholder="Ex.: Fina Paixão"
        value={props.fornecedor}
        onChange={(e) => props.aoMudarFornecedor(e.currentTarget.value)}
      />
    </Stack>
  );
}

const PASSO_MARKUP_BPS = 500; // os botões − e + andam de 5 em 5 pontos percentuais

/**
 * Passo "Por quanto vende?": preço em destaque e markup editável. Editar o markup recalcula o preço (sobre o
 * custo) e editar o preço recalcula o markup. Com custo zero não há base para o percentual: só vale o preço.
 */
export function PassoPreco(props: {
  custo: number;
  preco: number | null;
  markupTexto: string;
  aoMudarPreco: (preco: number | null, markupTexto: string) => void;
  aoMudarMarkup: (markupTexto: string, preco: number | null) => void;
}) {
  const semBase = props.custo <= 0;
  const bps = percentualParaBps(props.markupTexto);
  const markupInvalido = !semBase && props.markupTexto.trim() !== '' && bps === null;
  const abaixo = props.preco !== null && props.preco > 0 && props.preco < props.custo;
  const lucro = props.preco !== null && props.preco > props.custo ? props.preco - props.custo : null;

  function digitouMarkup(texto: string) {
    const limpo = texto.replace(/[^\d.,]/g, '').slice(0, 9);
    const novoBps = percentualParaBps(limpo);
    props.aoMudarMarkup(limpo, novoBps === null ? props.preco : precoPorMarkup(props.custo, novoBps));
  }

  function ajustar(delta: number) {
    const novo = ajustarMarkupBps(bps ?? 0, delta);
    props.aoMudarMarkup(bpsParaTexto(novo), precoPorMarkup(props.custo, novo));
  }

  return (
    <Stack gap="lg" data-passo="preco">
      <CampoDinheiro
        label="Preço de venda"
        valor={props.preco}
        aoMudar={(p) => {
          const novo = markupBpsDoPreco(props.custo, p);
          props.aoMudarPreco(p, novo === null ? props.markupTexto : bpsParaTexto(novo));
        }}
        descricao={`Custo: ${formatarReais(props.custo)} por peça`}
      />

      <Stack gap={6}>
        <TextInput
          label="Markup (%)"
          size="lg"
          inputMode="decimal"
          autoComplete="off"
          disabled={semBase}
          value={semBase ? '' : props.markupTexto}
          placeholder={semBase ? '—' : '0'}
          onChange={(e) => digitouMarkup(e.currentTarget.value)}
          error={markupInvalido ? 'Escreva só números, por exemplo 80 ou 35,5.' : undefined}
          description={semBase ? 'Com custo zero não há markup: digite o preço.' : 'Ganho sobre o custo. Mude um e o outro acerta.'}
          leftSection={
            <ActionIcon variant="default" size={48} aria-label="Menos 5 pontos de markup" disabled={semBase} onClick={() => ajustar(-PASSO_MARKUP_BPS)}>
              <IconMinus aria-hidden />
            </ActionIcon>
          }
          leftSectionPointerEvents="all"
          leftSectionWidth={56}
          rightSection={
            <ActionIcon variant="default" size={48} aria-label="Mais 5 pontos de markup" disabled={semBase} onClick={() => ajustar(PASSO_MARKUP_BPS)}>
              <IconPlus aria-hidden />
            </ActionIcon>
          }
          rightSectionPointerEvents="all"
          rightSectionWidth={56}
          styles={{ input: { textAlign: 'center', fontWeight: 700, fontSize: 22 } }}
        />
      </Stack>

      {lucro !== null && (
        <Text role="status">
          Você ganha <strong>{formatarReais(lucro)}</strong> em cada peça.
        </Text>
      )}
      {abaixo && (
        <Alert color="ambar" icon={<IconAlertTriangle />} role="status">
          O preço está abaixo do custo: cada peça vendida dá prejuízo.
        </Alert>
      )}
    </Stack>
  );
}
