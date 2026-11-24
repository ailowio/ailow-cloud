/**
 * P03 — Converte os CSVs do catálogo de teste do Marcos (separador ";") para o formato de produtos do
 * `seed-marcant-via-api.mjs` (nome, categoria, porte, atributos, preço/custo em centavos, SKUs).
 *
 * Uso SÓ local/dev. O arquivo do cliente fica no `acervo/` (ignorado pelo git; o repositório é público):
 *   npx tsx apps/api/scripts/converter-marcant-csv.ts <produtos.csv> <skus.csv> [--cor-padrao <cor>] [--saida <produtos.json>]
 *
 * Imprime o relatório (linhas do arquivo, importadas, rejeitadas com motivo, avisos). SKU sem cor é rejeitado, a
 * não ser com `--cor-padrao` (decisão humana; cada uso vira aviso). `--saida` grava os produtos
 * convertidos e só aceita caminho fora do repositório ou dentro de um `acervo/` (o JSON contém dado do cliente).
 * Nada é enviado à API: a carga é outro passo, só no dev / tenant de teste. Produção exige pedido explícito + AUD.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_CORES_POR_PRODUTO, MAX_SKUS_POR_PRODUTO, type Porte, chaveCor, skuNovoSchema } from '@ailow/shared';

/** Espelho das categorias do `seed-marcant-via-api.mjs` (um teste reprova se divergirem). */
export const CATEGORIAS_SEED: { nome: string; atributos: string[] }[] = [
  { nome: 'Calcinha', atributos: ['renda', 'compressão'] },
  { nome: 'Sutiã', atributos: ['bojo', 'aro', 'compressão', 'alça removível', 'renda'] },
  { nome: 'Modelador', atributos: ['compressão'] },
  { nome: 'Cinta', atributos: ['compressão'] },
  { nome: 'Body', atributos: [] },
  { nome: 'Robe', atributos: [] },
  { nome: 'Baby doll', atributos: [] },
  { nome: 'Conjunto', atributos: [] },
  { nome: 'Acessório', atributos: [] },
];

export type SkuSeed = {
  tamanho: string;
  cor: string;
  estoque_inicial: number;
  estoque_minimo: number;
  codigo_barras: string;
};
export type ProdutoSeed = {
  nome: string;
  categoria: string;
  porte: Porte;
  atributos: string[];
  fornecedor: string | null;
  custo_centavos: number;
  preco_centavos: number;
  skus: SkuSeed[];
};
export type Rejeitada = { arquivo: 'produtos' | 'skus'; linha: number; id: string; motivo: string };
export type Relatorio = {
  linhas_produtos: number;
  linhas_skus: number;
  produtos_gerados: number;
  skus_importados: number;
  rejeitadas: Rejeitada[];
  avisos: string[];
};

const semAcento = (t: string): string => t.normalize('NFD').replace(/\p{M}/gu, '');
const chave = (t: string): string => semAcento(t).toLowerCase().replace(/\s+/g, ' ').trim();
const VAZIOS = new Set(['a definir', 'nao informado', 'nao informada', 'nao detalhada']);
const semMarcadorDeTeste = (t: string): string => t.replace(/\s*\((simulado|teste)\)\s*$/i, '');

/** "A DEFINIR" / "Não informado(a)" viram vazio. */
export function valorOuVazio(v: string | undefined): string {
  const t = (v ?? '').trim();
  return VAZIOS.has(chave(t)) ? '' : t;
}

/** Tira o " (simulado)" e escreve como no seed ("PRETO (simulado)" → "Preto"). */
export function limparCor(v: string): string {
  return valorOuVazio(semMarcadorDeTeste(v))
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('pt-BR'));
}

function limparTamanho(v: string): string {
  const t = valorOuVazio(semMarcadorDeTeste(v));
  return ['unico', 'un', 'tamanho unico'].includes(chave(t)) ? 'U' : t.toUpperCase();
}

/** "24.9" → 2490; "R$ 1.234,56" → 123456. Vazio, zero, negativo ou mais de 2 casas → null. */
export function precoParaCentavos(v: string | undefined): number | null {
  let t = (v ?? '').replace(/R\$/i, '').replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return centavos > 0 ? centavos : null;
}

const inteiro = (v: string): number => {
  const t = valorOuVazio(v);
  if (t === '') return 0;
  return /^\d+$/.test(t) ? Number(t) : Number.NaN;
};

