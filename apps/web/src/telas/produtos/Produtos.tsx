import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Stack, Text, TextInput } from '@mantine/core';
import { IconAlertTriangle, IconListDetails, IconPlus, IconQrcode, IconSearch } from '@tabler/icons-react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import type { Perfil, Produto } from '@ailow/shared';
import { useSairDoAssistente, useVoltar } from '../../componentes/navegacao';
import type { Api, ConsultaProdutos } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { AVISO_CORTE, avisoDeCorte, mesclarBusca } from '../../lib/busca-servidor';
import { useBuscaNoServidor } from '../../lib/useBuscaNoServidor';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { useMaisPaginas } from '../../lib/useMaisPaginas';
import { CarregarMais } from '../../componentes/CarregarMais';
import { Moldura } from '../Moldura';
import { AbaixoDoMinimo } from './AbaixoDoMinimo';
import { PRODUTOS_POR_PAGINA, camposDoProduto } from './busca-produto';
import { CartaoProduto } from './CartaoProduto';
import { CatalogoProdutos } from './CatalogoProdutos';
import { DetalheProduto } from './DetalheProduto';
import { Etiquetas } from './Etiquetas';
import { type FiltrosProdutos, consultaDosFiltros, quantosFiltros } from './filtros-produtos';
import { BarraProdutos, type VisaoProdutos, useVisaoProdutos } from './FiltrosProdutos';
import { NovoProduto } from './NovoProduto';
import { type SkuAberto, SkuFolha } from './SkuFolha';

const SEM_PRODUTOS: Produto[] = [];

type Vista = 'lista' | 'novo' | 'etiquetas';
type Aba = 'todos' | 'baixo';

/** Cada tela é uma subrota de /produtos (/produtos/novo, /produtos/etiquetas): o Voltar recua uma tela por vez. */
function vistaDaRota(caminho: string): Vista | null {
  const sub = caminho.replace(/^\/produtos\/?/, '').replace(/\/$/, '');
  if (sub === '') return 'lista';
  return sub === 'novo' || sub === 'etiquetas' ? sub : null;
}

/**
 * Produtos. O Dono cadastra, vê o custo e mexe no estoque; o Vendedor só consulta produto, preço e estoque
 * (RF-PRO-07). A API já não manda o custo ao Vendedor; a tela também não o mostra.
 */
export function Produtos(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const navigate = useNavigate();
  const vista = vistaDaRota(useLocation().pathname);
  const voltarUm = useVoltar('/produtos');
  const sair = useSairDoAssistente('/produtos');
  const [busca, setBusca] = useState('');
  const dono = props.perfil === 'dono';

  if (vista === null || (vista !== 'lista' && !dono)) return <Navigate to="/produtos" replace />;

  if (vista === 'etiquetas') {
    return (
      <Moldura titulo="Etiquetas" voltar={{ rotulo: 'Produtos', aoVoltar: voltarUm }}>
        <Etiquetas api={props.api} />
      </Moldura>
    );
  }

  if (vista === 'novo') {
    return (
      // Seta padronizada (decisão do Pedro, 2026-11-16): recua UM passo, como o Voltar do sistema e os outros
      // assistentes; no 1º passo, volta à lista de Produtos.
      <Moldura titulo="Novo produto" voltar={{ rotulo: 'Produtos', aoVoltar: voltarUm }}>
        <NovoProduto
          api={props.api}
          aoCancelar={() => sair()}
          aoTerminar={(codigo) => {
            setBusca(codigo ?? '');
            sair();
          }}
        />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Produtos" voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <Lista
        api={props.api}
        dono={dono}
        buscaInicial={busca}
        aoNovo={() => navigate('/produtos/novo')}
        aoEtiquetas={() => navigate('/produtos/etiquetas')}
      />
    </Moldura>
  );
}

function Lista(props: { api: Api; dono: boolean; buscaInicial: string; aoNovo: () => void; aoEtiquetas: () => void }) {
  const [texto, setTexto] = useState(props.buscaInicial);
  const [busca, setBusca] = useState(props.buscaInicial);
  const [aba, setAba] = useState<Aba>('todos');
  // P02: filtros e visão ficam aqui em cima, para trocar Lista/Catálogo sem perder os filtros.
  const [filtros, setFiltros] = useState<FiltrosProdutos>({});
  const [visao, setVisao] = useVisaoProdutos();
  // Folha aberta e contador que força a lista a buscar de novo depois de mexer no estoque.
  const [aberto, setAberto] = useState<SkuAberto | null>(null);
  const [rodada, setRodada] = useState(0);

  // Espera a pessoa parar de digitar para não chamar a API a cada letra.
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <Stack gap="md">
      {props.dono && (
        // UXM-10: menu em ícones, 3 colunas. "Chegou mercadoria" e "Ajustar estoque" ficam no pop-up de cada produto.
        <GradeAcoes
          acoes={[
            { id: 'novo', rotulo: 'Novo produto', icone: <IconPlus size={32} stroke={1.75} />, aoTocar: props.aoNovo },
            { id: 'etiquetas', rotulo: 'Etiquetas', icone: <IconQrcode size={32} stroke={1.75} />, aoTocar: props.aoEtiquetas },
            aba === 'todos'
              ? { id: 'baixo', rotulo: 'Abaixo do mínimo', icone: <IconAlertTriangle size={32} stroke={1.75} />, aoTocar: () => setAba('baixo') }
              : { id: 'todos', rotulo: 'Todos os produtos', icone: <IconListDetails size={32} stroke={1.75} />, aoTocar: () => setAba('todos') },
          ]}
        />
      )}

      {aba === 'todos' ? (
        <>
          <TextInput
            size="lg"
            aria-label="Buscar produto"
            placeholder="Nome, código ou preço"
            leftSection={<IconSearch aria-hidden />}
            autoComplete="off"
            maxLength={80}
            value={texto}
            onChange={(e) => setTexto(e.currentTarget.value)}
          />
          <BarraProdutos api={props.api} visao={visao} aoMudarVisao={setVisao} filtros={filtros} aoMudarFiltros={setFiltros} />
          {/* Filtro novo = lista nova: a 1ª página, o "Carregar mais" e a busca no servidor vêm já filtrados. */}
          <ListaProdutos
            key={`${rodada}|${filtros.categoria?.id ?? ''}|${filtros.cor ?? ''}`}
            api={props.api}
            dono={props.dono}
            busca={busca}
            consulta={consultaDosFiltros(filtros)}
            filtrada={quantosFiltros(filtros) > 0}
            visao={visao}
            aoNovo={props.aoNovo}
          />
        </>
      ) : (
        <AbaixoDoMinimo key={rodada} api={props.api} aoAbrir={setAberto} />
      )}

      {aberto && (
        <SkuFolha
          api={props.api}
          dono={props.dono}
          sku={aberto}
          aoFechar={() => setAberto(null)}
          aoMudar={() => setRodada((r) => r + 1)}
        />
      )}
    </Stack>
  );
}

