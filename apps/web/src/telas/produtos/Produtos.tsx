import { useEffect, useState } from 'react';
import { Badge, Button, Group, SegmentedControl, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconPlus, IconQrcode, IconSearch } from '@tabler/icons-react';
import type { Perfil, Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio, SeloEstoque, Valor } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { Moldura } from '../Moldura';
import { Etiquetas } from './Etiquetas';
import { NovoProduto } from './NovoProduto';
import { type SkuAberto, SkuFolha } from './SkuFolha';
import { linhaDoAlerta, rotuloPorte, tituloDoAlerta } from './rotulos';

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
        // Um sobre o outro: lado a lado, os dois rótulos eram cortados em 360 px.
        <Stack gap="xs">
          <Button h={48} leftSection={<IconPlus aria-hidden />} onClick={props.aoNovo}>
            Novo produto
          </Button>
          <Button h={48} variant="default" leftSection={<IconQrcode aria-hidden />} onClick={props.aoEtiquetas}>
            Etiquetas
          </Button>
        </Stack>
      )}
      {props.dono && (
        <SegmentedControl
          fullWidth
          size="lg"
          value={aba}
          onChange={(v) => setAba(v as Aba)}
          data={[
            { label: 'Todos', value: 'todos' },
            { label: 'Abaixo do mínimo', value: 'baixo' },
          ]}
          styles={{ label: { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } }}
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
          <ListaProdutos
            key={`${busca}|${rodada}`}
            api={props.api}
            dono={props.dono}
            busca={busca}
            aoNovo={props.aoNovo}
            aoAbrir={setAberto}
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
  aoNovo: () => void;
  aoAbrir: (s: SkuAberto) => void;
}) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.produtos(props.busca));
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { produtos, truncado } = carga.dados;

  if (produtos.length === 0) {
    if (props.busca !== '') {
      return <EstadoVazio titulo="Nada encontrado" texto="Tente outro pedaço do nome, o código da peça ou o preço (ex.: 89,90)." />;
    }
    return props.dono ? (
      <EstadoVazio
        titulo="Nenhum produto ainda"
        texto="Cadastre o primeiro produto: tamanhos, cores, preço e quantas peças você tem."
        acao="Novo produto"
        onAcao={props.aoNovo}
      />
    ) : (
      <EstadoVazio titulo="Nenhum produto ainda" texto="Quando o Dono cadastrar os produtos, eles aparecem aqui." />
    );
  }

  return (
    <Stack gap="sm">
      {produtos.map((p) => (
        <CartaoProduto key={p.id} produto={p} dono={props.dono} aberto={produtos.length === 1} aoAbrir={props.aoAbrir} />
      ))}
      {truncado && <Text size="sm" c="dimmed">Mostrando os primeiros 200. Digite mais letras do nome, o código ou o preço para achar o resto.</Text>}
    </Stack>
  );
}

function CartaoProduto(props: { produto: Produto; dono: boolean; aberto: boolean; aoAbrir: (s: SkuAberto) => void }) {
  const { produto: p } = props;
  const [expandido, setExpandido] = useState(props.aberto);
  const pecas = p.skus.reduce((soma, s) => soma + s.estoque, 0);

  return (
    <Stack gap="xs" className="ailow-cartao" p="md">
      <UnstyledButton onClick={() => setExpandido(!expandido)} aria-expanded={expandido} mih={48} w="100%">
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
          {expandido ? <IconChevronUp aria-hidden /> : <IconChevronDown aria-hidden />}
        </Group>
      </UnstyledButton>

      {expandido &&
        p.skus.map((s) => (
          <UnstyledButton
            key={s.id}
            className="ailow-bloco"
            mih={56}
            p="sm"
            w="100%"
            aria-label={`${s.tamanho} ${s.cor}, código ${s.codigo}, ${s.estoque} em estoque`}
            onClick={() => props.aoAbrir({ id: s.id, codigo: s.codigo, produto: p.nome, tamanho: s.tamanho, cor: s.cor, estoque: s.estoque, estoque_minimo: s.estoque_minimo })}
          >
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                  {s.tamanho} · {s.cor}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {s.codigo}
                </Text>
              </Stack>
              <SeloEstoque atual={s.estoque} minimo={s.estoque_minimo ?? 0} />
            </Group>
          </UnstyledButton>
        ))}
    </Stack>
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
