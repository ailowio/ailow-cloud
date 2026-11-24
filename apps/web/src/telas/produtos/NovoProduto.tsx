import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Group, Progress, SimpleGrid, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router';
import type { Categoria, Porte } from '@ailow/shared';
import { MAX_SKUS_POR_PRODUTO, PRECO_MAXIMO_CENTAVOS, chaveCor } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { estadoDoPasso } from '../../componentes/navegacao';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { BotaoConfigCategorias } from './ConfigCategorias';
import {
  type LinhaEstoque,
  adicionarCor,
  adicionarTamanho,
  alternarCor,
  alternarTamanho,
  combinacoesComExtras,
  skusDoFormulario,
} from './grade';
import { PassoCores, PassoEixoExtra, PassoGrade, PassoTamanhos } from './PassosGrade';
import { PassoCusto, PassoPreco } from './PassosValores';
import { PORTES_DISPONIVEIS, mensagemProdutos, rotuloPorte } from './rotulos';
import { bpsParaTexto, markupBpsDoPreco, percentualParaBps, precoPorMarkup } from './valores-produto';

type PassoFixo = 'categoria' | 'modelo' | 'atributos' | 'tamanhos' | 'cores' | 'grade' | 'custo' | 'preco' | 'estoque';
type PassoEixo = `eixo:${string}`;
type Passo = PassoFixo | PassoEixo;

const ORDEM_BASE: PassoFixo[] = ['categoria', 'modelo', 'atributos', 'tamanhos', 'cores', 'grade', 'custo', 'preco', 'estoque'];

const TITULOS_FIXOS: Record<PassoFixo, string> = {
  categoria: 'Que tipo de peça é?',
  modelo: 'Nome e porte',
  atributos: 'O que ela tem?',
  tamanhos: 'Quais tamanhos?',
  cores: 'Quais cores?',
  grade: 'Confira as variações',
  custo: 'Quanto custou?',
  preco: 'Por quanto vende?',
  estoque: 'Quantas peças?',
};

function tituloDoPasso(passo: Passo, eixos: { slug: string; nome: string }[]): string {
  if (passo.startsWith('eixo:')) {
    const slug = passo.slice('eixo:'.length);
    return `Quais ${eixos.find((e) => e.slug === slug)?.nome.toLowerCase() ?? slug}?`;
  }
  return TITULOS_FIXOS[passo as PassoFixo];
}

/** RF-PRO-01: novo produto passo a passo, uma decisão por tela. Só chega aqui o Dono (a API também exige). */
export function NovoProduto(props: { api: Api; aoTerminar: (codigoParaBuscar?: string) => void; aoCancelar: () => void }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(async () => {
    const [categorias, empresa, opcoes] = await Promise.all([
      props.api.categorias('produto'),
      props.api.empresa(),
      props.api.opcoesGrade(),
    ]);
    return {
      categorias: categorias.categorias.filter((c) => c.ativa),
      markupBps: empresa.markup_bps,
      // ADR 017: só as opções ATIVAS da empresa aparecem para escolher (a configuração fica na engrenagem).
      tamanhos: opcoes.tamanhos.filter((t) => t.ativa).map((t) => t.nome),
      cores: opcoes.cores.filter((c) => c.ativa).map((c) => ({ nome: c.nome, amostra: c.amostra })),
    };
  });
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.categorias.length === 0) {
    return (
      <Stack gap="md">
        <EstadoVazio
          titulo="Nenhuma categoria de produto"
          texto="Antes do primeiro produto, crie uma categoria (ex.: Sutiã). Toque na engrenagem para criar agora."
        />
        <Group justify="center">
          <BotaoConfigCategorias api={props.api} aoFechar={() => void recarregar()} />
        </Group>
      </Stack>
    );
  }
  return (
    <Assistente
      api={props.api}
      categorias={carga.dados.categorias}
      tamanhosDisponiveis={carga.dados.tamanhos}
      coresDisponiveis={carga.dados.cores}
      markupBps={carga.dados.markupBps}
      aoRecarregarCategorias={() => void recarregar()}
      aoTerminar={props.aoTerminar}
      aoCancelar={props.aoCancelar}
    />
  );
}

