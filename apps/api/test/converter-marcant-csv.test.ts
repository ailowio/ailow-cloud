import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_SEED,
  converterMarcantCsv,
  limparCor,
  lerCsv,
  precoParaCentavos,
  valorOuVazio,
} from '../scripts/converter-marcant-csv.js';

// P03: só dados SINTÉTICOS aqui (o repositório é público; o arquivo do cliente fica no acervo local).

describe('precoParaCentavos: preço do arquivo vira centavos inteiros (RN-01)', () => {
  it.each([
    ['24.9', 2490],
    ['29', 2900],
    ['79.0', 7900],
    ['26.64', 2664],
    ['24,90', 2490],
    ['R$ 1.234,56', 123456],
    [' 15 ', 1500],
  ])('%s → %i', (entrada, centavos) => {
    expect(precoParaCentavos(entrada)).toBe(centavos);
  });

  it.each(['', 'A DEFINIR', 'abc', '-5', '1.999', '12.345', '0'])('%s não é preço válido', (entrada) => {
    expect(precoParaCentavos(entrada)).toBeNull();
  });
});

describe('limparCor e valorOuVazio', () => {
  it('tira o marcador " (simulado)" e deixa a cor como no seed', () => {
    expect(limparCor('PRETO (simulado)')).toBe('Preto');
    expect(limparCor('off white (simulado)')).toBe('Off White');
    expect(limparCor('Nude')).toBe('Nude');
  });

  it('"A DEFINIR" e "Não informado/a" viram vazio; o resto só perde espaços', () => {
    expect(valorOuVazio('A DEFINIR')).toBe('');
    expect(valorOuVazio(' a definir ')).toBe('');
    expect(valorOuVazio('Não informada')).toBe('');
    expect(valorOuVazio('nao informado')).toBe('');
    expect(valorOuVazio('')).toBe('');
    expect(valorOuVazio(' Renda ')).toBe('Renda');
    expect(limparCor('Não informada')).toBe('');
  });
});

describe('lerCsv: separador ";" com aspas', () => {
  it('respeita ";" e aspas dobradas dentro de campo entre aspas, CRLF e BOM', () => {
    const texto = '\uFEFFa;b;c\r\n1;"x; y";"diz ""oi"""\r\n2;;\r\n';
    expect(lerCsv(texto)).toEqual([
      { linha: 1, campos: ['a', 'b', 'c'] },
      { linha: 2, campos: ['1', 'x; y', 'diz "oi"'] },
      { linha: 3, campos: ['2', '', ''] },
    ]);
  });
});

const PRODUTOS_CSV = [
  'Produto_ID;Categoria;Linha / família;Modelo (como citado);Grade citada;Bojo;Aro;Compressão;Alça;Fornecedor',
  'X-01;Calcinha;Renda;Modelo Alfa;Slim e Plus;;;;;A DEFINIR',
  'X-02;Sutiã;Sem aro;Modelo Beta;Slim;Sim;Não;;Removível (confirmar);',
  'X-03;Categoria Inventada;Linha Teste;Modelo Gama;Slim;;;;;',
  'X-04;Acessório;Não informada;Peça Delta;Não aplicável;;;;;',
].join('\n');

const SKUS_CSV = [
  'sku_teste;produto_id;grade;tamanho;cor;fornecedor;custo_unitario;preco_varejo_teste;saldo_teste;estoque_minimo_teste;codigo_barras_real;observacoes',
  'S-01;X-01;Slim;P;PRETO (simulado);A DEFINIR;;24.9;2;3;;"nota; com separador"',
  'S-02;X-01;Slim;M;PRETO (simulado);A DEFINIR;;24.9;4;3;;',
  'S-03;X-01;Plus;G;NUDE (simulado);A DEFINIR;;29;1;3;7890000000001;',
  'S-04;X-02;Slim;42;PRETO (simulado);;;59;0;3;;',
  'S-05;X-03;Slim;P;Preto;;;10;1;1;;',
  'S-06;X-99;Slim;P;Preto;;;10;1;1;;',
  'S-07;X-01;Slim;GG;Não informada;;;24.9;1;1;;',
  'S-08;X-01;Slim;P;Preto (simulado);;;24.9;1;1;;',
  'S-09;X-02;Slim;44;Preto;;;A DEFINIR;1;1;;',
  'S-10;X-04;Não informado;Único (teste);Preto;;;15;12;4;;',
  'S-11;X-02;Slim;46;Preto;;;62.5;2;x;;',
  'S-12;X-02;Slim;48;Preto;;;64.9;1;1;;',
].join('\n');

