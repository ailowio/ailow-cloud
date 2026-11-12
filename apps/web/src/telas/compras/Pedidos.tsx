import { useEffect, useState } from 'react';
import { Alert, Button, NumberInput, Select, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import type { Fornecedor, Produto, StatusPedido } from '@ailow/shared';
import { linkPedidoWhatsApp, textoDoPedido, totalDoPedido } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { centavosParaTexto, reaisParaCentavos } from '../../lib/dinheiro';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { ROTULO_STATUS, mensagemCompras } from './rotulos';

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
  return (
    <Stack gap="md">
      <Button h={48} leftSection={<IconPlus aria-hidden />} onClick={props.aoNovo}>
        Novo pedido
      </Button>
      {carga.fase === 'carregando' && <Carregando linhas={3} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.pedidos.length === 0 && (
        <EstadoVazio titulo="Nenhum pedido" texto="Monte um rascunho, envie pelo WhatsApp e receba as peças." />
      )}
      {carga.fase === 'pronto' &&
        carga.dados.pedidos.map((p) => (
          <UnstyledButton key={p.id} className="ailow-bloco" mih={72} p="md" w="100%" onClick={() => props.aoAbrir(p.id)}>
            <Text fw={650}>
              Pedido {p.numero} · {ROTULO_STATUS[p.status]}
            </Text>
            <Text size="sm" c="dimmed">
              {p.fornecedor_nome} · <Valor centavos={p.total_centavos} />
            </Text>
          </UnstyledButton>
        ))}
    </Stack>
  );
}

interface LinhaNova {
  sku_id: string;
  rotulo: string;
  quantidade: number;
  custoTexto: string;
}

function NovoPedido(props: { api: Api; aoCancelar: () => void; aoCriar: (id: string) => void }) {
  const forn = useCarregar(() => props.api.fornecedores());
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState<LinhaNova[]>([]);
  const { pendente, erro, rodar } = useAcao(mensagemCompras);

  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const total = totalDoPedido(
    linhas.map((l) => ({
      quantidade: l.quantidade,
      custoCentavos: reaisParaCentavos(l.custoTexto) ?? 0,
    })),
  );
  const linhasOk =
    linhas.length > 0 &&
    linhas.every((l) => {
      const c = reaisParaCentavos(l.custoTexto);
      return c !== null && c >= 1 && l.quantidade >= 1;
    });
  const pronto = fornecedorId !== null && linhasOk && total.ok;

  async function salvar() {
    if (!pronto || !fornecedorId || !total.ok) return;
    let id: string | null = null;
    const ok = await rodar(async () => {
      const ped = await props.api.criarPedidoCompra({
        fornecedor_id: fornecedorId,
        itens: linhas.map((l) => ({
          sku_id: l.sku_id,
          quantidade: l.quantidade,
          custo_centavos: reaisParaCentavos(l.custoTexto) as number,
        })),
      });
      id = ped.id;
    }, 'Pedido em rascunho');
    if (ok && id) props.aoCriar(id);
  }

  if (forn.carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (forn.carga.fase === 'erro') return <ErroCarregar mensagem={forn.carga.mensagem} aoTentar={forn.tentarDeNovo} />;
  if (forn.carga.dados.fornecedores.length === 0) {
    return <EstadoVazio titulo="Cadastre um fornecedor" texto="Antes do pedido, informe quem vai receber o WhatsApp." />;
  }

  return (
    <Stack gap="md">
      <Select
        label="Fornecedor"
        required
        size="lg"
        placeholder="Escolha"
        data={forn.carga.dados.fornecedores.map((f: Fornecedor) => ({ value: f.id, label: f.nome }))}
        value={fornecedorId}
        onChange={setFornecedorId}
      />
      <TextInput
        label="Buscar peça"
        size="lg"
        placeholder="Nome ou código"
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      <SugestoesPecas
        key={busca}
        api={props.api}
        busca={busca}
        ja={new Set(linhas.map((l) => l.sku_id))}
        aoEscolher={(linha) => setLinhas((xs) => [...xs, linha])}
      />
      {linhas.map((l) => (
        <Stack key={l.sku_id} gap="xs" className="ailow-bloco" p="md">
          <Text fw={650}>{l.rotulo}</Text>
          <NumberInput
            label="Quantidade"
            size="lg"
            min={1}
            max={999}
            value={l.quantidade}
            onChange={(v) =>
              setLinhas((xs) => xs.map((x) => (x.sku_id === l.sku_id ? { ...x, quantidade: typeof v === 'number' ? v : 1 } : x)))
            }
          />
          <TextInput
            label="Custo unitário"
            size="lg"
            value={l.custoTexto}
            onChange={(e) => setLinhas((xs) => xs.map((x) => (x.sku_id === l.sku_id ? { ...x, custoTexto: e.currentTarget.value } : x)))}
          />
          <Button h={48} variant="default" onClick={() => setLinhas((xs) => xs.filter((x) => x.sku_id !== l.sku_id))}>
            Remover
          </Button>
        </Stack>
      ))}
      {total.ok && (
        <Text fw={700}>
          Total <Valor centavos={total.totalCentavos} destaque />
        </Text>
      )}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle aria-hidden />}>
          {erro}
        </Alert>
      )}
      <Button h={48} loading={pendente} disabled={!pronto || pendente} onClick={() => void salvar()}>
        Salvar rascunho
      </Button>
      <Button h={48} variant="default" disabled={pendente} onClick={props.aoCancelar}>
        Cancelar
      </Button>
    </Stack>
  );
}

function SugestoesPecas(props: {
  api: Api;
  busca: string;
  ja: Set<string>;
  aoEscolher: (l: LinhaNova) => void;
}) {
  const { carga } = useCarregar(() => props.api.produtos(props.busca || undefined));
  if (carga.fase !== 'pronto') return null;
  const opcoes = carga.dados.produtos.flatMap((prod: Produto) =>
    prod.skus
      .filter((s) => !props.ja.has(s.id))
      .slice(0, 4)
      .map((s) => ({
        sku_id: s.id,
        rotulo: `${prod.nome} · ${s.tamanho} · ${s.cor} · ${s.codigo}`,
        quantidade: 1,
        custoTexto: prod.custo_centavos != null ? centavosParaTexto(prod.custo_centavos) : '',
        botao: `${prod.nome} · ${s.tamanho} · ${s.cor}`,
      })),
  );
  return (
    <>
      {opcoes.slice(0, 6).map((o) => (
        <Button
          key={o.sku_id}
          h={48}
          variant="default"
          onClick={() => props.aoEscolher({ sku_id: o.sku_id, rotulo: o.rotulo, quantidade: o.quantidade, custoTexto: o.custoTexto })}
        >
          + {o.botao}
        </Button>
      ))}
    </>
  );
}

function FichaPedido(props: { api: Api; id: string; aoVoltar: () => void; aoMudar: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.pedidoCompra(props.id));
  const { pendente, erro, rodar } = useAcao(mensagemCompras);
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
      {erro && (
        <Alert color="red" icon={<IconAlertCircle aria-hidden />}>
          {erro}
        </Alert>
      )}
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
          <TextInput label="Vencimento" type="date" size="lg" value={vencimento} onChange={(e) => setVencimento(e.currentTarget.value)} />
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
