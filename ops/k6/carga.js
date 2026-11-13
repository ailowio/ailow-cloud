// Teste de carga do Ailow Cloud (S13b, PRD §10.7, RNF-01/02). Roda no contêiner grafana/k6 via `bash scripts/carga.sh`.
//   PERFIL=smoke   1 VU, curto: o caminho feliz responde e os thresholds de RNF-01/02 valem (roda em todo PR).
//   PERFIL=carga   50 VUs: o critério do PRD. Reprova se RNF-01 ou RNF-02 forem violados.
//   PERFIL=estresse  sobe em degraus além de 50 VUs; thresholds próprios (erro < 5%, p99 limitado) e uma tabela dizendo
//                  em qual degrau cada RNF deixa de valer (informativo: o RNF é só até 50 VUs).
// Entradas (ambiente): BASE_URL, COOKIE (sessão do Dono descartável), RUN_ID. Opcionais: P95_VENDA_MS (500) e
// P95_BUSCA_MS (300), usados pelo canário que prova que o threshold reprova de verdade.
// Cada requisição leva a tag `endpoint` (buscar_produto | finalizar_venda); o setup() usa `setup` e fica de fora.
// A busca leva também `tipo` (modelo | ampla), só para o resumo mostrar o p95 de cada uma (diagnóstico do RNF-02).
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL;
const COOKIE = __ENV.COOKIE;
const RUN_ID = __ENV.RUN_ID || 'local';
const PERFIL = __ENV.PERFIL || 'smoke';
const P95_VENDA = Number(__ENV.P95_VENDA_MS || 500); // RNF-01
const P95_BUSCA = Number(__ENV.P95_BUSCA_MS || 300); // RNF-02
if (!BASE || !COOKIE) throw new Error('defina BASE_URL e COOKIE');

// Só 2xx esperado: o 409 de estoque NÃO deveria ocorrer aqui (estoque de 100000 por SKU) e contaria como erro.
http.setResponseCallback(http.expectedStatuses(200, 201));

// Degraus do estresse: 10 s de subida + 30 s de patamar cada. O tag `degrau` diz em qual patamar a requisição caiu.
const DEGRAUS = [25, 50, 100, 150, 200, 300];
const SUBIDA_S = 10;
const PATAMAR_S = 30;
const rotuloDegrau = (vus) => `vu${String(vus).padStart(3, '0')}`;

const CENARIOS = {
  smoke: { executor: 'constant-vus', vus: 1, duration: '20s' },
  carga: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '15s', target: 50 },
      { duration: '90s', target: 50 },
      { duration: '5s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },
  estresse: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: DEGRAUS.flatMap((alvo) => [
      { duration: `${SUBIDA_S}s`, target: alvo },
      { duration: `${PATAMAR_S}s`, target: alvo },
    ]),
    gracefulRampDown: '15s',
  },
};
if (!CENARIOS[PERFIL]) throw new Error(`PERFIL inválido: ${PERFIL} (smoke | carga | estresse)`);

const ENDPOINTS = ['buscar_produto', 'finalizar_venda'];
// Tag `tipo` da busca: `modelo` (1 produto) ou `ampla` (todos os modelos do teste, ~864 SKUs). Só diagnóstico.
const TIPOS_BUSCA = ['modelo', 'ampla'];

function limiares() {
  const t = {};
  if (PERFIL === 'estresse') {
    // Limites do estresse: o sistema pode degradar além de 50 VUs, mas não pode cair nem ficar inutilizável.
    t['http_req_failed{endpoint:finalizar_venda}'] = ['rate<0.05'];
    t['http_req_failed{endpoint:buscar_produto}'] = ['rate<0.05'];
    t['http_req_duration{endpoint:finalizar_venda}'] = ['p(99)<3000'];
    t['http_req_duration{endpoint:buscar_produto}'] = ['p(99)<3000'];
    // Sempre verdadeiros: existem só para o k6 materializar a sub-métrica por degrau e entregá-la ao handleSummary.
    for (const vus of DEGRAUS) {
      for (const e of ENDPOINTS) {
        t[`http_req_duration{endpoint:${e},degrau:${rotuloDegrau(vus)}}`] = ['p(95)>=0'];
        t[`http_req_failed{endpoint:${e},degrau:${rotuloDegrau(vus)}}`] = ['rate>=0'];
      }
    }
  } else {
    t['http_req_duration{endpoint:finalizar_venda}'] = [`p(95)<${P95_VENDA}`]; // RNF-01
    t['http_req_failed{endpoint:finalizar_venda}'] = ['rate<0.01']; // RNF-01
    t['http_req_duration{endpoint:buscar_produto}'] = [`p(95)<${P95_BUSCA}`]; // RNF-02
    t['http_req_failed{endpoint:buscar_produto}'] = ['rate<0.01'];
  }
  // Sem nenhuma requisição medida o threshold passaria vazio: exige que as duas rotas tenham sido exercitadas.
  t['http_reqs{endpoint:finalizar_venda}'] = ['count>0'];
  t['http_reqs{endpoint:buscar_produto}'] = ['count>0'];
  // Sempre verdadeiros (informativos, não mudam o RNF-02): materializam o p95 da busca por tipo para o handleSummary.
  for (const tipo of TIPOS_BUSCA) t[`http_req_duration{endpoint:buscar_produto,tipo:${tipo}}`] = ['p(95)>=0'];
  return t;
}

