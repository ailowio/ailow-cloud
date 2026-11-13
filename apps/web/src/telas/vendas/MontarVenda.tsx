import { useMemo, useState } from 'react';
import { Alert, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconCamera, IconReportAnalytics, IconShoppingCartCheck } from '@tabler/icons-react';
import type { Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Carrinho } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { AVISO_CORTE, avisoDeCorte, mesclarBusca } from '../../lib/busca-servidor';
import { useBuscaNoServidor, useTextoComEspera } from '../../lib/useBuscaNoServidor';
import { camposDoProduto } from '../produtos/busca-produto';
import { Carregando, useCarregar } from '../estados';
import { MENSAGEM_SEM_ESTOQUE, type ItemVenda, acrescentar, mudarQuantidade } from './carrinho';
import { Scanner } from './Scanner';

const SEM_PRODUTOS: Produto[] = [];
const SEM_LINHAS: { key: string; peca: Omit<ItemVenda, 'qtd'> }[] = [];
/** Peças por página na busca da venda (UXM-09: 10 a 20). */
const PECAS_POR_PAGINA = 10;

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
  const [aviso, setAviso] = useState<string | null>(null);
  const consulta = useTextoComEspera(busca, 250);

  // Catálogo carregado uma vez (o servidor corta em 200); busca ampla e paginação no cliente. Cortado: a busca
  // também pergunta ao servidor (?q=) e une. Sem texto, nada a mostrar (a venda parte do escaneamento ou da busca).
  const { carga } = useCarregar(() => props.api.produtos());
  const todos = carga.fase === 'pronto' ? carga.dados.produtos : SEM_PRODUTOS;
  const cortada = carga.fase === 'pronto' && carga.dados.truncado;
  const servidor = useBuscaNoServidor(
    cortada,
    consulta,
    async (q) => {
      const r = await props.api.produtos(q);
      return { itens: r.produtos, truncado: r.truncado };
    },
    carga,
  );
  const linhas = useMemo(() => {
    if (consulta === '') return SEM_LINHAS;
    const achados = mesclarBusca(todos, servidor.itens, consulta, camposDoProduto, (p) => p.id);
    return achados.flatMap((p) => p.skus.map((s) => ({ key: s.id, peca: pecaDe(p, s) })));
  }, [todos, servidor.itens, consulta]);
  const pag = usePaginacao(linhas, PECAS_POR_PAGINA);
  const carregando = busca.trim() !== '' && (carga.fase === 'carregando' || busca.trim() !== consulta);
  const erroBusca = carga.fase === 'erro' ? 'Não consegui buscar. Verifique a conexão e tente de novo.' : null;

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
      {!carregando && consulta !== '' && linhas.length === 0 && !erroBusca && (
        <Text c="dimmed">Nenhuma peça com esse texto. Confira o nome ou o código.</Text>
      )}
      <Stack gap="xs">
        {pag.itens.map(({ key, peca }) => (
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
        {avisoDeCorte(cortada, consulta, servidor.truncado) && consulta !== '' && (
          <Text size="sm" c="dimmed" data-aviso-corte>
            {AVISO_CORTE}
          </Text>
        )}
        <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
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