/** CSV com aspas (RFC 4180) e separador configurável; `linha` = linha do arquivo onde o registro começa. */
export function lerCsv(texto: string, separador = ';'): { linha: number; campos: string[] }[] {
  const t = texto.replace(/^\uFEFF/, '');
  const registros: { linha: number; campos: string[] }[] = [];
  let campos: string[] = [];
  let campo = '';
  let aspas = false;
  let linha = 1;
  let inicio = 1;
  const fechar = () => {
    campos.push(campo);
    if (campos.length > 1 || campos[0] !== '') registros.push({ linha: inicio, campos });
    campos = [];
    campo = '';
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else {
        if (c === '\n') linha++;
        campo += c;
      }
    } else if (c === '"') aspas = true;
    else if (c === separador) {
      campos.push(campo);
      campo = '';
    } else if (c === '\n') {
      fechar();
      linha++;
      inicio = linha;
    } else if (c !== '\r') campo += c;
  }
  if (campo !== '' || campos.length > 0) fechar();
  return registros;
}

/** "Linha / família" → linha; "Modelo (como citado)" → modelo; "Grade citada" → grade_citada. */
const chaveColuna = (h: string): string => (chave(h).split(/\s+[(/]/)[0] ?? '').trim().replace(/\s+/g, '_');

type LinhaCsv = { linha: number; v: (coluna: string) => string };

function tabela(texto: string, arquivo: string, obrigatorias: string[], apelidos: Record<string, string[]>): LinhaCsv[] {
  const [cabecalho, ...registros] = lerCsv(texto);
  const posicao = new Map<string, number>((cabecalho?.campos ?? []).map((h, i) => [chaveColuna(h), i]));
  const indice = (col: string) => [col, ...(apelidos[col] ?? [])].map((c) => posicao.get(c)).find((i) => i !== undefined);
  const faltam = obrigatorias.filter((c) => indice(c) === undefined);
  if (faltam.length > 0) throw new Error(`${arquivo}: coluna obrigatória ausente: ${faltam.join(', ')}`);
  return registros.map((r) => ({
    linha: r.linha,
    v: (col) => {
      const i = indice(col);
      return i === undefined ? '' : (r.campos[i] ?? '').trim();
    },
  }));
}

type Base = { categoria: string; linha: string; modelo: string; grade: string; atributos: string[]; fornecedor: string };

function atributosDe(l: LinhaCsv, permitidos: string[]): string[] {
  const sim = (col: string) => chave(l.v(col)).startsWith('sim');
  const linha = chave(l.v('linha'));
  const marcados = new Set<string>();
  if (sim('bojo')) marcados.add('bojo');
  if (sim('aro') || linha === 'com aro') marcados.add('aro');
  if (sim('compressao') || linha === 'compressao') marcados.add('compressão');
  if (chave(l.v('alca')).includes('remov')) marcados.add('alça removível');
  if (linha === 'renda') marcados.add('renda');
  return permitidos.filter((a) => marcados.has(a));
}

function portePorGrade(grade: string): Porte | null {
  const slim = grade.includes('slim');
  const plus = grade.includes('plus');
  if (slim === plus) return null;
  return plus ? 'plus' : 'slim';
}

function nomeDe(b: Base, porte: Porte): string {
  const nome = !b.linha || chave(b.modelo).includes(chave(b.linha)) ? b.modelo : `${b.modelo} ${b.linha}`;
  return porte === 'plus' && !chave(nome).includes('plus') ? `${nome} Plus` : nome;
}

/** Preço do produto = o mais frequente entre os SKUs; empate = o maior. */
function precoDoProduto(precos: number[]): number {
  const vezes = new Map<number, number>();
  for (const p of precos) vezes.set(p, (vezes.get(p) ?? 0) + 1);
  const [maisFrequente] = [...vezes].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (!maisFrequente) throw new Error('produto sem SKU');
  return maisFrequente[0];
}

const COLUNA_DO_CAMPO: Record<string, string> = { estoque_inicial: 'saldo_teste', estoque_minimo: 'estoque_minimo_teste' };

type Grupo = {
  id: string;
  base: Base;
  porte: Porte;
  skus: SkuSeed[];
  linhas: { linha: number; id: string }[];
  precos: number[];
  custo: number | null;
  fornecedor: string;
  variacoes: Set<string>;
  cores: Set<string>;
};

export type OpcoesConversao = {
  categorias?: { nome: string; atributos: string[] }[];
  /** Opt-in: cor para SKU sem cor no arquivo (cada uso vira aviso). Sem ela, o SKU é rejeitado. */
  corPadrao?: string;
};

export function converterMarcantCsv(
  produtosCsv: string,
  skusCsv: string,
  { categorias = CATEGORIAS_SEED, corPadrao }: OpcoesConversao = {},
): { produtos: ProdutoSeed[]; relatorio: Relatorio } {
  const linhasProdutos = tabela(produtosCsv, 'produtos', ['produto_id', 'categoria', 'linha', 'modelo'], {
    grade: ['grade_citada'],
  });
  const linhasSkus = tabela(
    skusCsv,
    'skus',
    ['sku_teste', 'produto_id', 'tamanho', 'cor', 'preco_varejo_teste', 'saldo_teste', 'estoque_minimo_teste'],
    { codigo_barras: ['codigo_barras_real'] },
  );
  const rejeitadas: Rejeitada[] = [];
  const avisos: string[] = [];
  const categoriaPorChave = new Map(categorias.map((c) => [chave(c.nome), c]));

  // Base válida do produto, ou o motivo da rejeição (para explicar os SKUs que apontam para ele).
  const bases = new Map<string, Base | string>();
  for (const l of linhasProdutos) {
    const id = l.v('produto_id');
    const rejeitar = (motivo: string) => {
      rejeitadas.push({ arquivo: 'produtos', linha: l.linha, id: id || `linha ${l.linha}`, motivo });
      if (id && !bases.has(id)) bases.set(id, motivo);
    };
    if (!id) rejeitar('sem Produto_ID');
    else if (bases.has(id)) rejeitar('Produto_ID repetido');
    else {
      const categoria = categoriaPorChave.get(chave(valorOuVazio(l.v('categoria'))));
      const modelo = valorOuVazio(l.v('modelo'));
      if (!categoria) rejeitar(`categoria "${l.v('categoria')}" fora das categorias do seed`);
      else if (!modelo) rejeitar('sem modelo');
      else
        bases.set(id, {
          categoria: categoria.nome,
          linha: valorOuVazio(l.v('linha')),
          modelo,
          grade: chave(l.v('grade')),
          atributos: atributosDe(l, categoria.atributos),
          fornecedor: valorOuVazio(l.v('fornecedor')),
        });
    }
  }

  const grupos = new Map<string, Grupo>();
  for (const l of linhasSkus) {
    const id = l.v('sku_teste') || `linha ${l.linha}`;
    const rejeitar = (motivo: string) => rejeitadas.push({ arquivo: 'skus', linha: l.linha, id, motivo });
    const produtoId = l.v('produto_id');
    const base = bases.get(produtoId);
    if (base === undefined) {
      rejeitar(`produto_id ${produtoId || '(vazio)'} não existe no arquivo de produtos`);
      continue;
    }
    if (typeof base === 'string') {
      rejeitar(`produto ${produtoId} rejeitado (${base})`);
      continue;
    }
    const preco = precoParaCentavos(l.v('preco_varejo_teste'));
    if (preco === null) {
      rejeitar('preço de varejo vazio ou inválido');
      continue;
    }
    let corDoArquivo = limparCor(l.v('cor'));
    if (!corDoArquivo && corPadrao) {
      corDoArquivo = limparCor(corPadrao);
      avisos.push(`${id}: sem cor no arquivo; usada a cor padrão`);
    }
    const sku = skuNovoSchema.safeParse({
      tamanho: limparTamanho(l.v('tamanho')),
      cor: corDoArquivo,
      estoque_inicial: inteiro(l.v('saldo_teste')),
      estoque_minimo: inteiro(l.v('estoque_minimo_teste')),
    });
    if (!sku.success) {
      const campo = (k: PropertyKey | undefined) => COLUNA_DO_CAMPO[String(k)] ?? String(k);
      rejeitar(sku.error.issues.map((i) => `${campo(i.path[0])}: ${i.message}`).join('; '));
      continue;
    }

    let porte = portePorGrade(chave(l.v('grade'))) ?? portePorGrade(base.grade);
    if (!porte) {
      porte = 'slim';
      avisos.push(`${id}: porte não informado; assumido slim`);
    }
    const chaveGrupo = `${produtoId}|${porte}`;
    let grupo = grupos.get(chaveGrupo);
    if (!grupo) {
      grupo = {
        id: produtoId,
        base,
        porte,
        skus: [],
        linhas: [],
        precos: [],
        custo: null,
        fornecedor: '',
        variacoes: new Set(),
        cores: new Set(),
      };
      grupos.set(chaveGrupo, grupo);
    }
    const { tamanho, cor, estoque_inicial, estoque_minimo } = sku.data;
    const variacao = `${tamanho}|${chaveCor(cor)}`;
    if (grupo.variacoes.has(variacao)) {
      rejeitar(`tamanho e cor repetidos no produto ${produtoId} (${porte})`);
      continue;
    }
    if (grupo.skus.length >= MAX_SKUS_POR_PRODUTO) {
      rejeitar(`produto ${produtoId} passou de ${MAX_SKUS_POR_PRODUTO} SKUs`);
      continue;
    }
    if (!grupo.cores.has(chaveCor(cor)) && grupo.cores.size >= MAX_CORES_POR_PRODUTO) {
      rejeitar(`produto ${produtoId} passou de ${MAX_CORES_POR_PRODUTO} cores`);
      continue;
    }
    grupo.variacoes.add(variacao);
    grupo.cores.add(chaveCor(cor));
    grupo.skus.push({ tamanho, cor, estoque_inicial, estoque_minimo, codigo_barras: valorOuVazio(l.v('codigo_barras')) });
    grupo.linhas.push({ linha: l.linha, id });
    grupo.precos.push(preco);
    if (grupo.custo === null && valorOuVazio(l.v('custo_unitario'))) grupo.custo = precoParaCentavos(l.v('custo_unitario'));
    grupo.fornecedor ||= valorOuVazio(l.v('fornecedor'));
  }

  const produtos: ProdutoSeed[] = [];
  for (const g of grupos.values()) {
    const nome = nomeDe(g.base, g.porte);
    if (nome.length > 80) {
      for (const s of g.linhas) rejeitadas.push({ arquivo: 'skus', ...s, motivo: `nome do produto passa de 80 letras` });
      continue;
    }
    const preco = precoDoProduto(g.precos);
    if (new Set(g.precos).size > 1)
      avisos.push(`${g.id} ${g.porte}: preço diferente entre SKUs (${new Set(g.precos).size} valores); usado ${preco}`);
    produtos.push({
      nome,
      categoria: g.base.categoria,
      porte: g.porte,
      atributos: g.base.atributos,
      fornecedor: g.fornecedor || g.base.fornecedor || null,
      custo_centavos: g.custo ?? 0,
      preco_centavos: preco,
      skus: g.skus,
    });
  }

  return {
    produtos,
    relatorio: {
      linhas_produtos: linhasProdutos.length,
      linhas_skus: linhasSkus.length,
      produtos_gerados: produtos.length,
      skus_importados: produtos.reduce((n, p) => n + p.skus.length, 0),
      rejeitadas,
      avisos,
    },
  };
}

function main(args: string[]): void {
  const flags = new Map<string, string>();
  const posicionais: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a.startsWith('--')) flags.set(a, args[++i] ?? '');
    else posicionais.push(a);
  }
  const [produtosCsv, skusCsv] = posicionais;
  const saida = flags.get('--saida');
  if (!produtosCsv || !skusCsv) {
    console.error(
      'Uso: npx tsx apps/api/scripts/converter-marcant-csv.ts <produtos.csv> <skus.csv> [--cor-padrao <cor>] [--saida <arquivo.json>]',
    );
    process.exit(1);
  }
  const { produtos, relatorio } = converterMarcantCsv(readFileSync(produtosCsv, 'utf8'), readFileSync(skusCsv, 'utf8'), {
    corPadrao: flags.get('--cor-padrao'),
  });
  console.log(JSON.stringify(relatorio, null, 2));
  if (!saida) return;
  const raiz = fileURLToPath(new URL('../../../', import.meta.url));
  const dentro = relative(raiz, resolve(saida));
  const noRepo = !dentro.startsWith('..') && !isAbsolute(dentro);
  if (noRepo && !dentro.split(sep).includes('acervo')) {
    console.error('--saida dentro do repositório só em acervo/ (o JSON tem dado do cliente)');
    process.exit(1);
  }
  writeFileSync(saida, `${JSON.stringify(produtos, null, 2)}\n`);
  console.log(`gravado: ${saida} (${produtos.length} produtos)`);
}

const chamadoDireto = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (chamadoDireto) main(process.argv.slice(2));
