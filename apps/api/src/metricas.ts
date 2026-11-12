import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

// Métricas RED (taxa, erros, duração) por rota TEMPLATE — S13b, RNF-03, OBS-*. Regras:
//  - a etiqueta `route` é o padrão da rota ("/clientes/:id"), NUNCA a URL: URL tem uuid, busca e celular
//    (cardinalidade ilimitada e dado pessoal). URL que não casa com rota nenhuma vira "desconhecida";
//  - só método + rota + classe de status (2xx…5xx) viram etiqueta; nenhum dado de empresa, usuário ou corpo;
//  - o próprio /metrics não é contado e fica fora do OpenAPI;
//  - sem METRICS_TOKEN a rota nem é registrada (404): ligar o acesso é decisão explícita (AUD, interface nova).
// O registro é POR INSTÂNCIA do app (não o global): os testes sobem várias instâncias sem colidir.
export const ROTA_DESCONHECIDA = 'desconhecida';
const ROTA_METRICAS = '/metrics';
const BUCKETS_SEGUNDOS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2.5, 5, 10];

function classeDeStatus(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

// Compara resumos (tamanho fixo) em tempo constante: não revela o token nem pelo tempo de resposta.
function tokenConfere(recebido: string | undefined, esperado: string): boolean {
  const resumo = (v: string) => createHash('sha256').update(v).digest();
  const bearer = /^Bearer (.+)$/.exec(recebido ?? '')?.[1] ?? '';
  return timingSafeEqual(resumo(bearer), resumo(esperado));
}

export function registrarMetricas(app: FastifyInstance, { token }: { token?: string }): void {
  const registro = new Registry();
  collectDefaultMetrics({ register: registro });
  const labelNames = ['method', 'route', 'status_class'] as const;
  const total = new Counter({
    name: 'http_requests_total',
    help: 'Requisições HTTP atendidas, por método, rota (template) e classe de status',
    labelNames,
    registers: [registro],
  });
  const duracao = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos, por método, rota (template) e classe de status',
    labelNames,
    buckets: BUCKETS_SEGUNDOS,
    registers: [registro],
  });

  app.addHook('onResponse', async (request, reply) => {
    // URL sem rota (404 do Fastify) não tem template: vira a etiqueta fixa.
    const rota = request.routeOptions.url ?? ROTA_DESCONHECIDA;
    if (rota === ROTA_METRICAS) return;
    const etiquetas = { method: request.method, route: rota, status_class: classeDeStatus(reply.statusCode) };
    total.inc(etiquetas);
    duracao.observe(etiquetas, reply.elapsedTime / 1000);
  });

  if (!token) return;
  app.get(ROTA_METRICAS, { schema: { hide: true } }, async (request, reply) => {
    if (!tokenConfere(request.headers.authorization, token)) {
      return reply.code(401).header('www-authenticate', 'Bearer').send({ erro: 'nao_autenticado' });
    }
    return reply.type(registro.contentType).send(await registro.metrics());
  });
}