function ListaProdutos(props: {
  api: Api;
  dono: boolean;
  busca: string;
  consulta: ConsultaProdutos;
  filtrada: boolean;
  visao: VisaoProdutos;
  aoNovo: () => void;
}) {
  // Lista inteira carregada uma vez (o servidor limita em 200); busca ampla e paginação no cliente.
  // `recarregar` busca de novo sem desmontar a lista, para o pop-up do produto continuar aberto depois de editar.
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.produtos(props.consulta).then((r) => ({ ...r, itens: r.produtos })));
  const [abertoId, setAbertoId] = useState<string | null>(null);
  // ADR 016: "Carregar mais" traz as próximas páginas do servidor (recarregar volta à 1ª página).
  const mais = useMaisPaginas(carga.fase === 'pronto' ? carga.dados : null, (depois) =>
    props.api.produtos({ ...props.consulta, depois }).then((r) => ({ itens: r.produtos, proximo: r.proximo })),
  );
  const todos = carga.fase === 'pronto' ? mais.todos : SEM_PRODUTOS;
  const cortada = carga.fase === 'pronto' && mais.proximo !== null;
  // Lista cortada em 200: a busca também pergunta ao servidor (?q=) e une com o que já está carregado.
  const servidor = useBuscaNoServidor(
    cortada,
    props.busca,
    async (q) => {
      const r = await props.api.produtos({ ...props.consulta, q });
      return { itens: r.produtos, truncado: r.truncado };
    },
    carga,
  );
  const filtrados = useMemo(
    () => (props.busca === '' ? todos : mesclarBusca(todos, servidor.itens, props.busca, camposDoProduto, (p) => p.id)),
    [todos, servidor.itens, props.busca],
  );
  const pag = usePaginacao(filtrados, PRODUTOS_POR_PAGINA, props.busca);
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const truncado = avisoDeCorte(cortada, props.busca, servidor.truncado);
  const produtos = pag.itens;

  // O pop-up segue o produto pelo id (não pela busca): renomear o produto não o faz sumir da tela; arquivar o fecha.
  // O produto pode ter vindo só da busca no servidor (fora dos 200 carregados): procura nos dois.
  const aberto = todos.find((p) => p.id === abertoId) ?? servidor.itens.find((p) => p.id === abertoId);
  const detalhe = aberto && (
    <DetalheProduto
      key={aberto.id}
      api={props.api}
      dono={props.dono}
      produto={aberto}
      aoFechar={() => setAbertoId(null)}
      aoMudar={() => void recarregar()}
    />
  );

  // O pop-up fica sempre na mesma posição da árvore: trocar a lista por "Nada encontrado" não o desmonta.
  let conteudo: ReactNode;
  if (produtos.length === 0) {
    if (props.busca !== '') {
      conteudo = <EstadoVazio titulo="Nada encontrado" texto="Tente outro pedaço do nome, o código da peça ou o preço (ex.: 89,90)." />;
    } else if (props.filtrada) {
      conteudo = <EstadoVazio titulo="Nada encontrado" texto="Nenhum produto com esses filtros. Toque em Limpar filtros para ver todos." />;
    } else if (props.dono) {
      conteudo = (
        <EstadoVazio
          titulo="Nenhum produto ainda"
          texto="Cadastre o primeiro produto: tamanhos, cores, preço e quantas peças você tem."
          acao="Novo produto"
          onAcao={props.aoNovo}
        />
      );
    } else {
      conteudo = <EstadoVazio titulo="Nenhum produto ainda" texto="Quando o Dono cadastrar os produtos, eles aparecem aqui." />;
    }
  } else {
    conteudo = (
      <Stack gap="sm">
        {props.visao === 'catalogo' ? (
          <CatalogoProdutos produtos={produtos} aoAbrir={setAbertoId} />
        ) : (
          produtos.map((p) => <CartaoProduto key={p.id} produto={p} dono={props.dono} aoAbrir={() => setAbertoId(p.id)} />)
        )}
        {truncado && <Text size="sm" c="dimmed" data-aviso-corte>{AVISO_CORTE}</Text>}
        {/* "Carregar mais" acima da paginação sticky: se ficar embaixo, o rodapé cobre o botão e o toque não chega. */}
        {props.busca === '' && (
          <CarregarMais proximo={mais.proximo} carregando={mais.carregando} quantos={todos.length} aoTocar={mais.carregarMais} />
        )}
        <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
      </Stack>
    );
  }

  return (
    <>
      {conteudo}
      {detalhe}
    </>
  );
}