describe('converterMarcantCsv: arquivo do Marcos → formato do seed-marcant-via-api.mjs', () => {
  const { produtos, relatorio } = converterMarcantCsv(PRODUTOS_CSV, SKUS_CSV);

  it('importados = linhas do arquivo − rejeitadas, nos dois arquivos', () => {
    expect(relatorio.linhas_produtos).toBe(4);
    expect(relatorio.linhas_skus).toBe(12);
    expect(relatorio.skus_importados).toBe(6);
    const rejSkus = relatorio.rejeitadas.filter((r) => r.arquivo === 'skus');
    const rejProdutos = relatorio.rejeitadas.filter((r) => r.arquivo === 'produtos');
    expect(relatorio.skus_importados + rejSkus.length).toBe(relatorio.linhas_skus);
    expect(rejProdutos.map((r) => r.id)).toEqual(['X-03']);
    expect(produtos.reduce((n, p) => n + p.skus.length, 0)).toBe(relatorio.skus_importados);
    expect(relatorio.produtos_gerados).toBe(produtos.length);
  });

  it('cada rejeitada diz a linha do arquivo e o motivo', () => {
    const motivo = Object.fromEntries(relatorio.rejeitadas.map((r) => [r.id, r]));
    expect(motivo['X-03']).toMatchObject({ arquivo: 'produtos', linha: 4 });
    expect(motivo['X-03']?.motivo).toMatch(/categoria/i);
    expect(motivo['S-05']).toMatchObject({ arquivo: 'skus', linha: 6 });
    expect(motivo['S-05']?.motivo).toMatch(/X-03.*rejeitado/);
    expect(motivo['S-06']?.motivo).toMatch(/X-99.*não existe/);
    expect(motivo['S-07']?.motivo).toMatch(/cor/i);
    expect(motivo['S-08']?.motivo).toMatch(/repetid/i);
    expect(motivo['S-09']?.motivo).toMatch(/preço/i);
    expect(motivo['S-11']?.motivo).toMatch(/estoque_minimo/);
    expect(Object.keys(motivo).sort()).toEqual(['S-05', 'S-06', 'S-07', 'S-08', 'S-09', 'S-11', 'X-03']);
  });

  it('agrupa por produto e porte, com nome, categoria, atributos e preço em centavos', () => {
    expect(produtos).toEqual([
      {
        nome: 'Modelo Alfa Renda',
        categoria: 'Calcinha',
        porte: 'slim',
        atributos: ['renda'],
        fornecedor: null,
        custo_centavos: 0,
        preco_centavos: 2490,
        skus: [
          { tamanho: 'P', cor: 'Preto', estoque_inicial: 2, estoque_minimo: 3, codigo_barras: '' },
          { tamanho: 'M', cor: 'Preto', estoque_inicial: 4, estoque_minimo: 3, codigo_barras: '' },
        ],
      },
      {
        nome: 'Modelo Alfa Renda Plus',
        categoria: 'Calcinha',
        porte: 'plus',
        atributos: ['renda'],
        fornecedor: null,
        custo_centavos: 0,
        preco_centavos: 2900,
        skus: [{ tamanho: 'G', cor: 'Nude', estoque_inicial: 1, estoque_minimo: 3, codigo_barras: '7890000000001' }],
      },
      {
        nome: 'Modelo Beta Sem aro',
        categoria: 'Sutiã',
        porte: 'slim',
        atributos: ['bojo', 'alça removível'],
        fornecedor: null,
        custo_centavos: 0,
        preco_centavos: 6490,
        skus: [
          { tamanho: '42', cor: 'Preto', estoque_inicial: 0, estoque_minimo: 3, codigo_barras: '' },
          { tamanho: '48', cor: 'Preto', estoque_inicial: 1, estoque_minimo: 1, codigo_barras: '' },
        ],
      },
      {
        nome: 'Peça Delta',
        categoria: 'Acessório',
        porte: 'slim',
        atributos: [],
        fornecedor: null,
        custo_centavos: 0,
        preco_centavos: 1500,
        skus: [{ tamanho: 'U', cor: 'Preto', estoque_inicial: 12, estoque_minimo: 4, codigo_barras: '' }],
      },
    ]);
  });

  it('avisa (sem rejeitar) preço diferente entre SKUs do mesmo produto e porte assumido', () => {
    expect(relatorio.avisos.some((a) => /X-02.*preço/i.test(a))).toBe(true);
    expect(relatorio.avisos.some((a) => /S-10.*porte/i.test(a))).toBe(true);
  });

  it('com corPadrao (opt-in), SKU sem cor entra com a cor dada e um aviso; sem a opção, é rejeitado', () => {
    const r = converterMarcantCsv(PRODUTOS_CSV, SKUS_CSV, { corPadrao: 'Sem cor' });
    const alfa = r.produtos.find((p) => p.nome === 'Modelo Alfa Renda');
    expect(alfa?.skus).toContainEqual({ tamanho: 'GG', cor: 'Sem Cor', estoque_inicial: 1, estoque_minimo: 1, codigo_barras: '' });
    expect(r.relatorio.rejeitadas.map((x) => x.id)).not.toContain('S-07');
    expect(r.relatorio.skus_importados).toBe(relatorio.skus_importados + 1);
    expect(r.relatorio.avisos.some((a) => /S-07.*cor/i.test(a))).toBe(true);
  });

  it('aceita os cabeçalhos curtos (Linha, Modelo, Grade)', () => {
    const r = converterMarcantCsv(
      'Produto_ID;Categoria;Linha;Modelo;Grade\nY-1;Body;;Modelo Épsilon;Plus',
      'sku_teste;produto_id;tamanho;cor;preco_varejo_teste;saldo_teste;estoque_minimo_teste\nT-1;Y-1;GG;Vinho (simulado);99.0;1;0',
    );
    expect(r.relatorio.rejeitadas).toEqual([]);
    expect(r.produtos).toEqual([
      {
        nome: 'Modelo Épsilon Plus',
        categoria: 'Body',
        porte: 'plus',
        atributos: [],
        fornecedor: null,
        custo_centavos: 0,
        preco_centavos: 9900,
        skus: [{ tamanho: 'GG', cor: 'Vinho', estoque_inicial: 1, estoque_minimo: 0, codigo_barras: '' }],
      },
    ]);
  });

  it('falha cedo quando falta coluna obrigatória, citando o nome', () => {
    expect(() => converterMarcantCsv(PRODUTOS_CSV, 'sku_teste;produto_id;tamanho;cor\nS;X-01;P;Preto')).toThrow(
      /preco_varejo_teste/,
    );
  });
});

describe('CATEGORIAS_SEED espelha as categorias do seed-marcant-via-api.mjs', () => {
  it('mesmos nomes e atributos, na mesma ordem', () => {
    const fonte = readFileSync(new URL('../scripts/seed-marcant-via-api.mjs', import.meta.url), 'utf8');
    const bloco = fonte.slice(fonte.indexOf('const CATEGORIAS = ['), fonte.indexOf('];', fonte.indexOf('const CATEGORIAS = [')));
    const doSeed = [...bloco.matchAll(/\{ nome: '([^']+)', atributos: \[([^\]]*)\] \}/g)].map((m) => ({
      nome: m[1],
      atributos: [...(m[2] ?? '').matchAll(/'([^']+)'/g)].map((a) => a[1]),
    }));
    expect(doSeed.length).toBeGreaterThan(0);
    expect(CATEGORIAS_SEED).toEqual(doSeed);
  });
});
