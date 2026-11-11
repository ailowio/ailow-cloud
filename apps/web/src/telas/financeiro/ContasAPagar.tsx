import { useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ContaAPagar } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { formatarData } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { EstornarModal, PagarModal } from './Modais';
import { SITUACOES, rotuloSituacao } from './rotulos';

/** RF-FIN-03: contas a pagar por vencimento (vencidas em destaque, hoje, próximos 7 dias) e "marcar como pago". */
export function ContasAPagar({ api, aoNovaDespesa }: { api: Api; aoNovaDespesa: () => void }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.contasAPagar());
  const [pagando, setPagando] = useState<ContaAPagar | null>(null);
  const [cancelando, setCancelando] = useState<ContaAPagar | null>(null);

  // Fecha o modal e busca de novo: se a conta mudou por outro lado (409), a lista já reflete.
  const fechar = () => {
    setPagando(null);
    setCancelando(null);
    void recarregar();
  };

  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;

  const { contas } = carga.dados;
  if (contas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma conta a pagar"
        texto="Quando você lançar uma despesa que ainda não foi paga, ela aparece aqui por ordem de vencimento."
        acao="Nova despesa"
        onAcao={aoNovaDespesa}
      />
    );
  }

  const total = contas.reduce((soma, c) => soma + c.valor_centavos, 0);
  return (
    <Stack gap="lg">
      <Stack gap={2} p="md" className="ailow-cartao">
        <Text c="dimmed">
          Total a pagar ({contas.length} {contas.length === 1 ? 'conta' : 'contas'})
        </Text>
        <Text fz={28} fw={700}>
          <Valor centavos={total} destaque />
        </Text>
      </Stack>

      {SITUACOES.map((situacao) => {
        const doGrupo = contas.filter((c) => c.situacao === situacao);
        if (doGrupo.length === 0) return null;
        return (
          <Stack key={situacao} gap="sm" component="section" aria-label={rotuloSituacao(situacao)}>
            <Group gap={6} wrap="nowrap">
              {situacao === 'vencida' && <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" aria-hidden />}
              <Text fw={700} fz="lg" c={situacao === 'vencida' ? 'red' : undefined}>
                {rotuloSituacao(situacao)} ({doGrupo.length})
              </Text>
            </Group>
            {doGrupo.map((c) => (
              <Stack key={c.id} gap="xs" p="md" className="ailow-cartao">
                <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
                  {c.descricao ?? 'Conta'}
                </Text>
                <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                  {c.categoria ? `${c.categoria} · ` : ''}vence em {formatarData(c.vencimento)}
                </Text>
                <Text fz="xl">
                  <Valor centavos={c.valor_centavos} destaque />
                </Text>
                <Button h={48} onClick={() => setPagando(c)}>
                  Marcar como pago
                </Button>
                <Button h={48} variant="default" onClick={() => setCancelando(c)} aria-label={`Cancelar conta ${c.descricao ?? ''}`}>
                  Cancelar conta
                </Button>
              </Stack>
            ))}
          </Stack>
        );
      })}

      {pagando && <PagarModal api={api} conta={pagando} aoFechar={fechar} aoPago={fechar} />}
      {cancelando && (
        <EstornarModal
          api={api}
          titulo="Cancelar esta conta?"
          alvo={{ id: cancelando.id, descricao: cancelando.descricao ?? 'Conta', valor_centavos: cancelando.valor_centavos }}
          aoFechar={fechar}
          aoEstornado={fechar}
        />
      )}
    </Stack>
  );
}
