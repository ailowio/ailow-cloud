import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Badge, Group, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconChevronRight, IconListDetails, IconPlus, IconQrcode, IconSearch } from '@tabler/icons-react';
import type { Perfil, Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, Valor } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { filtrarPorBusca } from '../../lib/busca';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { Moldura } from '../Moldura';
import { PRODUTOS_POR_PAGINA, camposDoProduto } from './busca-produto';
import { DetalheProduto } from './DetalheProduto';
import { Etiquetas } from './Etiquetas';
import { NovoProduto } from './NovoProduto';
import { type SkuAberto, SkuFolha } from './SkuFolha';
import { linhaDoAlerta, rotuloPorte, tituloDoAlerta } from './rotulos';

const SEM_PRODUTOS: Produto[] = [];

type Vista = 'lista' | 'novo' | 'etiquetas';
type Aba = 'todos' | 'baixo';

/**
 * Produtos. O Dono cadastra, vê o custo e mexe no estoque; o Vendedor só consulta produto, preço e estoque
 * (RF-PRO-07). A API já não manda o custo ao Vendedor; a tela também não o mostra.
 */
export function Produtos(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const [vista, setVista] = useState<Vista>('lista');
  const [busca, setBusca] = useState('');
  const dono = props.perfil === 'dono';

  if (vista === 'etiquetas' && dono) {
    return (
      <Moldura titulo="Etiquetas" voltar={{ rotulo: 'Produtos', aoVoltar: () => setVista('lista') }}>
        <Etiquetas api={props.api} />
      </Moldura>
    );
  }

  if (vista === 'novo' && dono) {
    return (
      <Moldura titulo="Novo produto" voltar={{ rotulo: 'Produtos', aoVoltar: () => setVista('lista') }}>
        <NovoProduto
          api={props.api}
          aoCancelar={() => setVista('lista')}
          aoTerminar={(codigo) => {
            setBusca(codigo ?? '');
            setVista('lista');
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
        aoNovo={() => setVista('novo')}
        aoEtiquetas={() => setVista('etiquetas')}
      />
    </Moldura>
  );
}

function Lista(props: { api: Api; dono: boolean; buscaInicial: string; aoNovo: () => void; aoEtiquetas: () => void }) {
  const [texto, setTexto] = useState(props.buscaInicial);
  const [busca, setBusca] = useState(props.buscaInicial);
  const [aba, setAba] = useState<Aba>('todos');
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
          <ListaProdutos key={rodada} api={props.api} dono={props.dono} busca={busca} aoNovo={props.aoNovo} />
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

function ListaProdutos(props: { api: Api; dono: boolean; busca: string; aoNovo: () => void }) {
  // Lista inteira carregada uma vez (o servidor limita em 200); busca ampla e paginação no cliente.
  // `recarregar` busca de novo sem desmontar a lista, para o pop-up do produto continuar aberto depois de editar.
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.produtos());
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const todos = carga.fase === 'pronto' ? carga.dados.produtos : SEM_PRODUTOS;
  const filtrados = useMemo(() => filtrarPorBusca(todos, props.busca, camposDoProduto), [todos, props.busca]);
  const pag = usePaginacao(filtrados, PRODUTOS_POR_PAGINA);
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { truncado } = carga.dados;
  const produtos = pag.itens;

  // O pop-up segue o produto pelo id (não pela busca): renomear o produto não o faz sumir da tela; arquivar o fecha.
  const aberto = todos.find((p) => p.id === abertoId);
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
        {produtos.map((p) => (
          <CartaoProduto key={p.id} produto={p} dono={props.dono} aoAbrir={() => setAbertoId(p.id)} />
        ))}
        {truncado && <Text size="sm" c="dimmed">A busca olha os primeiros 200 produtos. Há mais no cadastro.</Text>}
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

/** Tocar no cartão abre o pop-up de detalhe do produto (UXM-10); as variações ficam lá. */
function CartaoProduto(props: { produto: Produto; dono: boolean; aoAbrir: () => void }) {
  const { produto: p } = props;
  const pecas = p.skus.reduce((soma, s) => soma + s.estoque, 0);

  return (
    <UnstyledButton className="ailow-cartao" onClick={props.aoAbrir} aria-haspopup="dialog" p="md" w="100%" mih={48} ta="left">
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {p.nome}
          </Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {p.categoria_nome} · {rotuloPorte(p.porte)} · nº {String(p.numero).padStart(4, '0')}
          </Text>
          <Group gap="sm">
            <Text fz="lg">
              <Valor centavos={p.preco_centavos} destaque />
            </Text>
            {props.dono && p.custo_centavos !== undefined && (
              <Text size="sm" c="dimmed">
                custo <Valor centavos={p.custo_centavos} />
              </Text>
            )}
          </Group>
          <Text size="sm">
            {pecas} {pecas === 1 ? 'peça' : 'peças'} · {p.skus.length} {p.skus.length === 1 ? 'variação' : 'variações'}
          </Text>
        </Stack>
        <IconChevronRight aria-hidden />
      </Group>
    </UnstyledButton>
  );
}

function AbaixoDoMinimo(props: { api: Api; aoAbrir: (s: SkuAberto) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.alertasEstoque());
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { total, itens } = carga.dados;
  if (total === 0) {
    return <EstadoVazio titulo="Tudo certo" texto="Nenhuma peça está abaixo do mínimo que você definiu." />;
  }
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color="red" size="lg">
          {tituloDoAlerta(total)}
        </Badge>
      </Group>
      {itens.map((i) => (
        <UnstyledButton
          key={i.sku_id}
          className="ailow-bloco"
          mih={56}
          p="sm"
          w="100%"
          onClick={() =>
            props.aoAbrir({ id: i.sku_id, codigo: i.codigo, produto: i.produto, tamanho: i.tamanho, cor: i.cor, estoque: i.estoque, estoque_minimo: i.estoque_minimo })
          }
        >
          <Stack gap={2}>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {linhaDoAlerta(i)}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              {i.codigo}
            </Text>
          </Stack>
        </UnstyledButton>
      ))}
      {total > itens.length && <Text size="sm" c="dimmed">Mostrando os {itens.length} mais urgentes de {total}.</Text>}
    </Stack>
  );
}
