import { useState } from 'react';
import { Button, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CampoData } from '../../componentes/CampoData';
import { centavosParaTexto } from '../../lib/dinheiro';
import { hojeEmSaoPaulo } from '../../lib/datas';
import {
  MSG_PARCELAS,
  montarParcelasParaApi,
  resumoContasAPagar,
  somarMesesIso,
  type LinhaParcela,
} from './receber-parcelas';

type ParcelaUi = LinhaParcela & { id: string };

function parcelaInicial(totalCentavos: number): ParcelaUi {
  return {
    id: crypto.randomUUID(),
    valorTexto: centavosParaTexto(totalCentavos),
    vencimento: hojeEmSaoPaulo(),
  };
}

/** F02: N parcelas (valor + vencimento) cujo soma fecha o total; resumo "Gera N contas a pagar". */
export function ReceberPedido(props: {
  totalCentavos: number;
  pendente: boolean;
  aoConfirmar: (parcelas: { valor_centavos: number; vencimento: string }[]) => Promise<boolean>;
  aoCancelar: () => void;
}) {
  const [linhas, setLinhas] = useState<ParcelaUi[]>(() => [parcelaInicial(props.totalCentavos)]);

  function atualizar(id: string, parcial: Partial<LinhaParcela>) {
    setLinhas((lista) => lista.map((l) => (l.id === id ? { ...l, ...parcial } : l)));
  }

  async function confirmar() {
    const r = montarParcelasParaApi(
      props.totalCentavos,
      linhas.map(({ valorTexto, vencimento }) => ({ valorTexto, vencimento })),
    );
    if (!r.ok) {
      notifications.show({
        message: MSG_PARCELAS[r.erro],
        color: 'red',
        autoClose: 4500,
        withCloseButton: false,
      });
      return;
    }
    await props.aoConfirmar(r.parcelas);
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Divida o total em parcelas com vencimentos diferentes (pode marcar como pago depois no Financeiro).
      </Text>
      {linhas.map((l, i) => (
        <Stack key={l.id} gap="xs">
          <Text fw={650}>Parcela {i + 1}</Text>
          <TextInput
            label="Valor da parcela"
            size="lg"
            inputMode="decimal"
            autoComplete="off"
            value={l.valorTexto}
            onChange={(e) => atualizar(l.id, { valorTexto: e.currentTarget.value })}
          />
          <CampoData label="Vencimento" value={l.vencimento} onChange={(v) => atualizar(l.id, { vencimento: v })} />
          {linhas.length > 1 && (
            <Button
              h={48}
              variant="default"
              disabled={props.pendente}
              onClick={() => setLinhas((lista) => lista.filter((x) => x.id !== l.id))}
            >
              Remover parcela
            </Button>
          )}
        </Stack>
      ))}
      <Text data-resumo-contas fw={650}>
        {resumoContasAPagar(linhas.length)}
      </Text>
      <Button
        h={48}
        variant="default"
        disabled={props.pendente}
        onClick={() =>
          setLinhas((lista) => [
            ...lista,
            {
              id: crypto.randomUUID(),
              valorTexto: '',
              // API exige vencimentos distintos (pedidoReceberSchema).
              vencimento: somarMesesIso(hojeEmSaoPaulo(), lista.length),
            },
          ])
        }
      >
        Adicionar parcela
      </Button>
      <Button h={48} loading={props.pendente} disabled={props.pendente} onClick={() => void confirmar()}>
        Confirmar recebimento
      </Button>
      <Button h={48} variant="default" disabled={props.pendente} onClick={props.aoCancelar}>
        Cancelar
      </Button>
    </Stack>
  );
}