/** O passo atual mora no histórico do navegador: o Voltar do sistema recua um passo antes de sair do assistente. */
const passoDoHistorico = (): Passo | undefined => (window.history.state as { usr?: { passo?: Passo } | null } | null)?.usr?.passo;

function Assistente(props: {
  api: Api;
  categorias: Categoria[];
  tamanhosDisponiveis: string[];
  coresDisponiveis: { nome: string; amostra: string | null }[];
  markupBps: number;
  /** Busca de novo categorias, tamanhos e cores (a engrenagem fechou); o assistente não perde o que foi preenchido. */
  aoRecarregarCategorias: () => void;
  aoTerminar: (codigoParaBuscar?: string) => void;
  aoCancelar: () => void;
}) {
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [porte, setPorte] = useState<Porte | null>(null);
  const [atributos, setAtributos] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [tamanhosExtras, setTamanhosExtras] = useState<string[]>([]);
  const [coresExtras, setCoresExtras] = useState<string[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [custo, setCusto] = useState<number | null>(null);
  const [preco, setPreco] = useState<number | null>(null);
  const [markupTexto, setMarkupTexto] = useState(bpsParaTexto(props.markupBps));
  const [ultimaEdicao, setUltimaEdicao] = useState<'markup' | 'preco'>('markup');
  const [fornecedor, setFornecedor] = useState('');
  const [linhas, setLinhas] = useState<Record<string, LinhaEstoque>>({});
  const [criado, setCriado] = useState<{ numero: number; codigos: string[] } | null>(null);
  const [eixosCat, setEixosCat] = useState<{ slug: string; nome: string; valores: string[] }[]>([]);
  const [escolhasExtras, setEscolhasExtras] = useState<Record<string, string[]>>({});
  const { pendente, rodar } = useAcao(mensagemProdutos);

  const categoria = props.categorias.find((c) => c.id === categoriaId) ?? null;
  const eixosExtras = eixosCat.filter((e) => e.slug !== 'tamanho' && e.slug !== 'cor');

  useEffect(() => {
    if (!categoriaId) {
      setEixosCat([]);
      setEscolhasExtras({});
      return;
    }
    let ativo = true;
    void props.api
      .eixosDaCategoria(categoriaId)
      .then(async (r) => {
        const lib = await props.api.eixosGrade().catch(() => null);
        if (!ativo) return;
        const porSlug = new Map((lib?.eixos ?? []).map((e) => [e.slug, e]));
        setEixosCat(
          r.eixos.map((e) => ({
            slug: e.slug,
            nome: e.nome,
            valores: (porSlug.get(e.slug)?.valores ?? []).filter((v) => v.ativa).map((v) => v.nome),
          })),
        );
        setEscolhasExtras({});
      })
      .catch(() => {
        if (!ativo) return;
        setEixosCat([]);
      });
    return () => {
      ativo = false;
    };
  }, [categoriaId, props.api]);

  // Passos: fixos + um por eixo extra (entre cores e grade). Atributos some se a categoria não tem.
  const passos: Passo[] = ORDEM_BASE.flatMap((p) => {
    if (p === 'atributos' && (categoria?.atributos.length ?? 0) === 0) return [];
    if (p === 'cores') {
      return [p, ...eixosExtras.map((e) => `eixo:${e.slug}` as PassoEixo)];
    }
    return [p];
  });
  const navigate = useNavigate();
  const location = useLocation();
  const doHistorico = (location.state as { passo?: Passo } | null)?.passo;
  const passoAtual: Passo = doHistorico && passos.includes(doHistorico) ? doHistorico : (passos[0] as Passo);
  const indice = passos.indexOf(passoAtual);
  const ultimo = indice === passos.length - 1;

  // Cada passo à frente empurra uma entrada no histórico; ao desmontar com entradas sobrando (seta da tela,
  // "Ver na lista"), devolve-as para o Voltar do sistema não cair em passos de um assistente que não existe mais.
  const empurrados = useRef(0);
  empurrados.current = indice;
  const navegar = useRef(navigate);
  navegar.current = navigate;
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      queueMicrotask(() => {
        if (!montado.current && empurrados.current > 0 && passoDoHistorico() !== undefined) navegar.current(-empurrados.current);
      });
    };
  }, []);

  // Passo novo, rolagem do corpo da tela no topo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o passo é o gatilho
  useEffect(() => {
    document.getElementById('conteudo')?.scrollTo({ top: 0 });
  }, [passoAtual]);

  const eixosParaGrade = eixosExtras.map((e) => ({
    slug: e.slug,
    valores: escolhasExtras[e.slug] ?? [],
  }));
  const grade = combinacoesComExtras(tamanhos, cores, eixosParaGrade);
  const { skus, pendentes } = skusDoFormulario(tamanhos, cores, linhas, eixosParaGrade);

  const custoOk = custo !== null && custo <= PRECO_MAXIMO_CENTAVOS;
  const precoOk = preco !== null && preco >= 1 && preco <= PRECO_MAXIMO_CENTAVOS;
  const podeContinuarFixo: Record<PassoFixo, boolean> = {
    categoria: categoria !== null,
    modelo: nome.trim() !== '' && porte !== null,
    atributos: true,
    tamanhos: tamanhos.length > 0,
    cores: cores.length > 0,
    grade: grade.length > 0 && grade.length <= MAX_SKUS_POR_PRODUTO,
    custo: custoOk,
    preco: precoOk,
    estoque: pendentes === 0,
  };
  function podeContinuarPasso(p: Passo): boolean {
    if (p.startsWith('eixo:')) {
      const slug = p.slice('eixo:'.length);
      return (escolhasExtras[slug] ?? []).length > 0;
    }
    return podeContinuarFixo[p as PassoFixo];
  }

  async function salvar() {
    if (!categoria || !porte || !precoOk || custo === null || pendentes !== 0) return;
    const validos = new Set(categoria.atributos);
    let resultado: { numero: number; codigos: string[] } | null = null;
    const ok = await rodar(async () => {
      const r = await props.api.criarProduto({
        nome: nome.trim(),
        categoria_id: categoria.id,
        porte,
        atributos: atributos.filter((a) => validos.has(a)),
        fornecedor: fornecedor.trim() === '' ? null : fornecedor.trim(),
        custo_centavos: custo,
        preco_centavos: preco as number,
        skus,
      });
      resultado = { numero: r.numero, codigos: r.skus.map((s) => s.codigo) };
    }, 'Produto cadastrado');
    if (ok) setCriado(resultado);
  }

  /** Ao sair do custo, preço e markup se acertam: preço digitado manda no markup; senão o markup manda no preço. */
  function reconciliarValores() {
    if (custo === null) return;
    if (ultimaEdicao === 'preco' && preco !== null) {
      const b = markupBpsDoPreco(custo, preco);
      if (b !== null) setMarkupTexto(bpsParaTexto(b));
    } else if (custo > 0) {
      setPreco(precoPorMarkup(custo, percentualParaBps(markupTexto) ?? props.markupBps));
    }
  }

  function avancar() {
    if (!podeContinuarPasso(passoAtual)) return;
    if (ultimo) {
      void salvar();
      return;
    }
    if (passoAtual === 'custo') reconciliarValores();
    navigate(location.pathname + location.search, { state: estadoDoPasso(passos[indice + 1] as Passo, indice + 1) });
  }

  function alternarExtra(slug: string, valor: string) {
    setEscolhasExtras((atual) => {
      const lista = atual[slug] ?? [];
      const next = lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
      return { ...atual, [slug]: next };
    });
  }

  function voltar() {
    if (indice === 0) props.aoCancelar();
    else navigate(-1);
  }

  if (criado) {
    return (
      <Stack gap="md" data-assistente="pronto">
        <Alert color="marca" icon={<IconCheck />} title={`Produto ${String(criado.numero).padStart(4, '0')} cadastrado`}>
          {criado.codigos.length} {criado.codigos.length === 1 ? 'peça criada' : 'peças criadas'}, cada uma com o seu código.
        </Alert>
        <Stack gap={4} className="ailow-cartao" p="md">
          {criado.codigos.map((c) => (
            <Text key={c} ff="monospace" fw={600}>
              {c}
            </Text>
          ))}
        </Stack>
        <Button h={52} fw={700} onClick={() => props.aoTerminar(criado.codigos[0])}>
          Ver na lista
        </Button>
        <Button h={52} variant="outline" color="gray" onClick={() => props.aoTerminar()}>
          Voltar para Produtos
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" className="ailow-cartao" p="md" data-assistente={passoAtual}>
      <Group justify="space-between" wrap="nowrap" gap="xs" align="center">
        <Title order={2} fz="lg" style={{ overflowWrap: 'anywhere' }}>
          {tituloDoPasso(passoAtual, eixosExtras)}
        </Title>
        {passoAtual === 'categoria' && <BotaoConfigCategorias api={props.api} aoFechar={props.aoRecarregarCategorias} />}
        {passoAtual === 'tamanhos' && <BotaoConfigCategorias api={props.api} aba="tamanhos" aoFechar={props.aoRecarregarCategorias} />}
        {passoAtual === 'cores' && <BotaoConfigCategorias api={props.api} aba="cores" aoFechar={props.aoRecarregarCategorias} />}
        {passoAtual.startsWith('eixo:') && <BotaoConfigCategorias api={props.api} aba="eixos" aoFechar={props.aoRecarregarCategorias} />}
      </Group>
      <Stack gap={6}>
        <Text size="sm" c="dimmed" data-progresso>
          Passo {indice + 1} de {passos.length}
        </Text>
        <Progress value={((indice + 1) / passos.length) * 100} size="sm" aria-label={`Passo ${indice + 1} de ${passos.length}`} />
      </Stack>

      {passoAtual === 'categoria' && (
        <Stack gap="xs" role="group" aria-label="Categoria">
          {props.categorias.map((c) => {
            const marcada = categoria?.id === c.id;
            return (
              <UnstyledButton
                key={c.id}
                className="ailow-bloco"
                mih={56}
                p="sm"
                w="100%"
                aria-pressed={marcada}
                data-destaque={marcada ? 'true' : 'false'}
                onClick={() => {
                  setCategoriaId(c.id);
                  setAtributos([]);
                }}
              >
                <Group wrap="nowrap" gap="xs">
                  {marcada && <IconCheck size={20} aria-hidden />}
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                      {c.nome}
                    </Text>
                    {c.atributos.length > 0 && (
                      <Text size="sm" style={{ overflowWrap: 'anywhere', opacity: 0.85 }}>
                        {c.atributos.join(', ')}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      )}

      {passoAtual === 'modelo' && (
        <Stack gap="md">
          <TextInput
            label="Nome do modelo"
            required
            size="lg"
            maxLength={80}
            autoComplete="off"
            placeholder="Ex.: Tomara que caia Essência"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value)}
          />
          <Stack gap={6} role="group" aria-label="Porte">
            <Text fw={500}>Porte</Text>
            <SimpleGrid cols={2} spacing="xs">
              {PORTES_DISPONIVEIS.map((p) => {
                const marcada = porte === p;
                return (
                  <Button
                    key={p}
                    h={48}
                    variant={marcada ? 'light' : 'default'}
                    aria-pressed={marcada}
                    style={marcada ? { borderWidth: 2, borderColor: 'var(--ailow-acao)' } : undefined}
                    leftSection={marcada ? <IconCheck size={16} aria-hidden /> : undefined}
                    onClick={() => setPorte(p)}
                  >
                    {rotuloPorte(p)}
                  </Button>
                );
              })}
            </SimpleGrid>
            <Text size="sm" c="dimmed">
              Slim e Plus são produtos diferentes (modelo, fornecedor e preço próprios).
            </Text>
          </Stack>
        </Stack>
      )}

      {passoAtual === 'atributos' && categoria && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Ligue o que esta peça tem.
          </Text>
          {categoria.atributos.map((a) => (
            <Switch
              key={a}
              size="lg"
              label={a}
              // Linha inteira com 48 px de altura: o alvo de toque padrão do Switch tem 30 px.
              styles={{ body: { minHeight: 48, alignItems: 'center' }, label: { paddingBlock: 12 }, input: { minHeight: 48 } }}
              checked={atributos.includes(a)}
              onChange={(e) => setAtributos(e.currentTarget.checked ? [...atributos, a] : atributos.filter((x) => x !== a))}
            />
          ))}
        </Stack>
      )}

      {passoAtual === 'tamanhos' && (
        <PassoTamanhos
          disponiveis={props.tamanhosDisponiveis}
          tamanhos={tamanhos}
          extras={tamanhosExtras}
          aoAlternar={(t) => setTamanhos(alternarTamanho(tamanhos, t))}
          aoAdicionar={(t) => {
            const novos = adicionarTamanho(tamanhos, t);
            if (novos.length === tamanhos.length) return;
            const t2 = t.trim().toUpperCase();
            setTamanhos(novos);
            if (!props.tamanhosDisponiveis.includes(t2) && !tamanhosExtras.includes(t2)) {
              setTamanhosExtras([...tamanhosExtras, t2]);
            }
          }}
        />
      )}

      {passoAtual === 'cores' && (
        <PassoCores
          disponiveis={props.coresDisponiveis}
          cores={cores}
          extras={coresExtras}
          aoAlternar={(c) => setCores(alternarCor(cores, c))}
          aoAdicionar={(c) => {
            // Cor que já existe na lista (mesmo escrita de outro jeito) só é marcada; não vira um chip repetido.
            const existente = [...props.coresDisponiveis.map((x) => x.nome), ...coresExtras].find((x) => chaveCor(x) === chaveCor(c));
            if (existente) {
              setCores(adicionarCor(cores, existente));
              return;
            }
            const novas = adicionarCor(cores, c);
            if (novas.length > cores.length) {
              setCores(novas);
              setCoresExtras([...coresExtras, c.trim()]);
            }
          }}
        />
      )}

      {passoAtual.startsWith('eixo:') &&
        (() => {
          const slug = passoAtual.slice('eixo:'.length);
          const eixo = eixosExtras.find((e) => e.slug === slug);
          if (!eixo) return null;
          return (
            <PassoEixoExtra
              nome={eixo.nome}
              disponiveis={eixo.valores}
              escolhidos={escolhasExtras[slug] ?? []}
              aoAlternar={(v) => alternarExtra(slug, v)}
            />
          );
        })()}

      {passoAtual === 'grade' && <PassoGrade grade={grade} tamanhos={tamanhos} cores={cores} />}

      {passoAtual === 'custo' && (
        <PassoCusto custo={custo} aoMudarCusto={setCusto} fornecedor={fornecedor} aoMudarFornecedor={setFornecedor} />
      )}

      {passoAtual === 'preco' && (
        <PassoPreco
          custo={custo ?? 0}
          preco={preco}
          markupTexto={markupTexto}
          aoMudarPreco={(p, texto) => {
            setPreco(p);
            setMarkupTexto(texto);
            setUltimaEdicao('preco');
          }}
          aoMudarMarkup={(texto, p) => {
            setMarkupTexto(texto);
            setPreco(p);
            setUltimaEdicao('markup');
          }}
        />
      )}

      {passoAtual === 'estoque' && <EstoquePorSku grade={grade} linhas={linhas} aoMudar={setLinhas} pendentes={pendentes} />}

      {/* Mesma ordem em todos os passos: secundário (contornado, 1/3) à esquerda e principal (cheio, 2/3) à direita. */}
      <Box className="ailow-rodape-assistente" data-rodape-assistente>
        <Group wrap="nowrap" gap="sm">
          <Button
            data-botao="secundario"
            h={52}
            px="xs"
            variant="outline"
            color="gray"
            disabled={pendente}
            onClick={voltar}
            style={{ flex: '1 1 0' }}
          >
            {indice === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            data-botao="principal"
            h={52}
            px="xs"
            fw={700}
            onClick={avancar}
            loading={pendente}
            disabled={!podeContinuarPasso(passoAtual)}
            style={{ flex: '2 1 0' }}
          >
            {ultimo ? 'Salvar produto' : 'Continuar'}
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}

function EstoquePorSku(props: {
  grade: ReturnType<typeof combinacoesComExtras>;
  linhas: Record<string, LinhaEstoque>;
  aoMudar: (l: Record<string, LinhaEstoque>) => void;
  pendentes: number;
}) {
  const [todosInicial, setTodosInicial] = useState('');
  const [todosMinimo, setTodosMinimo] = useState('');

  function mudar(chave: string, campo: keyof LinhaEstoque, valor: string) {
    const atual = props.linhas[chave] ?? { inicial: '', minimo: '' };
    props.aoMudar({ ...props.linhas, [chave]: { ...atual, [campo]: valor } });
  }

  function aplicarATodos() {
    const novas: Record<string, LinhaEstoque> = { ...props.linhas };
    for (const g of props.grade) {
      const atual = novas[g.chave] ?? { inicial: '', minimo: '' };
      novas[g.chave] = {
        inicial: todosInicial.trim() !== '' ? todosInicial.trim() : atual.inicial,
        minimo: todosMinimo.trim() !== '' ? todosMinimo.trim() : atual.minimo,
      };
    }
    props.aoMudar(novas);
  }

  return (
    <Stack gap="md">
      <Stack gap="xs" className="ailow-cartao" p="sm">
        <Text fw={600}>Mesmo valor para todos</Text>
        <SimpleGrid cols={2} spacing="xs">
          <TextInput label="Tenho" size="lg" inputMode="numeric" autoComplete="off" placeholder="0" value={todosInicial} onChange={(e) => setTodosInicial(e.currentTarget.value)} />
          <TextInput label="Mínimo" size="lg" inputMode="numeric" autoComplete="off" placeholder="1" value={todosMinimo} onChange={(e) => setTodosMinimo(e.currentTarget.value)} />
        </SimpleGrid>
        <Button h={48} variant="light" onClick={aplicarATodos} disabled={todosInicial.trim() === '' && todosMinimo.trim() === ''}>
          Aplicar a todos
        </Button>
      </Stack>
      <Text size="sm" c="dimmed">
        “Mínimo” é a quantidade abaixo da qual você quer ser avisado. Use 0 se não quiser aviso.
      </Text>
      {props.grade.map((g) => {
        const linha = props.linhas[g.chave] ?? { inicial: '', minimo: '' };
        return (
          <Stack key={g.chave} gap={6} pb="sm" style={{ borderBottom: '1px solid var(--ailow-borda)' }}>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {[g.tamanho, g.cor, ...g.extras.map((e) => e.valor)].join(' · ')}
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              <TextInput
                label="Tenho"
                size="lg"
                inputMode="numeric"
                autoComplete="off"
                value={linha.inicial}
                onChange={(e) => mudar(g.chave, 'inicial', e.currentTarget.value)}
              />
              <TextInput
                label="Mínimo"
                size="lg"
                inputMode="numeric"
                autoComplete="off"
                value={linha.minimo}
                onChange={(e) => mudar(g.chave, 'minimo', e.currentTarget.value)}
              />
            </SimpleGrid>
          </Stack>
        );
      })}
      <Text fw={600} role="status">
        {props.pendentes === 0 ? 'Tudo preenchido.' : `Faltam preencher ${props.pendentes} ${props.pendentes === 1 ? 'linha' : 'linhas'}.`}
      </Text>
    </Stack>
  );
}
