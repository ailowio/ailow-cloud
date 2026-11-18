import { useMemo, useState } from 'react';
import { Alert, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconCamera, IconCategory, IconReportAnalytics, IconShoppingCartCheck } from '@tabler/icons-react';
import { chaveCor, type Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { AVISO_CORTE, avisoDeCorte, mesclarBusca } from '../../lib/busca-servidor';
import { useBuscaNoServidor, useTextoComEspera } from '../../lib/useBuscaNoServidor';
import { amostraDaCor } from '../produtos/grade';
import { camposDoProduto } from '../produtos/busca-produto';
import { Carregando, useCarregar } from '../estados';
import { BarraCarrinho } from './BarraCarrinho';
import { CartaoPecaVenda } from './CartaoPecaVenda';
import {
  MENSAGEM_SEM_ESTOQUE,
  type ItemVenda,
  acrescentar,
  mudarQuantidade,
  quantidadeItens,
  subtotalCentavos,
} from './carrinho';
import { Scanner } from './Scanner';
import { WizardCatalogo } from './WizardCatalogo';

const SEM_PRODUTOS: Produto[] = [];
/** Opções de peças por página na busca da venda; padrão 5. */
const POR_PAGINA_OPCOES = [5, 10, 20] as const;
const POR_PAGINA_PADRAO = 5;
/** Altura aproximada da barra sticky do carrinho (empurra a paginação). */
const ALTURA_BARRA_CARRINHO = 64;

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

function amostraDe(cor: string, mapa: Map<string, string | null>): string | null {
  return mapa.get(chaveCor(cor)) ?? amostraDaCor(cor);
}

/** RF-VEN-02/03/04: escanear ou buscar; carrinho em barra sticky (lista completa em /vendas/carrinho). */
export function MontarVenda(props: {
  api: Api;
  itens: ItemVenda[];
  aoMudar: (itens: ItemVenda[]) => void;
  aoFechar: () => void;
  aoCarrinho: () => void;
  aoRelatorio: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [lendo, setLendo] = useState(false);
  const [catalogo, setCatalogo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [porPagina, setPorPagina] = useState(POR_PAGINA_PADRAO);
  const consulta = useTextoComEspera(busca, 250);

  const { carga } = useCarregar(() => props.api.produtos());
  const sugestoes = useCarregar(() => props.api.sugestoesVenda());
  const grade = useCarregar(() => props.api.opcoesGrade());
  const mapaAmostra = useMemo(() => {
    const m = new Map<string, string | null>();
    if (grade.carga.fase !== 'pronto') return m;
    for (const c of grade.carga.dados.cores) m.set(chaveCor(c.nome), c.amostra);
    return m;
  }, [grade.carga]);

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
    if (consulta === '') {
      const sugeridos = sugestoes.carga.fase === 'pronto' ? sugestoes.carga.dados.produtos : SEM_PRODUTOS;
      return sugeridos.flatMap((p) =>
        p.skus.map((s) => ({ key: s.id, peca: pecaDe(p, s), amostra: amostraDe(s.cor, mapaAmostra) })),
      );
    }
    const achados = mesclarBusca(todos, servidor.itens, consulta, camposDoProduto, (p) => p.id);
    return achados.flatMap((p) =>
      p.skus.map((s) => ({ key: s.id, peca: pecaDe(p, s), amostra: amostraDe(s.cor, mapaAmostra) })),
    );
  }, [todos, servidor.itens, consulta, sugestoes.carga, mapaAmostra]);
  const pag = usePaginacao(linhas, porPagina);
  const carregando =
    (busca.trim() !== '' && (carga.fase === 'carregando' || busca.trim() !== consulta)) ||
    (consulta === '' && sugestoes.carga.fase === 'carregando');
  const erroBusca = carga.fase === 'erro' ? 'Não consegui buscar. Verifique a conexão e tente de novo.' : null;
  const qtdCarrinho = quantidadeItens(props.itens);
  const temCarrinho = qtdCarrinho > 0;
  const mostrandoSugestoes = consulta === '';

  function entrar(peca: Omit<ItemVenda, 'qtd'>) {
    const r = acrescentar(props.itens, peca);
    props.aoMudar(r.itens);
    setAviso(r.aviso);
  }

  function ajustar(codigo: string, delta: number) {
    const r = mudarQuantidade(props.itens, codigo, delta);
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
        cols={4}
        acoes={[
          { id: 'escanear', rotulo: 'Escanear', icone: <IconCamera size={28} stroke={1.75} />, aoTocar: () => setLendo(true) },
          {
            id: 'catalogo',
            rotulo: 'Catálogo',
            descricao: 'Todos os produtos',
            icone: <IconCategory size={28} stroke={1.75} />,
            aoTocar: () => setCatalogo(true),
          },
          {
            id: 'gerenciar',
            rotulo: 'Gerenciar',
            descricao: 'Gerenciar vendas (Relatório)',
            icone: <IconReportAnalytics size={28} stroke={1.75} />,
            aoTocar: props.aoRelatorio,
          },
          {
            id: 'fechar',
            rotulo: 'Finalizar',
            icone: <IconShoppingCartCheck size={28} stroke={1.75} />,
            aoTocar: props.aoFechar,
            desabilitado: props.itens.length === 0,
            destaque: true,
          },
        ]}
      />
      <WizardCatalogo
        aberto={catalogo}
        api={props.api}
        aoFechar={() => setCatalogo(false)}
        aoEscolher={entrar}
      />
      {/* No celular o teclado só abre ao tocar em Buscar (sem foco automático). */}
      <TextInput size="lg" label="Buscar" placeholder="Nome, código ou preço" value={busca} onChange={(e) => setBusca(e.currentTarget.value)} autoComplete="off" />
      {carregando && <Carregando linhas={2} />}
      {erroBusca && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erroBusca}
        </Alert>
      )}
      {!carregando && consulta !== '' && linhas.length === 0 && !erroBusca && (
        <Text c="dimmed">Nenhuma peça com esse texto. Confira o nome ou o código.</Text>
      )}
      {!carregando && mostrandoSugestoes && linhas.length === 0 && sugestoes.carga.fase === 'pronto' && (
        <Text c="dimmed">Nenhuma peça com estoque. Cadastre produtos ou use Buscar.</Text>
      )}
      {mostrandoSugestoes && linhas.length > 0 && (
        <Text size="sm" c="dimmed">
          Sugestões
        </Text>
      )}
      <Stack gap="xs">
        {pag.itens.map(({ key, peca, amostra }) => {
          const noCarrinho = props.itens.find((i) => i.skuId === peca.skuId);
          return (
            <CartaoPecaVenda
              key={key}
              peca={peca}
              amostra={amostra}
              qtdNoCarrinho={noCarrinho?.qtd ?? 0}
              aoTocar={() => entrar(peca)}
              aoMudarQtd={(delta) => ajustar(peca.codigo, delta)}
            />
          );
        })}
        {avisoDeCorte(cortada, consulta, servidor.truncado) && consulta !== '' && (
          <Text size="sm" c="dimmed" data-aviso-corte>
            {AVISO_CORTE}
          </Text>
        )}
        {linhas.length > 0 && (
          <Paginacao
            pagina={pag.pagina}
            totalPaginas={pag.totalPaginas}
            aoMudar={pag.irPara}
            bottom={temCarrinho ? ALTURA_BARRA_CARRINHO : 0}
            itensTotais={linhas.length}
            porPagina={{
              valor: porPagina,
              opcoes: POR_PAGINA_OPCOES,
              aoMudar: setPorPagina,
            }}
          />
        )}
      </Stack>
      {aviso && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {aviso === MENSAGEM_SEM_ESTOQUE ? MENSAGEM_SEM_ESTOQUE : aviso}
        </Alert>
      )}
      <BarraCarrinho quantidade={qtdCarrinho} totalCentavos={subtotalCentavos(props.itens)} aoAbrir={props.aoCarrinho} />
    </Stack>
  );
}
