import { useEffect, useState } from 'react';
import { Alert, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconCamera, IconReportAnalytics, IconShoppingCartCheck } from '@tabler/icons-react';
import type { Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Carrinho } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Carregando } from '../estados';
import { MENSAGEM_SEM_ESTOQUE, type ItemVenda, acrescentar, mudarQuantidade } from './carrinho';
import { Scanner } from './Scanner';

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

/** RF-VEN-02/03/04: escanear ou buscar, carrinho embaixo, bloqueio sem estoque. */
export function MontarVenda(props: {
  api: Api;
  itens: ItemVenda[];
  aoMudar: (itens: ItemVenda[]) => void;
  aoFechar: () => void;
  aoRelatorio: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [lendo, setLendo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  useEffect(() => {
    const q = busca.trim();
    if (q === '') {
      setProdutos([]);
      setErroBusca(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    const espera = setTimeout(() => {
      props.api
        .produtos(q)
        .then((r) => {
          if (!ativo) return;
          setProdutos(r.produtos);
          setErroBusca(null);
        })
        .catch(() => {
          if (ativo) setErroBusca('Não consegui buscar. Verifique a conexão e tente de novo.');
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca, props.api]);

  function entrar(peca: Omit<ItemVenda, 'qtd'>) {
    const r = acrescentar(props.itens, peca);
    props.aoMudar(r.itens);
    setAviso(r.aviso);
  }

  async function aoCodigo(codigo: string) {
    setLendo(false);
    try {
      const sku = await props.api.skuPorCodigo(codigo);
      entrar({
        skuId: sku.id,
        codigo: sku.codigo,
        nome: sku.nome,
        detalhe: `${sku.tamanho} · ${sku.cor}`,
        precoCentavos: sku.preco_centavos,
        estoque: sku.estoque,
      });
    } catch {
      setAviso('Não achei essa peça. Confira a etiqueta ou use Buscar.');
    }
  }

  if (lendo) return <Scanner aoCodigo={(c) => void aoCodigo(c)} aoFechar={() => setLendo(false)} />;

  const linhas = produtos.flatMap((p) => p.skus.map((s) => ({ key: s.id, peca: pecaDe(p, s) }))).slice(0, 8);

  return (
    <Stack gap="md">
      <GradeAcoes
        acoes={[
          { id: 'escanear', rotulo: 'Escanear', icone: <IconCamera size={32} stroke={1.75} />, aoTocar: () => setLendo(true) },
          { id: 'fechar', rotulo: 'Fechar', icone: <IconShoppingCartCheck size={32} stroke={1.75} />, aoTocar: props.aoFechar, desabilitado: props.itens.length === 0 },
          { id: 'gerenciar', rotulo: 'Gerenciar vendas', descricao: 'Gerenciar vendas (Relatório)', icone: <IconReportAnalytics size={32} stroke={1.75} />, aoTocar: props.aoRelatorio },
        ]}
      />
      <TextInput size="lg" label="Buscar" placeholder="Nome, código ou preço" value={busca} onChange={(e) => setBusca(e.currentTarget.value)} autoFocus autoComplete="off" />
      {carregando && <Carregando linhas={2} />}
      {erroBusca && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erroBusca}
        </Alert>
      )}
      {!carregando && busca.trim() !== '' && linhas.length === 0 && !erroBusca && (
        <Text c="dimmed">Nenhuma peça com esse texto. Confira o nome ou o código.</Text>
      )}
      <Stack gap="xs">
        {linhas.map(({ key, peca }) => (
          <UnstyledButton
            key={key}
            onClick={() => entrar(peca)}
            className="ailow-cartao"
            data-toque="peca"
            style={{ minHeight: 48, padding: 12, textAlign: 'left', width: '100%' }}
          >
            <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
              {peca.nome}
            </Text>
            <Text size="sm" c="dimmed">
              {peca.detalhe} · {peca.codigo}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
      {aviso && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {aviso === MENSAGEM_SEM_ESTOQUE ? MENSAGEM_SEM_ESTOQUE : aviso}
        </Alert>
      )}
      {props.itens.length > 0 && (
        <Carrinho
          itens={props.itens}
          onMudar={(codigo, delta) => {
            const r = mudarQuantidade(props.itens, codigo, delta);
            props.aoMudar(r.itens);
            setAviso(r.aviso);
          }}
        />
      )}
    </Stack>
  );
}
