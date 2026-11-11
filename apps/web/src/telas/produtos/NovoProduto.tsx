import { useState } from 'react';
import { Alert, Button, Group, Progress, SimpleGrid, Stack, Switch, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type { Categoria, Porte } from '@ailow/shared';
import { MAX_SKUS_POR_PRODUTO, PRECO_MAXIMO_CENTAVOS, chaveCor } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { centavosParaTexto, formatarReais } from '../../lib/dinheiro';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import {
  CORES_SUGERIDAS,
  GRADES,
  type LinhaEstoque,
  adicionarCor,
  adicionarTamanho,
  alternarCor,
  alternarTamanho,
  combinacoes,
  precosDoFormulario,
  skusDoFormulario,
} from './grade';
import { PORTES_DISPONIVEIS, mensagemProdutos, rotuloPorte } from './rotulos';

type Passo = 'categoria' | 'modelo' | 'atributos' | 'grade' | 'valores' | 'estoque';

const TITULOS: Record<Passo, string> = {
  categoria: 'Que tipo de peça é?',
  modelo: 'Nome e porte',
  atributos: 'O que ela tem?',
  grade: 'Tamanhos e cores',
  valores: 'Custo e preço',
  estoque: 'Quantas peças?',
};

/** RF-PRO-01: novo produto passo a passo, uma decisão por tela. Só chega aqui o Dono (a API também exige). */
export function NovoProduto(props: { api: Api; aoTerminar: (codigoParaBuscar?: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(async () => {
    const [categorias, empresa] = await Promise.all([props.api.categorias('produto'), props.api.empresa()]);
    return { categorias: categorias.categorias.filter((c) => c.ativa), markupBps: empresa.markup_bps };
  });
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.categorias.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma categoria de produto"
        texto="Antes do primeiro produto, crie uma categoria (ex.: Sutiã) em Configurações › Categorias › Produtos."
      />
    );
  }
  return <Assistente api={props.api} categorias={carga.dados.categorias} markupBps={carga.dados.markupBps} aoTerminar={props.aoTerminar} />;
}

function Assistente(props: {
  api: Api;
  categorias: Categoria[];
  markupBps: number;
  aoTerminar: (codigoParaBuscar?: string) => void;
}) {
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [porte, setPorte] = useState<Porte | null>(null);
  const [atributos, setAtributos] = useState<string[]>([]);
  const [candidatos, setCandidatos] = useState<string[]>([]);
  const [tamanhos, setTamanhos] = useState<string[]>([]);
  const [coresExtras, setCoresExtras] = useState<string[]>([]);
  const [cores, setCores] = useState<string[]>([]);
  const [custoTexto, setCustoTexto] = useState('');
  const [precoTexto, setPrecoTexto] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [linhas, setLinhas] = useState<Record<string, LinhaEstoque>>({});
  const [criado, setCriado] = useState<{ numero: number; codigos: string[] } | null>(null);
  const { pendente, erro, rodar } = useAcao(mensagemProdutos);

  // O passo "O que ela tem?" some quando a categoria não tem atributos.
  const passos: Passo[] = (['categoria', 'modelo', 'atributos', 'grade', 'valores', 'estoque'] as Passo[]).filter(
    (p) => p !== 'atributos' || (categoria?.atributos.length ?? 0) > 0,
  );
  const [passoAtual, setPassoAtual] = useState<Passo>('categoria');
  const indice = passos.indexOf(passoAtual);
  const ultimo = indice === passos.length - 1;

  const grade = combinacoes(tamanhos, cores);
  const precos = precosDoFormulario(custoTexto, precoTexto, props.markupBps);
  const { skus, pendentes } = skusDoFormulario(tamanhos, cores, linhas);

  const custoOk = precos.custo !== null && precos.custo <= PRECO_MAXIMO_CENTAVOS;
  const precoOk = precos.preco !== null && precos.preco >= 1 && precos.preco <= PRECO_MAXIMO_CENTAVOS;
  const podeContinuar: Record<Passo, boolean> = {
    categoria: categoria !== null,
    modelo: nome.trim() !== '' && porte !== null,
    atributos: true,
    grade: grade.length > 0 && grade.length <= MAX_SKUS_POR_PRODUTO,
    valores: custoOk && precoOk,
    estoque: pendentes === 0,
  };

  async function salvar() {
    if (!categoria || !porte || !precoOk || precos.custo === null || pendentes !== 0) return;
    let resultado: { numero: number; codigos: string[] } | null = null;
    const ok = await rodar(async () => {
      const r = await props.api.criarProduto({
        nome: nome.trim(),
        categoria_id: categoria.id,
        porte,
        atributos,
        fornecedor: fornecedor.trim() === '' ? null : fornecedor.trim(),
        custo_centavos: precos.custo as number,
        preco_centavos: precos.preco as number,
        skus,
      });
      resultado = { numero: r.numero, codigos: r.skus.map((s) => s.codigo) };
    }, 'Produto cadastrado');
    if (ok) setCriado(resultado);
  }

  function avancar() {
    if (!podeContinuar[passoAtual]) return;
    if (ultimo) void salvar();
    else setPassoAtual(passos[indice + 1] as Passo);
  }

  if (criado) {
    return (
      <Stack gap="md">
        <Alert color="teal" icon={<IconCheck />} title={`Produto ${String(criado.numero).padStart(4, '0')} cadastrado`}>
          {criado.codigos.length} {criado.codigos.length === 1 ? 'peça criada' : 'peças criadas'}, cada uma com o seu código.
        </Alert>
        <Stack gap={4} className="ailow-cartao" p="md">
          {criado.codigos.map((c) => (
            <Text key={c} ff="monospace" fw={600}>
              {c}
            </Text>
          ))}
        </Stack>
        <Button h={48} onClick={() => props.aoTerminar(criado.codigos[0])}>
          Ver na lista
        </Button>
        <Button h={48} variant="default" onClick={() => props.aoTerminar()}>
          Voltar para Produtos
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" className="ailow-cartao" p="md">
      <Group justify="space-between" gap="xs">
        <Text fw={650} fz="lg">
          {TITULOS[passoAtual]}
        </Text>
        <Text size="sm" c="dimmed">
          Passo {indice + 1} de {passos.length}
        </Text>
      </Group>
      <Progress value={((indice + 1) / passos.length) * 100} size="sm" aria-label={`Passo ${indice + 1} de ${passos.length}`} />

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
                  setCategoria(c);
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
                    variant={marcada ? 'filled' : 'default'}
                    aria-pressed={marcada}
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
              onChange={(e) =>
                setAtributos(e.currentTarget.checked ? [...atributos, a] : atributos.filter((x) => x !== a))
              }
            />
          ))}
        </Stack>
      )}

      {passoAtual === 'grade' && (
        <GradeTamanhosCores
          candidatos={candidatos}
          tamanhos={tamanhos}
          coresExtras={coresExtras}
          cores={cores}
          total={grade.length}
          aoEscolherGrade={(lista) => {
            setCandidatos([...lista]);
            setTamanhos([...lista]);
          }}
          aoAlternarTamanho={(t) => setTamanhos(alternarTamanho(tamanhos, t))}
          aoAdicionarTamanho={(t) => {
            setCandidatos(adicionarTamanho(candidatos, t));
            setTamanhos(adicionarTamanho(tamanhos, t));
          }}
          aoAlternarCor={(c) => setCores(alternarCor(cores, c))}
          aoAdicionarCor={(c) => {
            // Cor que já existe na lista (mesmo escrita de outro jeito) só é marcada; não vira um botão repetido.
            const existente = [...CORES_SUGERIDAS, ...coresExtras].find((x) => chaveCor(x) === chaveCor(c));
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

      {passoAtual === 'valores' && (
        <Stack gap="md">
          <TextInput
            label="Quanto custou cada peça?"
            required
            size="lg"
            inputMode="decimal"
            autoComplete="off"
            placeholder="45,00"
            leftSection={<Text fw={600}>R$</Text>}
            leftSectionWidth={48}
            value={custoTexto}
            onChange={(e) => setCustoTexto(e.currentTarget.value)}
            error={custoTexto.trim() !== '' && !custoOk ? 'Escreva o valor com vírgula, por exemplo 45,00.' : undefined}
          />
          <TextInput
            label="Por quanto você vende?"
            required
            size="lg"
            inputMode="decimal"
            autoComplete="off"
            placeholder="89,90"
            leftSection={<Text fw={600}>R$</Text>}
            leftSectionWidth={48}
            value={precoTexto}
            onChange={(e) => setPrecoTexto(e.currentTarget.value)}
            error={precoTexto.trim() !== '' && !precoOk ? 'Escreva o valor com vírgula, por exemplo 89,90 (até 20 milhões).' : undefined}
            description={precoOk && precos.preco !== null ? `Fica ${formatarReais(precos.preco)}` : undefined}
          />
          {precos.sugerido !== null && precos.sugerido !== precos.preco && (
            <Stack gap={6}>
              <Text size="sm">
                Pelo markup de {props.markupBps / 100}% da loja, o preço sugerido é <strong>{formatarReais(precos.sugerido)}</strong>. O preço
                é sempre seu.
              </Text>
              <Button h={48} variant="default" onClick={() => setPrecoTexto(centavosParaTexto(precos.sugerido as number))}>
                Usar {formatarReais(precos.sugerido)}
              </Button>
            </Stack>
          )}
          <TextInput
            label="Fornecedor (opcional)"
            size="lg"
            maxLength={80}
            placeholder="Ex.: Fina Paixão"
            value={fornecedor}
            onChange={(e) => setFornecedor(e.currentTarget.value)}
          />
        </Stack>
      )}

      {passoAtual === 'estoque' && (
        <EstoquePorSku
          grade={grade}
          linhas={linhas}
          aoMudar={setLinhas}
          pendentes={pendentes}
        />
      )}

      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      {/* Rótulos inteiros em 360 px (D23): padding menor e, no último passo ("Salvar produto"), um botão por linha. */}
      <SimpleGrid cols={ultimo ? 1 : 2} spacing="xs">
        <Button
          h={48}
          px="xs"
          variant="default"
          disabled={indice === 0 || pendente}
          onClick={() => setPassoAtual(passos[indice - 1] as Passo)}
          style={{ order: ultimo ? 2 : 0 }}
        >
          Voltar
        </Button>
        <Button h={48} px="xs" onClick={avancar} loading={pendente} disabled={!podeContinuar[passoAtual]}>
          {ultimo ? 'Salvar produto' : 'Continuar'}
        </Button>
      </SimpleGrid>
    </Stack>
  );
}

function GradeTamanhosCores(props: {
  candidatos: string[];
  tamanhos: string[];
  coresExtras: string[];
  cores: string[];
  total: number;
  aoEscolherGrade: (lista: readonly string[]) => void;
  aoAlternarTamanho: (t: string) => void;
  aoAdicionarTamanho: (t: string) => void;
  aoAlternarCor: (c: string) => void;
  aoAdicionarCor: (c: string) => void;
}) {
  const [outroTamanho, setOutroTamanho] = useState('');
  const [outraCor, setOutraCor] = useState('');
  const todasAsCores = [...CORES_SUGERIDAS, ...props.coresExtras];

  return (
    <Stack gap="lg">
      <Stack gap="xs" role="group" aria-label="Tamanhos">
        <Text fw={500}>Tamanhos</Text>
        <Stack gap="xs">
          {GRADES.map((g) => (
            <Button key={g.id} h={48} variant="default" onClick={() => props.aoEscolherGrade(g.tamanhos)}>
              {g.rotulo}
            </Button>
          ))}
        </Stack>
        {props.candidatos.length > 0 && (
          <SimpleGrid cols={4} spacing="xs">
            {props.candidatos.map((t) => {
              const marcado = props.tamanhos.includes(t);
              return (
                <Button
                  key={t}
                  h={48}
                  px={4}
                  variant={marcado ? 'filled' : 'default'}
                  aria-pressed={marcado}
                  onClick={() => props.aoAlternarTamanho(t)}
                >
                  {t}
                </Button>
              );
            })}
          </SimpleGrid>
        )}
        <Group wrap="nowrap" align="flex-end" gap="xs">
          <TextInput
            label="Outro tamanho"
            size="lg"
            maxLength={3}
            placeholder="Ex.: G1"
            style={{ flex: 1 }}
            value={outroTamanho}
            onChange={(e) => setOutroTamanho(e.currentTarget.value)}
          />
          <Button
            h={50}
            variant="default"
            onClick={() => {
              props.aoAdicionarTamanho(outroTamanho);
              setOutroTamanho('');
            }}
            disabled={outroTamanho.trim() === ''}
          >
            Adicionar
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs" role="group" aria-label="Cores">
        <Text fw={500}>Cores</Text>
        <SimpleGrid cols={2} spacing="xs">
          {todasAsCores.map((c) => {
            const marcada = props.cores.some((x) => x.toLowerCase() === c.toLowerCase());
            return (
              <Button
                key={c}
                h={48}
                px={6}
                variant={marcada ? 'filled' : 'default'}
                aria-pressed={marcada}
                leftSection={marcada ? <IconCheck size={16} aria-hidden /> : undefined}
                onClick={() => props.aoAlternarCor(c)}
              >
                {c}
              </Button>
            );
          })}
        </SimpleGrid>
        <Group wrap="nowrap" align="flex-end" gap="xs">
          <TextInput
            label="Outra cor"
            size="lg"
            maxLength={30}
            placeholder="Ex.: Rosa chá"
            style={{ flex: 1 }}
            value={outraCor}
            onChange={(e) => setOutraCor(e.currentTarget.value)}
          />
          <Button
            h={50}
            variant="default"
            onClick={() => {
              props.aoAdicionarCor(outraCor);
              setOutraCor('');
            }}
            disabled={outraCor.trim() === ''}
          >
            Adicionar
          </Button>
        </Group>
      </Stack>

      <Text fw={600} role="status">
        {props.total === 0
          ? 'Escolha ao menos um tamanho e uma cor.'
          : `${props.total} ${props.total === 1 ? 'variação' : 'variações'} (tamanho × cor)`}
      </Text>
      {props.total > MAX_SKUS_POR_PRODUTO && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          O máximo é {MAX_SKUS_POR_PRODUTO} variações por produto. Tire alguns tamanhos ou cores.
        </Alert>
      )}
    </Stack>
  );
}

function EstoquePorSku(props: {
  grade: ReturnType<typeof combinacoes>;
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
        <Button h={48} variant="default" onClick={aplicarATodos} disabled={todosInicial.trim() === '' && todosMinimo.trim() === ''}>
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
              {g.tamanho} · {g.cor}
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
