/**
 * Seed Marcant via API HTTP (produção ou DEMO_BASE).
 * - Estrutura: categorias + opções de grade (tamanho/cor) + eixos se a API já tiver /eixos-grade
 * - Produtos estimados (flag --com-produtos): preços/estoques de homologação curada, marcados no nome
 *
 * Uso:
 *   DEMO_BASE=https://cloud.ailow.com.br DEMO_EMAIL=... DEMO_SENHA=... \
 *     node apps/api/scripts/seed-marcant-via-api.mjs [--dry-run] [--com-produtos]
 *
 * Não imprime a senha. Guarda só contagens no log.
 */
const BASE = (process.env.DEMO_BASE || 'https://cloud.ailow.com.br').replace(/\/$/, '');
const email = (process.env.DEMO_EMAIL || '').trim().toLowerCase();
const senha = process.env.DEMO_SENHA || '';
const dryRun = process.argv.includes('--dry-run');
const comProdutos = process.argv.includes('--com-produtos');

if (!dryRun && (!email || senha.length < 10)) {
  console.error('Defina DEMO_EMAIL e DEMO_SENHA (Dono da Marcant, >=10 chars).');
  process.exit(1);
}

const CATEGORIAS = [
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

/** Peças carro-chefe estimadas (centavos). Fonte: discovery Marcant / planilha P1; NÃO são refs fiscais. */
const PRODUTOS_ESTIMADOS = [
  {
    nome: 'Caleçon Renda (est.)',
    categoria: 'Calcinha',
    porte: 'slim',
    atributos: ['renda'],
    custo_centavos: 1200,
    preco_centavos: 2490,
    skus: [
      { tamanho: 'P', cor: 'Preto', estoque_inicial: 4, estoque_minimo: 2 },
      { tamanho: 'M', cor: 'Preto', estoque_inicial: 4, estoque_minimo: 2 },
      { tamanho: 'G', cor: 'Nude', estoque_inicial: 3, estoque_minimo: 2 },
      { tamanho: 'GG', cor: 'Nude', estoque_inicial: 2, estoque_minimo: 2 },
    ],
  },
  {
    nome: 'Caleçon Renda Plus (est.)',
    categoria: 'Calcinha',
    porte: 'plus',
    atributos: ['renda'],
    custo_centavos: 1400,
    preco_centavos: 2990,
    skus: [
      { tamanho: 'G', cor: 'Preto', estoque_inicial: 3, estoque_minimo: 2 },
      { tamanho: 'GG', cor: 'Preto', estoque_inicial: 3, estoque_minimo: 2 },
    ],
  },
  {
    nome: 'Tomara que caia Essência (est.)',
    categoria: 'Sutiã',
    porte: 'slim',
    atributos: ['bojo'],
    custo_centavos: 1800,
    preco_centavos: 2900,
    skus: [
      { tamanho: '42', cor: 'Chocolate', estoque_inicial: 2, estoque_minimo: 2 },
      { tamanho: '44', cor: 'Chocolate', estoque_inicial: 3, estoque_minimo: 2 },
      { tamanho: '46', cor: 'Chocolate', estoque_inicial: 3, estoque_minimo: 2 },
      { tamanho: '48', cor: 'Preto', estoque_inicial: 2, estoque_minimo: 2 },
    ],
  },
  {
    nome: 'Tomara que caia Plus (est.)',
    categoria: 'Sutiã',
    porte: 'plus',
    atributos: ['bojo'],
    custo_centavos: 2800,
    preco_centavos: 5900,
    skus: [
      { tamanho: '50', cor: 'Chocolate', estoque_inicial: 2, estoque_minimo: 2 },
      { tamanho: '52', cor: 'Chocolate', estoque_inicial: 2, estoque_minimo: 2 },
      { tamanho: '54', cor: 'Preto', estoque_inicial: 1, estoque_minimo: 1 },
    ],
  },
  {
    nome: 'Baby doll Short (est.)',
    categoria: 'Baby doll',
    porte: 'slim',
    atributos: [],
    custo_centavos: 3500,
    preco_centavos: 8900,
    skus: [
      { tamanho: 'P', cor: 'Preto', estoque_inicial: 2, estoque_minimo: 1 },
      { tamanho: 'M', cor: 'Vermelho', estoque_inicial: 2, estoque_minimo: 1 },
      { tamanho: 'G', cor: 'Preto', estoque_inicial: 1, estoque_minimo: 1 },
    ],
  },
  {
    nome: 'Protetor de mamilo (est.)',
    categoria: 'Acessório',
    porte: 'slim',
    atributos: [],
    custo_centavos: 400,
    preco_centavos: 1500,
    skus: [{ tamanho: 'U', cor: 'Nude', estoque_inicial: 12, estoque_minimo: 4 }],
  },
];

const jar = new Map();

function parseSetCookie(res) {
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  parseSetCookie(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { bruto: text };
  }
  return { status: res.status, json };
}

async function main() {
  console.log(JSON.stringify({ base: BASE, email: email || null, dryRun, comProdutos, categorias: CATEGORIAS.length, produtos: PRODUTOS_ESTIMADOS.length }, null, 2));
  if (dryRun) {
    console.log('dry-run: nada gravado');
    return;
  }

  const login = await api('POST', '/acesso/entrar', { email, senha });
  if (login.status !== 200) {
    console.error('Login Dono falhou', login.status, login.json);
    process.exit(1);
  }

  const cats = await api('GET', '/categorias?tipo=produto');
  if (cats.status !== 200) throw new Error(`categorias ${cats.status}`);
  const porNome = new Map((cats.json.categorias || []).map((c) => [c.nome.toLowerCase(), c]));

  for (const cat of CATEGORIAS) {
    const key = cat.nome.toLowerCase();
    if (porNome.has(key)) {
      const id = porNome.get(key).id;
      await api('PUT', `/categorias/${id}`, { nome: cat.nome, atributos: cat.atributos, ativa: true });
      continue;
    }
    const r = await api('POST', '/categorias', { nome: cat.nome, atributos: cat.atributos, tipo: 'produto' });
    if (r.status !== 201) throw new Error(`criar categoria ${cat.nome}: ${r.status} ${JSON.stringify(r.json)}`);
    porNome.set(key, { id: r.json.id, nome: cat.nome });
  }

  // Semente de grade (ADR 017) — 1ª leitura cria padrões
  await api('GET', '/opcoes-grade');

  const eixos = await api('GET', '/eixos-grade');
  if (eixos.status === 200) {
    console.log('API já tem eixos-grade; semeando Taça se faltar');
    const temTaca = (eixos.json.eixos || []).some((e) => e.slug === 'taca');
    if (!temTaca) {
      const criado = await api('POST', '/eixos-grade', { nome: 'Taça', tipo_valor: 'texto' });
      if (criado.status === 201) {
        for (const nome of ['A', 'B', 'C', 'D']) {
          await api('POST', `/eixos-grade/${criado.json.id}/valores`, { nome });
        }
      }
    }
    // Liga só tamanho+cor nas categorias (Taça fica na biblioteca)
    const lib = await api('GET', '/eixos-grade');
    const tam = (lib.json.eixos || []).find((e) => e.slug === 'tamanho');
    const cor = (lib.json.eixos || []).find((e) => e.slug === 'cor');
    if (tam && cor) {
      for (const [, c] of porNome) {
        await api('PUT', `/categorias/${c.id}/eixos`, {
          eixos: [
            { eixo_id: tam.id, seq: 0 },
            { eixo_id: cor.id, seq: 1 },
          ],
        });
      }
    }
  } else {
    console.log('eixos-grade ainda não no ar (HTTP', eixos.status, ') — só categorias/opcoes-grade/produtos');
  }

  let criados = 0;
  if (comProdutos) {
    const lista = await api('GET', '/produtos');
    const ja = new Set((lista.json?.produtos || []).map((p) => p.nome.toLowerCase()));
    for (const p of PRODUTOS_ESTIMADOS) {
      if (ja.has(p.nome.toLowerCase())) {
        console.log('já existe:', p.nome);
        continue;
      }
      const cat = porNome.get(p.categoria.toLowerCase());
      if (!cat) throw new Error(`categoria sumiu: ${p.categoria}`);
      const r = await api('POST', '/produtos', {
        nome: p.nome,
        categoria_id: cat.id,
        porte: p.porte,
        atributos: p.atributos,
        fornecedor: null,
        custo_centavos: p.custo_centavos,
        preco_centavos: p.preco_centavos,
        skus: p.skus,
      });
      if (r.status !== 201) throw new Error(`produto ${p.nome}: ${r.status} ${JSON.stringify(r.json)}`);
      criados += 1;
      console.log('produto:', p.nome, '→', r.json.numero, `(${r.json.skus.length} SKUs)`);
    }
  }

  await api('POST', '/acesso/sair');
  console.log(JSON.stringify({ ok: true, categorias: CATEGORIAS.length, produtos_criados: criados }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
