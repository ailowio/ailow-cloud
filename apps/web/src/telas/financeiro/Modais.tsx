import { useState } from 'react';
import { Alert, Button, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';
import { Modal } from '../../componentes/navegacao';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type { FormaPagamento } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { fecharModal, useAcao } from '../config/comum';
import { FORMAS, mensagemFinanceiro, rotuloForma } from './rotulos';

/** Escolha da forma de pagamento: botões de 48 px; a escolhida ganha cor E o ícone de marcado (não só cor). */
export function EscolhaForma(props: {
  rotulo: string;
  valor: FormaPagamento | null;
  aoMudar: (f: FormaPagamento) => void;
}) {
  return (
    <Stack gap={6} role="group" aria-label={props.rotulo}>
      <Text fw={500}>{props.rotulo}</Text>
      <SimpleGrid cols={3} spacing="xs">
        {FORMAS.map((f) => {
          const marcada = props.valor === f;
          return (
            <Button
              key={f}
              h={48}
              px={4}
              fz={15}
              variant={marcada ? 'filled' : 'default'}
              aria-pressed={marcada}
              leftSection={marcada ? <IconCheck size={16} aria-hidden /> : undefined}
              onClick={() => props.aoMudar(f)}
            >
              {rotuloForma(f)}
            </Button>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <Alert color="red" icon={<IconAlertCircle />} role="alert">
      {texto}
    </Alert>
  );
}

/** RF-FIN-03: marcar como pago, com confirmação que repete o que está sendo pago. */
export function PagarModal(props: {
  api: Api;
  conta: { id: string; descricao: string | null; valor_centavos: number; forma_pagamento: FormaPagamento | null };
  aoFechar: () => void;
  aoPago: () => void;
}) {
  const { conta } = props;
  // Se a conta já tinha forma prevista, ela vem marcada; senão a pessoa precisa escolher (o registro tem de ser verdadeiro).
  const [forma, setForma] = useState<FormaPagamento | null>(conta.forma_pagamento);
  const { pendente, erro, rodar } = useAcao(mensagemFinanceiro);

  async function confirmar() {
    if (!forma) return;
    if (await rodar(() => props.api.pagar(conta.id, forma), 'Conta paga')) props.aoPago();
  }

  return (
    <Modal opened onClose={props.aoFechar} title="Marcar como pago?" centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {conta.descricao ?? 'Conta'}
          </Text>
          <Text fz="xl">
            <Valor centavos={conta.valor_centavos} destaque />
          </Text>
        </Stack>
        <EscolhaForma rotulo="Como foi pago?" valor={forma} aoMudar={setForma} />
        {erro && <Erro texto={erro} />}
        <Button h={48} onClick={() => void confirmar()} loading={pendente} disabled={!forma}>
          Confirmar pagamento
        </Button>
        <Button h={48} variant="default" onClick={props.aoFechar} disabled={pendente}>
          Voltar
        </Button>
      </Stack>
    </Modal>
  );
}

/**
 * RF-FIN-04: estornar exige motivo e explica que nada é apagado (RN-06).
 * Com `venda`, estorna a VENDA INTEIRA (todos os pagamentos dela de uma vez, RN-08): `alvo.valor_centavos` é a soma
 * dos pagamentos que serão estornados e `venda.pagamentos` diz quantos são.
 */
export function EstornarModal(props: {
  api: Api;
  titulo: string;
  alvo: { id: string; descricao: string; valor_centavos: number };
  venda?: { id: string; pagamentos: number };
  aoFechar: () => void;
  aoEstornado: () => void;
}) {
  const { alvo, venda } = props;
  const [motivo, setMotivo] = useState('');
  const { pendente, erro, rodar } = useAcao(mensagemFinanceiro);
  const valido = motivo.trim().length >= 3;

  async function confirmar() {
    if (!valido) return;
    const enviar = () => (venda ? props.api.estornarVenda(venda.id, motivo.trim()) : props.api.estornar(alvo.id, motivo.trim()));
    if (await rodar(enviar, venda ? 'Venda estornada' : 'Estorno feito')) props.aoEstornado();
  }

  return (
    <Modal opened onClose={props.aoFechar} title={props.titulo} centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {alvo.descricao}
          </Text>
          <Text fz="xl">
            <Valor centavos={alvo.valor_centavos} destaque />
          </Text>
        </Stack>
        {venda && (
          <Text size="sm" fw={600}>
            {venda.pagamentos > 1
              ? `Esta venda foi paga em ${venda.pagamentos} formas. Todas serão estornadas de uma vez, no valor total acima.`
              : 'O pagamento desta venda será estornado.'}
          </Text>
        )}
        <Text size="sm" c="dimmed">
          Nada é apagado: o lançamento fica no histórico e é criado um lançamento inverso, com o seu motivo.
        </Text>
        <Textarea
          label="Motivo"
          required
          size="lg"
          autosize
          minRows={2}
          maxLength={200}
          placeholder="Ex.: cobrado em duplicidade"
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
        />
        {erro && <Erro texto={erro} />}
        <Button h={48} color="red" onClick={() => void confirmar()} loading={pendente} disabled={!valido}>
          {venda ? 'Estornar venda' : 'Estornar'}
        </Button>
        <Button h={48} variant="default" onClick={props.aoFechar} disabled={pendente}>
          Voltar
        </Button>
      </Stack>
    </Modal>
  );
}