export const options = {
  scenarios: { principal: CENARIOS[PERFIL] },
  thresholds: limiares(),
  setupTimeout: '300s',
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const JSON_H = { 'Content-Type': 'application/json' };
const params = (extra = {}) => ({ headers: { ...JSON_H, Cookie: COOKIE }, ...extra });

const TAMANHOS = ['P', 'M', 'G', 'GG', '36', '38', '40', '42', '44', '46', '48', '50'];
const CORES = ['Preto', 'Branco', 'Nude', 'Vermelho', 'Azul', 'Rosa', 'Verde', 'Cinza', 'Bege', 'Vinho', 'Marinho', 'Lilas'];
// 4 produtos com o máximo de SKUs (12 × 12 = 144) e 8 com 36 (6 × 6): 864 SKUs, estoque de 100000 cada.
const N_PRODUTOS = Number(__ENV.PRODUTOS || 12);
const N_CLIENTES = Number(__ENV.CLIENTES || 200);
const ESTOQUE = 100000;

function chamar(metodo, caminho, corpo, tag) {
  const r = http.request(metodo, `${BASE}${caminho}`, corpo ? JSON.stringify(corpo) : null, params({ tags: { endpoint: tag } }));
  if (r.status < 200 || r.status > 299) fail(`setup: ${metodo} ${caminho} -> ${r.status}`);
  return r.json();
}

// Os dados nascem pela API (RLS e regras valem), nunca por SQL.
export function setup() {
  const categoria = chamar('POST', '/categorias', { nome: `Carga ${RUN_ID}`, atributos: [], tipo: 'produto' }, 'setup');
  const skus = [];
  for (let p = 0; p < N_PRODUTOS; p++) {
    const cheio = p < 4;
    const nT = cheio ? 12 : 6;
    const nC = cheio ? 12 : 6;
    const preco = 4990 + p * 500;
    const lista = [];
    for (const tamanho of TAMANHOS.slice(0, nT)) {
      for (const cor of CORES.slice(0, nC)) lista.push({ tamanho, cor, estoque_inicial: ESTOQUE, estoque_minimo: 0 });
    }
    const nome = `Conjunto Modelo ${String(p + 1).padStart(2, '0')} ${RUN_ID}`;
    const criado = chamar(
      'POST',
      '/produtos',
      { nome, categoria_id: categoria.id, porte: 'slim', atributos: [], fornecedor: null, custo_centavos: 2000, preco_centavos: preco, skus: lista },
      'setup',
    );
    for (const s of criado.skus) skus.push({ id: s.id, preco });
  }
  const celulares = [];
  for (let i = 0; i < N_CLIENTES; i++) {
    const celular = `119${String(40000000 + i)}`;
    chamar('POST', '/clientes', { nome: `Cliente Carga ${i}`, celular, aviso_lgpd: true }, 'setup');
    celulares.push(celular);
  }
  return { skus, celulares, modelos: N_PRODUTOS };
}

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];

function etiquetas(endpoint) {
  const t = { endpoint };
  if (PERFIL === 'estresse') {
    const s = exec.instance.currentTestRunDuration / 1000;
    const i = Math.min(DEGRAUS.length - 1, Math.floor(s / (SUBIDA_S + PATAMAR_S)));
    t.degrau = rotuloDegrau(DEGRAUS[i]);
  }
  return t;
}

