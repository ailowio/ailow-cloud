import { useState } from 'react';
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { Modal } from '../../componentes/navegacao';
import { IconAlertCircle, IconBrandWhatsapp } from '@tabler/icons-react';
import type { Venda } from '@ailow/shared';
import { linkComprovanteWhatsApp, textoDoComprovante } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { formatarData } from '../../lib/datas';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { ROTULOS_FORMA, mensagemVenda } from './rotulos';

/** RF-VEN-07/08: comprovante no WhatsApp e na impressora; cancelar devolve o estoque e estorna o caixa. */
export function Comprovante(props: { api: Api; id: string; aoNova: () => void }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.venda(props.id));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Folha api={props.api} venda={carga.dados} aoMudar={() => void recarregar()} aoNova={props.aoNova} />;
}

function Folha(props: { api: Api; venda: Venda; aoMudar: () => void; aoNova: () => void }) {
  const { pendente, erro, rodar } = useAcao(mensagemVenda);
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const v = props.venda;
  const texto = textoDoComprovante({
    numero: v.numero,
    totalCentavos: v.total_centavos,
    itens: v.itens.map((i) => ({
      nome: i.nome,
      quantidade: i.quantidade,
      totalCentavos: i.preco_unitario_centavos * i.quantidade,
    })),
  });
  const dia = v.criado_em.slice(0, 10);

  async function cancelar() {
    if (motivo.trim().length < 3) return;
    if (await rodar(() => props.api.cancelarVenda(v.id, motivo.trim()), 'Venda cancelada')) {
      setAberto(false);
      props.aoMudar();
    }
  }

  return (
    <Stack gap="md">
      <Stack gap="xs" className="comprovante-folha">
        <Text fw={700} fz="xl">
          Venda {v.numero}
        </Text>
        <Text c="dimmed">{formatarData(dia)} · {v.vendedor_nome}</Text>
        {v.status === 'cancelada' && <Text c="red">Cancelada. {v.motivo_cancelamento}</Text>}
        {v.cliente && (
          <Text style={{ overflowWrap: 'anywhere' }}>
            {v.cliente.nome}
          </Text>
        )}
        {v.itens.map((i) => (
          <Text key={i.sku_id} style={{ overflowWrap: 'anywhere' }}>
            {i.quantidade}× {i.nome} — <Valor centavos={i.preco_unitario_centavos * i.quantidade} />
          </Text>
        ))}
        {v.desconto_centavos > 0 && (
          <Text>
            Desconto <Valor centavos={v.desconto_centavos} />
          </Text>
        )}
        <Text fz="xl" fw={700}>
          Total <Valor centavos={v.total_centavos} destaque />
        </Text>
        {v.pagamentos.map((p) => (
          <Text key={`${p.forma}-${p.valor_centavos}`}>
            {ROTULOS_FORMA[p.forma]} · <Valor centavos={p.valor_centavos} />
          </Text>
        ))}
      </Stack>

      <Stack gap="xs" className="nao-imprimir">
        {v.cliente && v.status === 'finalizada' && (
          <Button
            component="a"
            href={linkComprovanteWhatsApp(v.cliente.celular, texto)}
            target="_blank"
            rel="noopener noreferrer"
            h={48}
            leftSection={<IconBrandWhatsapp aria-hidden />}
          >
            Enviar no WhatsApp
          </Button>
        )}
        <Button h={48} variant="default" onClick={() => window.print()}>
          Imprimir
        </Button>
        {v.status === 'finalizada' && (
          <Button h={48} variant="default" color="red" onClick={() => setAberto(true)}>
            Cancelar venda
          </Button>
        )}
        <Button h={48} variant="default" onClick={props.aoNova}>
          Nova venda
        </Button>
        {erro && (
          <Alert color="red" icon={<IconAlertCircle />} role="alert">
            {erro}
          </Alert>
        )}
      </Stack>

      <Modal opened={aberto} onClose={() => setAberto(false)} title="Cancelar esta venda" closeButtonProps={fecharModal}>
        <Stack gap="md">
          <Text>O estoque volta e o dinheiro sai do caixa. A venda fica marcada como cancelada.</Text>
          <TextInput size="lg" label="Motivo" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} autoComplete="off" />
          <Button h={48} color="red" loading={pendente} disabled={motivo.trim().length < 3} onClick={() => void cancelar()}>
            Confirmar cancelamento
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
