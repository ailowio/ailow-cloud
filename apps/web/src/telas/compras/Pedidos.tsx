import { useMemo, useState } from 'react';
import { Button, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import type { StatusPedido } from '@ailow/shared';
import { linkPedidoWhatsApp, textoDoPedido } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { CampoData } from '../../componentes/CampoData';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { filtrarPorBusca } from '../../lib/busca';
import { ITENS_POR_PAGINA, camposDoPedido } from '../../lib/campos-busca-listas';
import { useTextoComEspera } from '../../lib/useBuscaNoServidor';
import { centavosParaTexto, reaisParaCentavos } from '../../lib/dinheiro';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { NovoPedido } from './NovoPedido';
import { ROTULO_STATUS, mensagemCompras } from './rotulos';

type PedidoDaLista = Awaited<ReturnType<Api['pedidosCompra']>>['pedidos'][number];
const SEM_PEDIDOS: PedidoDaLista[] = [];

type Vista = 'lista' | 'novo' | 'ficha';

/** RF-COM-02…04: lista, novo rascunho, enviar pelo WhatsApp e receber com parcelas. */
export function Pedidos(props: { api: Api }) {
  const [vista, setVista] = useState<Vista>('lista');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0);

  if (vista === 'novo') {
    return (
      <NovoPedido
        api={props.api}
        aoCancelar={() => setVista('lista')}
        aoCriar={(id) => {
          setRodada((r) => r + 1);
          setAbertoId(id);
          setVista('ficha');
        }}
      />
    );
  }

  if (vista === 'ficha' && abertoId) {
    return (
      <FichaPedido
        key={`${abertoId}-${rodada}`}
        api={props.api}
        id={abertoId}
        aoVoltar={() => {
          setAbertoId(null);
          setVista('lista');
          setRodada((r) => r + 1);
        }}
        aoMudar={() => setRodada((r) => r + 1)}
      />
    );
  }

  return (
    <Lista
      key={rodada}
      api={props.api}
      aoNovo={() => setVista('novo')}
      aoAbrir={(id) => {
        setAbertoId(id);
        setVista('ficha');
      }}
    />
  );
}

function Lista(props: { api: Api; aoNovo: () => void; aoAbrir: (id: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.pedidosCompra());
  const [texto, setTexto] = useState('');
  const busca = useTextoComEspera(texto);
  // A API entrega todos os pedidos (sem corte): busca ampla e paginação no cliente.
  const todos = carga.fase === 'pronto' ? carga.dados.pedidos : SEM_PEDIDOS;
  const filtrados = useMemo(
    () => filtrarPorBusca(todos, busca, (p) => camposDoPedido(p, ROTULO_STATUS[p.status])),
    [todos, busca],
  );
  const pag = usePaginacao(filtrados, ITENS_POR_PAGINA);
  return (
    <Stack gap="md">
      <Button h={48} leftSection={<IconPlus aria-hidden />} onClick={props.aoNovo}>
        Novo pedido
      </Button>
      <TextInput
        size="lg"
        aria-label="Buscar pedido"
        placeholder="Número, fornecedor, status ou valor"
        leftSection={<IconSearch aria-hidden />}
        autoComplete="off"
        maxLength={80}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      {carga.fase === 'carregando' && <Carregando linhas={3} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && todos.length === 0 && (
        <EstadoVazio titulo="Nenhum pedido" texto="Monte um rascunho, envie pelo WhatsApp e receba as peças." />
      )}
      {carga.fase === 'pronto' && todos.length > 0 && filtrados.length === 0 && (
        <EstadoVazio titulo="Nenhum pedido encontrado" texto="Tente o número, parte do nome do fornecedor, o status ou o valor." />
      )}
      {pag.itens.map((p) => (
        <UnstyledButton key={p.id} className="ailow-bloco" data-pedido mih={72} p="md" w="100%" onClick={() => props.aoAbrir(p.id)}>
          <Text fw={650}>
            Pedido {p.numero} · {ROTULO_STATUS[p.status]}
          </Text>
          <Text size="sm" c="dimmed">
            {p.fornecedor_nome} · <Valor centavos={p.total_centavos} />
          </Text>
        </UnstyledButton>
      ))}
      <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
    </Stack>
  );
}

function FichaPedido(props: { api: Api; id: string; aoVoltar: () => void; aoMudar: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.pedidoCompra(props.id));
  const { pendente, rodar } = useAcao(mensagemCompras);
  const [receber, setReceber] = useState(false);
  const [parcelaTexto, setParcelaTexto] = useState('');
  const [vencimento, setVencimento] = useState(() => hojeEmSaoPaulo());

  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const ped = carga.dados;

  async function enviar() {
    let url: string | null = null;
    const ok = await rodar(async () => {
      const r = await props.api.enviarPedidoCompra(props.id);
      url = r.whatsapp_url;
    }, 'Pedido marcado como enviado');
    if (ok && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      props.aoMudar();
    }
  }

  function reabrirWhatsApp() {
    const texto = textoDoPedido({
      numero: ped.numero,
      itens: ped.itens.map((i) => ({ codigo: i.codigo, cor: i.cor, quantidade: i.quantidade })),
    });
    window.open(linkPedidoWhatsApp(ped.fornecedor.whatsapp, texto), '_blank', 'noopener,noreferrer');
  }

  async function confirmarRecebimento() {
    const valor = reaisParaCentavos(parcelaTexto);
    if (valor === null || valor !== ped.total_centavos) return;
    const ok = await rodar(
      () => props.api.receberPedidoCompra(props.id, { parcelas: [{ valor_centavos: valor, vencimento }] }),
      'Pedido recebido: estoque e contas a pagar atualizados',
    );
    if (ok) {
      setReceber(false);
      props.aoMudar();
    }
  }

  return (
    <Stack gap="md">
      <Button h={48} variant="default" onClick={props.aoVoltar}>
        Voltar aos pedidos
      </Button>
      <Text fw={700} fz="lg">
        Pedido {ped.numero} · {ROTULO_STATUS[ped.status as StatusPedido]}
      </Text>
      <Text>
        {ped.fornecedor.nome} · <Valor centavos={ped.total_centavos} destaque />
      </Text>
      {ped.itens.map((i) => (
        <Text key={i.sku_id} size="sm">
          {i.quantidade}× {i.codigo} · {i.cor} · <Valor centavos={i.custo_unitario_centavos * i.quantidade} />
        </Text>
      ))}
      {ped.status === 'rascunho' && (
        <Button h={48} loading={pendente} disabled={pendente} onClick={() => void enviar()}>
          Enviar pelo WhatsApp
        </Button>
      )}
      {ped.status === 'enviado' && !receber && (
        <>
          <Button h={48} variant="default" onClick={reabrirWhatsApp}>
            Abrir WhatsApp de novo
          </Button>
          <Button
            h={48}
            onClick={() => {
              setParcelaTexto(centavosParaTexto(ped.total_centavos));
              setReceber(true);
            }}
          >
            Receber pedido
          </Button>
        </>
      )}
      {ped.status === 'enviado' && receber && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Uma parcela no total do pedido (pode marcar como pago depois no Financeiro).
          </Text>
          <TextInput label="Valor da parcela" size="lg" value={parcelaTexto} onChange={(e) => setParcelaTexto(e.currentTarget.value)} />
          <CampoData label="Vencimento" value={vencimento} onChange={setVencimento} />
          <Button h={48} loading={pendente} disabled={pendente} onClick={() => void confirmarRecebimento()}>
            Confirmar recebimento
          </Button>
          <Button h={48} variant="default" disabled={pendente} onClick={() => setReceber(false)}>
            Cancelar
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
