import { useEffect, useMemo, useState } from 'react';
import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import type { Categoria, Produto } from '@ailow/shared';
import { chaveCor } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { ProgressoDoPasso } from '../../componentes/Assistente';
import { Modal } from '../../componentes/navegacao';
import { amostraDaCor } from '../produtos/grade';
import { Carregando } from '../estados';
import type { ItemVenda } from './carrinho';
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
  };
}

function Opcao(props: { rotulo: string; detalhe?: string; amostra?: string | null; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={props.onClick}
      className="ailow-cartao"
      mih={48}
      p="md"
      w="100%"
      style={{ textAlign: 'left' }}
    >
      <Group gap="sm" wrap="nowrap">
        {props.amostra && (
          <Box
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              flexShrink: 0,
              background: props.amostra,
              border: '1px solid var(--ailow-borda)',
            }}
          />
        )}
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
            {props.rotulo}
          </Text>
          {props.detalhe && (
            <Text size="sm" c="dimmed">
              {props.detalhe}
            </Text>
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

  // escolhas já feitas = eixos anteriores ao atual
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
          <Stack gap="xs">
            {listaCategorias.length === 0 && <Text c="dimmed">Nenhuma categoria com estoque.</Text>}
            {listaCategorias.map((c) => (
              <Opcao
                key={c.id}
                rotulo={c.nome}
                onClick={() => {
                  setCategoriaId(c.id);
                  setPasso('produto');
                }}
              />
            ))}
          </Stack>
        )}
        {!carregando && !erro && passo === 'produto' && (
          <Stack gap="xs">
            {listaProdutos.length === 0 && <Text c="dimmed">Nenhum produto com estoque nesta categoria.</Text>}
            {listaProdutos.map((p) => (
              <Opcao
                key={p.id}
                rotulo={p.nome}
                onClick={() => {
                  setProdutoId(p.id);
                  setEscolhas({});
                  const eixos = passosEixosDoProduto(p);
                  setPasso(eixos[0] ?? 'eixo:tamanho');
                }}
              />
            ))}
          </Stack>
        )}
        {!carregando && !erro && slugAtual && produto && (
          <Stack gap="xs">
            {opcoesFiltradas.map((valor) => {
              const amostra = slugAtual === 'cor' ? (amostras.get(chaveCor(valor)) ?? amostraDaCor(valor)) : null;
              const i = eixosPassos.indexOf(`eixo:${slugAtual}` as PassoEixo);
              const ultimo = i === eixosPassos.length - 1;
              const detalhe = ultimo
                ? skusFiltrados(produto, { ...escolhasAnteriores, [slugAtual]: valor })[0]?.codigo
                : undefined;
              return (
                <Opcao
                  key={valor}
                  rotulo={valor}
                  detalhe={detalhe}
                  amostra={amostra}
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
