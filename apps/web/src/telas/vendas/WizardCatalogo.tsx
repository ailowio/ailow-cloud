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
  PASSOS_CATALOGO,
  TITULOS_CATALOGO,
  categoriasComEstoque,
  passoAnterior,
  produtosDaCategoria,
  skusDoTamanho,
  tamanhosComEstoque,
  type PassoCatalogo,
} from './wizard-catalogo';

type CargaLista<T> = { fase: 'carregando' } | { fase: 'pronto'; dados: T } | { fase: 'erro' };

function pecaDe(produto: Produto, sku: Produto['skus'][number]): Omit<ItemVenda, 'qtd'> {
  return {
    skuId: sku.id,
    codigo: sku.codigo,
    nome: produto.nome,
    detalhe: `${sku.tamanho} · ${sku.cor}`,
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
 * Wizard em modal: Categoria → Produto → Tamanho → Cor.
 * Toque numa opção avança; na cor, acrescenta a peça e fecha.
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
  const [tamanho, setTamanho] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<CargaLista<Categoria[]>>({ fase: 'carregando' });
  const [produtos, setProdutos] = useState<CargaLista<Produto[]>>({ fase: 'carregando' });
  const [amostras, setAmostras] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!props.aberto) {
      setPasso('categoria');
      setCategoriaId(null);
      setProdutoId(null);
      setTamanho(null);
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

  const listaTamanhos = useMemo(() => (produto ? tamanhosComEstoque(produto) : []), [produto]);
  const listaSkus = useMemo(
    () => (produto && tamanho ? skusDoTamanho(produto, tamanho) : []),
    [produto, tamanho],
  );

  const carregando = categorias.fase === 'carregando' || produtos.fase === 'carregando';
  const erro = categorias.fase === 'erro' || produtos.fase === 'erro';
  const indice = PASSOS_CATALOGO.indexOf(passo);

  function voltar() {
    const ant = passoAnterior(passo);
    if (!ant) {
      props.aoFechar();
      return;
    }
    setPasso(ant);
    if (ant === 'categoria') {
      setCategoriaId(null);
      setProdutoId(null);
      setTamanho(null);
    } else if (ant === 'produto') {
      setProdutoId(null);
      setTamanho(null);
    } else if (ant === 'tamanho') {
      setTamanho(null);
    }
  }

  return (
    <Modal opened={props.aberto} onClose={props.aoFechar} title="Catálogo" size="md">
      <Stack gap="md" data-wizard-catalogo={passo}>
        <Text fw={650}>{TITULOS_CATALOGO[passo]}</Text>
        <ProgressoDoPasso indice={indice} total={PASSOS_CATALOGO.length} />
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
                  setPasso('tamanho');
                }}
              />
            ))}
          </Stack>
        )}
        {!carregando && !erro && passo === 'tamanho' && produto && (
          <Stack gap="xs">
            {listaTamanhos.map((t) => (
              <Opcao
                key={t}
                rotulo={t}
                onClick={() => {
                  setTamanho(t);
                  setPasso('cor');
                }}
              />
            ))}
          </Stack>
        )}
        {!carregando && !erro && passo === 'cor' && produto && tamanho && (
          <Stack gap="xs">
            {listaSkus.map((s) => (
              <Opcao
                key={s.id}
                rotulo={s.cor}
                detalhe={s.codigo}
                amostra={amostras.get(chaveCor(s.cor)) ?? amostraDaCor(s.cor)}
                onClick={() => {
                  props.aoEscolher(pecaDe(produto, s));
                  props.aoFechar();
                }}
              />
            ))}
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
