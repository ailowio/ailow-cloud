import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Box, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import {
  IconBottle,
  IconCategory,
  IconHanger,
  IconMoon,
  IconShirt,
  IconSock,
  IconTag,
  IconAlertTriangle,
} from '@tabler/icons-react';
import type { Categoria, Produto } from '@ailow/shared';
import { chaveCor } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { ProgressoDoPasso } from '../../componentes/Assistente';
import { Modal } from '../../componentes/navegacao';
import { amostraDaCor } from '../produtos/grade';
import { Carregando } from '../estados';
import type { ItemVenda } from './carrinho';
import { chaveIconeCategoria, resumoEstoqueProduto, type ChaveIconeCategoria } from './icone-categoria';
import { rotuloEstoqueVenda } from './selo-estoque-venda';
import {
  eixosDoProduto,
  opcoesDoEixo,
  passoAnterior,
  passosEixosDoProduto,
  produtosDaCategoria,
  skusFiltrados,
  tituloDoEixo,
  categoriasComEstoque,
  type PassoCatalogo,
  type PassoEixo,
} from './wizard-catalogo';

type CargaLista<T> = { fase: 'carregando' } | { fase: 'pronto'; dados: T } | { fase: 'erro' };

const ICONES: Record<ChaveIconeCategoria, ReactNode> = {
  sutia: <IconHanger size={22} stroke={1.75} aria-hidden />,
  calcinha: <IconShirt size={22} stroke={1.75} aria-hidden />,
  bebida: <IconBottle size={22} stroke={1.75} aria-hidden />,
  acessorio: <IconTag size={22} stroke={1.75} aria-hidden />,
  body: <IconCategory size={22} stroke={1.75} aria-hidden />,
  pijama: <IconMoon size={22} stroke={1.75} aria-hidden />,
  meia: <IconSock size={22} stroke={1.75} aria-hidden />,
  geral: <IconTag size={22} stroke={1.75} aria-hidden />,
};

function pecaDe(produto: Produto, sku: Produto['skus'][number]): Omit<ItemVenda, 'qtd'> {
  return {
    skuId: sku.id,
    codigo: sku.codigo,
    nome: produto.nome,
    detalhe: sku.eixos?.length
      ? sku.eixos.map((e) => e.valor).join(' · ')
      : `${sku.tamanho} · ${sku.cor}`,
    precoCentavos: produto.preco_centavos,
    estoque: sku.estoque,
    estoqueMinimo: sku.estoque_minimo,
  };
}