export default function (dados) {
  // RNF-02: 80% das buscas por um modelo (1 produto), 20% pelo termo amplo (todos os modelos do teste).
  const tipo = Math.random() < 0.8 ? 'modelo' : 'ampla';
  const termo =
    tipo === 'modelo'
      ? `Modelo ${String(1 + Math.floor(Math.random() * dados.modelos)).padStart(2, '0')} ${RUN_ID}`
      : `Conjunto Modelo`;
  const busca = http.get(
    `${BASE}/produtos?q=${encodeURIComponent(termo)}`,
    params({ tags: { ...etiquetas('buscar_produto'), tipo } }),
  );
  check(busca, { 'busca 200': (r) => r.status === 200 });

  // RNF-01: 1 ou 2 itens, SKUs sorteados entre centenas (vender o mesmo SKU serializaria na trava de linha).
  const itens = [];
  const usados = new Set();
  const nItens = Math.random() < 0.7 ? 1 : 2;
  let total = 0;
  while (itens.length < nItens) {
    const sku = sorteio(dados.skus);
    if (usados.has(sku.id)) continue;
    usados.add(sku.id);
    const quantidade = 1 + Math.floor(Math.random() * 2);
    itens.push({ sku_id: sku.id, quantidade });
    total += quantidade * sku.preco;
  }
  const venda = http.post(
    `${BASE}/vendas`,
    JSON.stringify({
      itens,
      cliente: { celular: sorteio(dados.celulares) },
      desconto: { tipo: 'nenhum' },
      pagamentos: [{ forma: 'pix', valor_centavos: total }],
    }),
    params({ tags: etiquetas('finalizar_venda') }),
  );
  check(venda, { 'venda 201': (r) => r.status === 201 });
  sleep(0.3 + Math.random() * 0.4); // tempo de "pensar" de quem opera o balcão
}

const valores = (m) => (m ? m.values ?? m : null);
const f = (n) => (typeof n === 'number' ? n.toFixed(1) : '-');

export function handleSummary(data) {
  const m = data.metrics;
  const linhas = [`PERFIL=${PERFIL} (RNF-01: p95 <= ${P95_VENDA} ms, erro < 1%; RNF-02: p95 <= ${P95_BUSCA} ms)`, ''];
  for (const e of ENDPOINTS) {
    const d = valores(m[`http_req_duration{endpoint:${e}}`]);
    const x = valores(m[`http_req_failed{endpoint:${e}}`]);
    const n = valores(m[`http_reqs{endpoint:${e}}`]);
    if (!d) continue;
    linhas.push(
      `${e.padEnd(16)} n=${n ? n.count : '-'}  avg=${f(d.avg)}  med=${f(d.med)}  p95=${f(d['p(95)'])}  p99=${f(d['p(99)'])}  max=${f(d.max)} ms  erro=${x ? (x.rate * 100).toFixed(2) : '-'}%`,
    );
  }
  linhas.push('', 'Busca por tipo (informativo; o RNF-02 vale para o conjunto acima):');
  for (const tipo of TIPOS_BUSCA) {
    const d = valores(m[`http_req_duration{endpoint:buscar_produto,tipo:${tipo}}`]);
    if (!d) continue;
    linhas.push(
      `  ${tipo.padEnd(8)} med=${f(d.med)}  p95=${f(d['p(95)'])}  p99=${f(d['p(99)'])}  max=${f(d.max)} ms`,
    );
  }
  const reprovados = [];
  for (const [nome, met] of Object.entries(m)) {
    for (const [expr, r] of Object.entries(met.thresholds || {})) {
      if (r.ok === false || r === false) reprovados.push(`${nome} ${expr}`);
    }
  }
  linhas.push('', reprovados.length ? `THRESHOLDS QUE REPROVARAM:\n  ${reprovados.join('\n  ')}` : 'Todos os thresholds passaram.');

  if (PERFIL === 'estresse') {
    linhas.push('', 'Por degrau de VUs (RNF vale só até 50 VUs; "x" = passou do limite):');
    linhas.push('degrau  busca p95   venda p95   erro busca  erro venda');
    for (const vus of DEGRAUS) {
      const r = rotuloDegrau(vus);
      const bd = valores(m[`http_req_duration{endpoint:buscar_produto,degrau:${r}}`]);
      const vd = valores(m[`http_req_duration{endpoint:finalizar_venda,degrau:${r}}`]);
      const be = valores(m[`http_req_failed{endpoint:buscar_produto,degrau:${r}}`]);
      const ve = valores(m[`http_req_failed{endpoint:finalizar_venda,degrau:${r}}`]);
      if (!bd || !vd) continue;
      const mk = (v, lim) => `${f(v)}${v > lim ? ' x' : '  '}`;
      linhas.push(
        `${String(vus).padStart(5)}  ${mk(bd['p(95)'], P95_BUSCA).padStart(10)}  ${mk(vd['p(95)'], P95_VENDA).padStart(10)}  ${((be ? be.rate : 0) * 100).toFixed(2).padStart(9)}%  ${((ve ? ve.rate : 0) * 100).toFixed(2).padStart(9)}%`,
      );
    }
  }
  const texto = linhas.join('\n') + '\n';
  return { stdout: texto, [`/resultados/${PERFIL}.txt`]: texto, [`/resultados/${PERFIL}.json`]: JSON.stringify(data) };
}
