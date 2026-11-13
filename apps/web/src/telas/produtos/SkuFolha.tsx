import { useState } from 'react';
import { Alert, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { Modal } from '../../componentes/navegacao';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type { AjusteEstoque } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { SeloEstoque } from '../../componentes';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { inteiroOuNulo } from './grade';
import { QrSku } from './QrSku';
import { dataHoraCurta, mensagemProdutos, rotuloMovimento, sinalDaQuantidade } from './rotulos';

/** O SKU aberto na folha. O mínimo só existe para o Dono (RF-PRO-07 pede ao Vendedor só produto, preço e estoque). */
export interface SkuAberto {
  id: string;
  codigo: string;
  produto: string;
  tamanho: string;
  cor: string;
  estoque: number;
  estoque_minimo?: number;
}

type Acao = 'chegou' | 'mais' | 'tirar';

const ACOES: { id: Acao; rotulo: string; sugestoes: string[] }[] = [
  { id: 'chegou', rotulo: 'Chegou mercadoria (+)', sugestoes: ['Chegou pedido', 'Reposição'] },
  { id: 'mais', rotulo: 'Ajustar para mais (+)', sugestoes: ['Contagem', 'Devolução'] },
  { id: 'tirar', rotulo: 'Tirar do estoque (−)', sugestoes: ['Peça com defeito', 'Perda', 'Contagem'] },
];

/** Corpo do contrato (RF-PRO-04): entrada é sempre positiva; ajuste leva o sinal. */
function ajusteDe(acao: Acao, quantidade: number, motivo: string): AjusteEstoque {
  if (acao === 'chegou') return { tipo: 'entrada', quantidade, motivo: motivo.trim() };
  return { tipo: 'ajuste', quantidade: acao === 'tirar' ? -quantidade : quantidade, motivo: motivo.trim() };
}

/**
 * Folha do SKU: código e QR (RF-PRO-02) para todos; o Dono também lança entrada/ajuste com motivo (RF-PRO-04)
 * e vê o histórico com o autor. Tela cheia no celular.
 */
export function SkuFolha(props: {
  api: Api;
  dono: boolean;
  sku: SkuAberto;
  aoFechar: () => void;
  // Avisa a lista que o saldo mudou (ela recarrega ao fechar a folha).
  aoMudar: () => void;
}) {
  const [estoque, setEstoque] = useState(props.sku.estoque);
  const [mudou, setMudou] = useState(false);
  const { sku } = props;

  function fechar() {
    if (mudou) props.aoMudar();
    props.aoFechar();
  }

  return (
    <Modal opened onClose={fechar} title="Peça" fullScreen closeButtonProps={fecharModal}>
      <Stack gap="lg">
        <Stack gap={2}>
          <Text fw={700} fz="xl" style={{ overflowWrap: 'anywhere' }}>
            {sku.produto}
          </Text>
          <Text c="dimmed">
            Tamanho {sku.tamanho} · {sku.cor}
          </Text>
        </Stack>

        <Stack align="center" gap="xs" className="ailow-cartao" p="md">
          <QrSku codigo={sku.codigo} />
          <Text ff="monospace" fw={700} fz={22} aria-label={`Código ${sku.codigo}`}>
            {sku.codigo}
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Este é o código da peça. A etiqueta com QR sai na próxima versão.
          </Text>
        </Stack>

        <Group justify="space-between" wrap="wrap">
          <Text fw={600}>No estoque agora</Text>
          <Group gap="xs">
            <Text fw={700} fz="xl" aria-live="polite">
              {estoque}
            </Text>
            {props.dono && sku.estoque_minimo !== undefined && <SeloEstoque atual={estoque} minimo={sku.estoque_minimo} />}
            {!props.dono && estoque <= 0 && <SeloEstoque atual={estoque} minimo={0} />}
          </Group>
        </Group>
        {props.dono && sku.estoque_minimo !== undefined && <Text size="sm" c="dimmed">Mínimo definido: {sku.estoque_minimo}</Text>}

        {props.dono && (
          <>
            <AjusteForm
              key={estoque}
              api={props.api}
              skuId={sku.id}
              estoque={estoque}
              aoAjustar={(novo) => {
                setEstoque(novo);
                setMudou(true);
              }}
            />
            <Historico key={`h-${estoque}`} api={props.api} skuId={sku.id} />
          </>
        )}

        <Button h={48} variant="default" onClick={fechar}>
          Fechar
        </Button>
      </Stack>
    </Modal>
  );
}

function AjusteForm(props: { api: Api; skuId: string; estoque: number; aoAjustar: (novo: number) => void }) {
  const [acao, setAcao] = useState<Acao>('chegou');
  const [quantidadeTexto, setQuantidadeTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  const { pendente, erro, rodar } = useAcao(mensagemProdutos);

  const quantidade = inteiroOuNulo(quantidadeTexto);
  const valida = quantidade !== null && quantidade > 0;
  const ficaria = valida ? props.estoque + (acao === 'tirar' ? -quantidade : quantidade) : null;
  const negativo = ficaria !== null && ficaria < 0;
  const pronto = valida && !negativo && motivo.trim().length >= 3;
  const sugestoes = ACOES.find((a) => a.id === acao)?.sugestoes ?? [];

  async function registrar() {
    if (!pronto || quantidade === null) return;
    const corpo = ajusteDe(acao, quantidade, motivo);
    let novo = props.estoque;
    const ok = await rodar(async () => {
      novo = (await props.api.ajustarEstoque(props.skuId, corpo)).estoque;
    }, 'Estoque atualizado');
    if (ok) props.aoAjustar(novo);
  }

  return (
    <Stack gap="md" className="ailow-cartao" p="md">
      <Text fw={650} fz="lg">
        Mexer no estoque
      </Text>
      <Stack gap="xs" role="group" aria-label="O que aconteceu?">
        {ACOES.map((a) => {
          const marcada = acao === a.id;
          return (
            <Button
              key={a.id}
              h={48}
              variant={marcada ? 'filled' : 'default'}
              aria-pressed={marcada}
              leftSection={marcada ? <IconCheck size={16} aria-hidden /> : undefined}
              onClick={() => setAcao(a.id)}
            >
              {a.rotulo}
            </Button>
          );
        })}
      </Stack>
      <TextInput
        label="Quantas peças?"
        size="lg"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Ex.: 5"
        value={quantidadeTexto}
        onChange={(e) => setQuantidadeTexto(e.currentTarget.value)}
        error={
          quantidadeTexto.trim() !== '' && !valida
            ? 'Escreva só números inteiros, de 1 a 100.000.'
            : negativo
              ? `Só há ${props.estoque} no estoque: não dá para tirar ${quantidade}.`
              : undefined
        }
        description={ficaria !== null && !negativo ? `Vai ficar com ${ficaria}` : undefined}
      />
      <TextInput
        label="Motivo"
        size="lg"
        maxLength={200}
        placeholder="Diga o que aconteceu"
        value={motivo}
        onChange={(e) => setMotivo(e.currentTarget.value)}
      />
      <Group gap="xs">
        {sugestoes.map((s) => (
          <Button key={s} h={48} variant="default" fz={15} onClick={() => setMotivo(s)}>
            {s}
          </Button>
        ))}
      </Group>
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} onClick={() => void registrar()} loading={pendente} disabled={!pronto}>
        Registrar
      </Button>
    </Stack>
  );
}

function Historico({ api, skuId }: { api: Api; skuId: string }) {
  const { carga, tentarDeNovo } = useCarregar(() => api.movimentos(skuId).then((r) => r.movimentos));
  return (
    <Stack gap="xs">
      <Text fw={650} fz="lg">
        Histórico
      </Text>
      {carga.fase === 'carregando' && <Carregando linhas={2} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.length === 0 && <Text c="dimmed">Ainda não há movimentos.</Text>}
      {carga.fase === 'pronto' &&
        carga.dados.map((m) => (
          <Stack key={m.id} gap={2} pb="xs" style={{ borderBottom: '1px solid var(--ailow-borda)' }}>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {sinalDaQuantidade(m.quantidade)} · {rotuloMovimento(m.tipo)}
            </Text>
            <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
              {m.motivo}
            </Text>
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              Ficou com {m.saldo_apos} · {m.autor_nome} · {dataHoraCurta(m.criado_em)}
            </Text>
          </Stack>
        ))}
    </Stack>
  );
}