function Opcao(props: {
  rotulo: string;
  detalhe?: string;
  amostra?: string | null;
  icone?: ReactNode;
  precoCentavos?: number;
  estoque?: number;
  estoqueMinimo?: number;
  baixo?: boolean;
  onClick: () => void;
}) {
  const temEstoque = props.estoque !== undefined;
  return (
    <UnstyledButton
      onClick={props.onClick}
      className="ailow-cartao"
      mih={48}
      p="sm"
      w="100%"
      style={{ textAlign: 'left' }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {props.icone && (
          <Box c="var(--ailow-marca-texto)" lh={0} mt={2} aria-hidden>
            {props.icone}
          </Box>
        )}
        {props.amostra && (
          <Box
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              flexShrink: 0,
              marginTop: 4,
              background: props.amostra,
              border: '1px solid var(--ailow-borda)',
            }}
          />
        )}
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={4} wrap="nowrap" justify="space-between" align="flex-start">
            <Text fw={650} style={{ overflowWrap: 'anywhere', flex: 1 }}>
              {props.rotulo}
            </Text>
            {props.precoCentavos !== undefined && (
              <Text fw={700} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                <Valor centavos={props.precoCentavos} destaque />
              </Text>
            )}
          </Group>
          {props.detalhe && (
            <Text size="sm" c="dimmed">
              {props.detalhe}
            </Text>
          )}
          {temEstoque && props.estoque !== undefined && (
            <Badge
              data-estoque
              color={props.baixo ? 'ambar' : 'gray'}
              variant="light"
              leftSection={
                props.baixo ? <IconAlertTriangle size={12} aria-hidden data-alerta-estoque /> : undefined
              }
            >
              {rotuloEstoqueVenda(props.estoque, props.estoqueMinimo)}
            </Badge>
          )}
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

/**
 * Wizard em modal: Categoria → Produto → um passo por eixo (tamanho, cor, …).
 * No último eixo, escolhe o SKU restante e fecha.
 */
export function WizardCatalogo(props: {
  aberto: boolean;
  api: Api;
  aoFechar: () => void;
  aoEscolher: (peca: Omit<ItemVenda, 'qtd'>) => void;
}) {
  const [passo, setPasso] = useState<PassoCatalogo>('categoria');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [categorias, setCategorias] = useState<CargaLista<Categoria[]>>({ fase: 'carregando' });
  const [produtos, setProdutos] = useState<CargaLista<Produto[]>>({ fase: 'carregando' });
  const [amostras, setAmostras] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!props.aberto) {
      setPasso('categoria');
      setCategoriaId(null);
      setProdutoId(null);
      setEscolhas({});
      return;
    }
    let ativo = true;
    setCategorias({ fase: 'carregando' });
    setProdutos({ fase: 'carregando' });
    void Promise.all([
      props.api.categorias('produto'),
      props.api.produtos(),
      props.api.opcoesGrade().catch(() => null),
    ])
      .then(([c, p, g]) => {
        if (!ativo) return;
        setCategorias({ fase: 'pronto', dados: c.categorias });
        setProdutos({ fase: 'pronto', dados: p.produtos });
        const m = new Map<string, string | null>();
        if (g) for (const cor of g.cores) m.set(chaveCor(cor.nome), cor.amostra);
        setAmostras(m);
      })
      .catch(() => {
        if (!ativo) return;
        setCategorias({ fase: 'erro' });
        setProdutos({ fase: 'erro' });
      });
    return () => {
      ativo = false;
    };
  }, [props.aberto, props.api]);

  const listaCategorias = useMemo(() => {
    if (categorias.fase !== 'pronto' || produtos.fase !== 'pronto') return [];
    return categoriasComEstoque(categorias.dados, produtos.dados);
  }, [categorias, produtos]);

  const listaProdutos = useMemo(() => {
    if (produtos.fase !== 'pronto' || !categoriaId) return [];
    return produtosDaCategoria(produtos.dados, categoriaId);
  }, [produtos, categoriaId]);

  const produto = useMemo(() => {
    if (produtos.fase !== 'pronto' || !produtoId) return null;
    return produtos.dados.find((p) => p.id === produtoId) ?? null;
  }, [produtos, produtoId]);

  const eixosPassos: PassoEixo[] = useMemo(() => (produto ? passosEixosDoProduto(produto) : []), [produto]);
  const eixosMeta = useMemo(() => (produto ? eixosDoProduto(produto) : []), [produto]);

  const carregando = categorias.fase === 'carregando' || produtos.fase === 'carregando';
  const erro = categorias.fase === 'erro' || produtos.fase === 'erro';
  const totalPassos = 2 + Math.max(eixosPassos.length, 1);
  const indice =
    passo === 'categoria' ? 0 : passo === 'produto' ? 1 : Math.max(0, eixosPassos.indexOf(passo as PassoEixo)) + 2;

  const slugAtual = typeof passo === 'string' && passo.startsWith('eixo:') ? passo.slice('eixo:'.length) : null;
  const metaAtual = eixosMeta.find((e) => e.slug === slugAtual);
  const titulo =
    passo === 'categoria' || passo === 'produto'
      ? passo === 'categoria'
        ? 'Escolha a categoria'
        : 'Escolha o produto'
      : metaAtual
        ? tituloDoEixo(metaAtual.slug, metaAtual.nome)
        : 'Escolha';

  function voltar() {
    const ant = passoAnterior(passo, eixosPassos);
    if (!ant) {
      props.aoFechar();
      return;
    }
    setPasso(ant);
    if (ant === 'categoria') {
      setCategoriaId(null);
      setProdutoId(null);
      setEscolhas({});
    } else if (ant === 'produto') {
      setProdutoId(null);
      setEscolhas({});
    } else if (typeof ant === 'string' && ant.startsWith('eixo:')) {
      const i = eixosPassos.indexOf(ant as PassoEixo);
      const prev: Record<string, string> = {};
      for (const p of eixosPassos.slice(0, i)) {
        const s = p.slice('eixo:'.length);
        const v = escolhas[s];
        if (v !== undefined) prev[s] = v;
      }
      setEscolhas(prev);
    }
  }

  function escolherEixo(slug: string, valor: string) {
    if (!produto) return;
    const novas = { ...escolhas, [slug]: valor };
    const i = eixosPassos.indexOf(`eixo:${slug}` as PassoEixo);
    const proximo = eixosPassos[i + 1];
    const ultimo = i === eixosPassos.length - 1 || proximo === undefined;
    if (ultimo) {
      const restantes = skusFiltrados(produto, novas);
      const sku = restantes[0];
      if (!sku) return;
      props.aoEscolher(pecaDe(produto, sku));
      props.aoFechar();
      return;
    }
    setEscolhas(novas);
    setPasso(proximo);
  }

  const escolhasAnteriores = useMemo(() => {
    if (!slugAtual) return {};
    const i = eixosPassos.indexOf(`eixo:${slugAtual}` as PassoEixo);
    const prev: Record<string, string> = {};
    for (const p of eixosPassos.slice(0, i)) {
      const s = p.slice('eixo:'.length);
      const v = escolhas[s];
      if (v !== undefined) prev[s] = v;
    }
    return prev;
  }, [escolhas, eixosPassos, slugAtual]);

  const opcoesFiltradas =
    produto && slugAtual ? opcoesDoEixo(produto, escolhasAnteriores, slugAtual) : [];

  return (
    <Modal opened={props.aberto} onClose={props.aoFechar} title="Catálogo" size="md">
      <Stack gap="md" data-wizard-catalogo={passo}>
        <Text fw={650}>{titulo}</Text>
        <ProgressoDoPasso indice={indice} total={totalPassos} />
        {carregando && <Carregando linhas={3} />}
        {erro && !carregando && <Text c="dimmed">Não consegui carregar o catálogo. Feche e tente de novo.</Text>}
        {!carregando && !erro && passo === 'categoria' && (
          <>
            {listaCategorias.length === 0 && <Text c="dimmed">Nenhuma categoria com estoque.</Text>}
            <SimpleGrid cols={2} spacing="xs">
              {listaCategorias.map((c) => (
                <Opcao
                  key={c.id}
                  rotulo={c.nome}
                  icone={ICONES[chaveIconeCategoria(c.nome)]}
                  onClick={() => {
                    setCategoriaId(c.id);
                    setPasso('produto');
                  }}
                />
              ))}
            </SimpleGrid>
          </>
        )}
        {!carregando && !erro && passo === 'produto' && (
          <>
            {listaProdutos.length === 0 && <Text c="dimmed">Nenhum produto com estoque nesta categoria.</Text>}
            <SimpleGrid cols={2} spacing="xs">
              {listaProdutos.map((p) => {
                const resumo = resumoEstoqueProduto(p);
                return (
                  <Opcao
                    key={p.id}
                    rotulo={p.nome}
                    precoCentavos={resumo.precoCentavos}
                    estoque={resumo.estoque}
                    estoqueMinimo={resumo.estoqueMinimo}
                    baixo={resumo.baixo}
                    onClick={() => {
                      setProdutoId(p.id);
                      setEscolhas({});
                      const eixos = passosEixosDoProduto(p);
                      setPasso(eixos[0] ?? 'eixo:tamanho');
                    }}
                  />
                );
              })}
            </SimpleGrid>
          </>
        )}
        {!carregando && !erro && slugAtual && produto && (
          <Stack gap="xs">
            {opcoesFiltradas.map((valor) => {
              const amostra = slugAtual === 'cor' ? (amostras.get(chaveCor(valor)) ?? amostraDaCor(valor)) : null;
              const i = eixosPassos.indexOf(`eixo:${slugAtual}` as PassoEixo);
              const ultimo = i === eixosPassos.length - 1;
              const sku = ultimo
                ? skusFiltrados(produto, { ...escolhasAnteriores, [slugAtual]: valor })[0]
                : undefined;
              return (
                <Opcao
                  key={valor}
                  rotulo={valor}
                  detalhe={sku?.codigo}
                  amostra={amostra}
                  precoCentavos={ultimo ? produto.preco_centavos : undefined}
                  estoque={sku?.estoque}
                  estoqueMinimo={sku?.estoque_minimo}
                  baixo={
                    sku?.estoque_minimo !== undefined && sku.estoque < sku.estoque_minimo
                      ? true
                      : undefined
                  }
                  onClick={() => escolherEixo(slugAtual, valor)}
                />
              );
            })}
          </Stack>
        )}
        <UnstyledButton onClick={voltar} mih={48} px="sm" style={{ alignSelf: 'flex-start' }}>
          <Text c="dimmed" fw={600}>
            {passo === 'categoria' ? 'Fechar' : 'Voltar'}
          </Text>
        </UnstyledButton>
      </Stack>
    </Modal>
  );
}
