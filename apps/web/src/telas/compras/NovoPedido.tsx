import { useEffect, useState } from 'react';
import { Button, Group, NumberInput, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import type { Fornecedor, Produto } from '@ailow/shared';
import { totalDoPedido } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { QuadroDoAssistente, avisoDoPasso, usePassoNoHistorico } from '../../componentes/Assistente';
import { centavosParaTexto, reaisParaCentavos } from '../../lib/dinheiro';
import { useSalvarComToast } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import {
  type LinhaPedido,
  PASSOS_PEDIDO,
  type PassoPedido,
  type RascunhoPedido,
  pedidoParaApi,
  validarPassoPedido,
} from './pedido-passos';
import { mensagemCompras } from './rotulos';

const TITULOS: Record<PassoPedido, string> = {
  fornecedor: 'De quem vai comprar?',
  pecas: 'Quais peças?',
  confirmar: 'Confira e salve',
};

/** RF-COM-02 em passos curtos (fornecedor → peças → confirmar, S13): salva como rascunho; o envio é na ficha do pedido. */
export function NovoPedido(props: { api: Api; aoCancelar: () => void; aoCriar: (id: string) => void }) {
  const forn = useCarregar(() => props.api.fornecedores());
  if (forn.carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (forn.carga.fase === 'erro') return <ErroCarregar mensagem={forn.carga.mensagem} aoTentar={forn.tentarDeNovo} />;
  if (forn.carga.dados.fornecedores.length === 0) {
    return <EstadoVazio titulo="Cadastre um fornecedor" texto="Antes do pedido, informe quem vai receber o WhatsApp." />;
  }
  return <Assistente api={props.api} fornecedores={forn.carga.dados.fornecedores} aoCancelar={props.aoCancelar} aoCriar={props.aoCriar} />;
}

function Assistente(props: { api: Api; fornecedores: Fornecedor[]; aoCancelar: () => void; aoCriar: (id: string) => void }) {
  const [r, setR] = useState<RascunhoPedido>({ fornecedorId: null, linhas: [] });
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const { atual, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_PEDIDO);
  const { pendente, rodar } = useSalvarComToast(mensagemCompras);

  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const mudarLinha = (sku: string, parcial: Partial<LinhaPedido>) =>
    setR((x) => ({ ...x, linhas: x.linhas.map((l) => (l.sku_id === sku ? { ...l, ...parcial } : l)) }));
  const total = totalDoPedido(
    r.linhas.map((l) => ({ quantidade: l.quantidade, custoCentavos: reaisParaCentavos(l.custoTexto) ?? 0 })),
  );
  const fornecedor = props.fornecedores.find((f) => f.id === r.fornecedorId);

  async function salvar() {
    const corpo = pedidoParaApi(r);
    if (!corpo) return;
    let id = '';
    const ok = await rodar(async () => {
      id = (await props.api.criarPedidoCompra(corpo)).id;
    }, 'Pedido em rascunho');
    if (ok) props.aoCriar(id);
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPassoPedido(atual, r);
    if (problema) {
      avisoDoPasso(problema);
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  return (
    <QuadroDoAssistente
      passo={atual}
      titulo={TITULOS[atual]}
      indice={indice}
      total={PASSOS_PEDIDO.length}
      rotuloPrincipal={ultimo ? 'Salvar rascunho' : 'Continuar'}
      aoPrincipal={principal}
      aoCancelar={props.aoCancelar}
      aoVoltar={recuar}
      ocupado={pendente}
    >
      {atual === 'fornecedor' && (
        <Stack gap="xs" role="group" aria-label="Fornecedor">
          {props.fornecedores.map((f) => {
            const marcado = r.fornecedorId === f.id;
            return (
              <UnstyledButton
                key={f.id}
                className="ailow-bloco"
                mih={56}
                p="sm"
                w="100%"
                aria-pressed={marcado}
                data-destaque={marcado ? 'true' : 'false'}
                onClick={() => setR((x) => ({ ...x, fornecedorId: f.id }))}
              >
                <Group wrap="nowrap" gap="xs">
                  {marcado && <IconCheck size={20} aria-hidden />}
                  <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                    {f.nome}
                  </Text>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      )}

      {atual === 'pecas' && (
        <Stack gap="md">
          <TextInput
            label="Buscar peça"
            size="lg"
            autoComplete="off"
            placeholder="Nome ou código"
            value={texto}
            onChange={(e) => setTexto(e.currentTarget.value)}
          />
          <SugestoesPecas
            key={busca}
            api={props.api}
            busca={busca}
            ja={new Set(r.linhas.map((l) => l.sku_id))}
            aoEscolher={(linha) => setR((x) => ({ ...x, linhas: [...x.linhas, linha] }))}
          />
          {r.linhas.map((l) => (
            <Stack key={l.sku_id} gap="xs" className="ailow-bloco" p="md">
              <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                {l.rotulo}
              </Text>
              <NumberInput
                label="Quantidade"
                size="lg"
                min={1}
                max={999}
                allowDecimal={false}
                inputMode="numeric"
                value={l.quantidade}
                onChange={(v) => mudarLinha(l.sku_id, { quantidade: typeof v === 'number' ? v : 1 })}
              />
              <TextInput
                label="Custo unitário"
                size="lg"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={l.custoTexto}
                onChange={(e) => mudarLinha(l.sku_id, { custoTexto: e.currentTarget.value })}
              />
              <Button
                h={48}
                variant="default"
                onClick={() => setR((x) => ({ ...x, linhas: x.linhas.filter((y) => y.sku_id !== l.sku_id) }))}
              >
                Remover
              </Button>
            </Stack>
          ))}
          {total.ok && r.linhas.length > 0 && (
            <Text fw={700}>
              Total <Valor centavos={total.totalCentavos} destaque />
            </Text>
          )}
        </Stack>
      )}

      {atual === 'confirmar' && (
        <Stack gap={6} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {fornecedor?.nome}
          </Text>
          {r.linhas.map((l) => (
            <Text key={l.sku_id} size="sm" style={{ overflowWrap: 'anywhere' }}>
              {l.quantidade}× {l.rotulo} · R$ {l.custoTexto}
            </Text>
          ))}
          {total.ok && (
            <Text fw={700}>
              Total <Valor centavos={total.totalCentavos} destaque />
            </Text>
          )}
          <Text size="sm" c="dimmed">
            Fica como rascunho. O envio pelo WhatsApp é na ficha do pedido.
          </Text>
        </Stack>
      )}
    </QuadroDoAssistente>
  );
}

function SugestoesPecas(props: { api: Api; busca: string; ja: Set<string>; aoEscolher: (l: LinhaPedido) => void }) {
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
