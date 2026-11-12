import { randomUUID } from 'node:crypto';
import { healthResponseSchema } from '@ailow/shared';
import { LOGO_MAX_BYTES } from '@ailow/shared';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
  LogController,
} from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { criarGuardas } from './acesso/guardas.js';
import { registrarRotasAcesso } from './acesso/rotas.js';
import { criarHasher } from './acesso/senhas.js';
import { registrarRotasAdmin } from './admin/rotas.js';
import { registrarRotasClientes } from './clientes/rotas.js';
import { registrarRotasCompras } from './compras/rotas.js';
import { transformarContrato } from './contrato.js';
import { contemNul } from './entrada-segura.js';
import { registrarRotasPessoas } from './pessoas/rotas.js';
import { registrarRotasConfiguracoes } from './configuracoes/rotas.js';
import { registrarRotasFinanceiro } from './financeiro/rotas.js';
import { registrarRotasProdutos } from './produtos/rotas.js';
import { registrarRotasVendas } from './vendas/rotas.js';

export interface AppDeps {
  pool: pg.Pool;
  logger?: FastifyServerOptions['logger'];
  // Segredo do servidor misturado aos hashes de senha/PIN (config AUTH_PEPPER).
  authPepper: string;
  // Cookies Secure (HTTPS). Só desligue em desenvolvimento local sem HTTPS.
  cookieSecure?: boolean;
  // Relógio injetável: os testes avançam o tempo sem dormir.
  agora?: () => Date;
}

// Só aceita ids curtos e "inofensivos" vindos do cliente; qualquer outra coisa vira UUID novo
// (evita log injection: o Fastify não valida o cabeçalho por conta própria).
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{1,64}$/;

// Igual ao serializador padrão do Fastify (menos `version`, que o app não usa), mas sem a query string: a busca de
// clientes (S09) leva nome ou celular na URL, e dado pessoal não vai para o log.
function serializarReq(req: FastifyRequest) {
  return {
    method: req.method,
    url: req.url.split('?')[0],
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
  };
}

// O Postgres põe os valores da linha em `detail` ("Failing row contains (...)", "Key (celular)=(...)") e `where`.
// Num 500 isso iria para o log com nome e celular de cliente (S09b, SEC-04): o erro é registrado sem esses dois campos
// e o resto (mensagem, código, restrição, pilha) segue disponível para diagnóstico.
function semValoresDaLinha(error: Error): Error {
  const copia = new Error(error.message);
  copia.name = error.name;
  copia.stack = error.stack;
  for (const [campo, valor] of Object.entries(error)) {
    if (campo !== 'detail' && campo !== 'where') (copia as unknown as Record<string, unknown>)[campo] = valor;
  }
  return copia;
}

class LogComRequestId extends LogController {
  constructor() {
    super({ requestIdLogLabel: 'request_id' });
  }
}

export async function buildApp({
  pool,
  logger = false,
  authPepper,
  cookieSecure = true,
  agora = () => new Date(),
}: AppDeps): Promise<FastifyInstance> {
  const app = fastify({
    logger:
      logger && typeof logger === 'object'
        ? { ...logger, redact: ['req.headers.authorization', 'req.headers.cookie'], serializers: { req: serializarReq } }
        : logger,
    logController: new LogComRequestId(),
    genReqId: (req) => {
      const enviado = req.headers['x-request-id'];
      return typeof enviado === 'string' && REQUEST_ID_VALIDO.test(enviado) ? enviado : randomUUID();
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Ailow Cloud API',
        version: '0.13.0',
        description:
          'API do Ailow Cloud (ERP mobile multi-tenant): acesso por PIN, financeiro, produtos, clientes, vendas, compras e ponto. Autenticação por cookie de sessão (ADR 004); cada empresa só enxerga os próprios dados (ADR 002).',
        contact: { name: 'Ailow Cloud', url: 'https://github.com/ailowio/ailow-cloud' },
      },
      // Mesma origem do app web (o proxy HTTPS da produção e o do Vite repassam a API).
      servers: [{ url: '/', description: 'Mesma origem do app' }],
      tags: [
        { name: 'saude', description: 'Saúde da API e do banco (sem sessão)' },
        { name: 'acesso', description: 'Entrar, aparelho vinculado, PIN e sessão' },
        { name: 'usuarios', description: 'Gestão de usuários da empresa (somente Dono)' },
        { name: 'admin', description: 'Administração da plataforma (Admin com TOTP)' },
        { name: 'configuracoes', description: 'Dados da empresa, markup, logo e categorias (somente Dono; GET logo com sessão)' },
        { name: 'financeiro', description: 'Despesas, contas a pagar, estorno e relatórios (somente Dono)' },
        { name: 'produtos', description: 'Produtos, SKUs, busca e estoque (o Vendedor só consulta, sem custo)' },
        { name: 'clientes', description: 'Clientes: cadastro, edição, busca, ficha e aviso LGPD (Dono e Vendedor); inativar, reativar e excluir (só o Dono)' },
        { name: 'vendas', description: 'Vendas: finalizar, comprovante, cancelar e relatório (Dono e Vendedor; o mês é só do Dono)' },
        { name: 'compras', description: 'Fornecedores e pedidos de compra (somente Dono); receber é atômico com estoque e parcelas' },
        { name: 'pessoas', description: 'Ponto: bater entrada/saída (Dono e Vendedor) e espelho do mês (o Vendedor só o próprio)' },
      ],
      // Autenticação por cookie de sessão no servidor (ADR 004); nenhum token é exposto ao JavaScript.
      components: {
        securitySchemes: {
          sessao: { type: 'apiKey', in: 'cookie', name: 'sessao' },
          aparelho: { type: 'apiKey', in: 'cookie', name: 'aparelho' },
          admin_sessao: { type: 'apiKey', in: 'cookie', name: 'admin_sessao' },
        },
      },
    },
    transform: transformarContrato,
  });

  await app.register(fastifyCookie);
  // Upload da logo (RF-CFG-02): um arquivo, até LOGO_MAX_BYTES; throwFileSizeLimit gera erro no toBuffer.
  await app.register(fastifyMultipart, {
    limits: { files: 1, fileSize: LOGO_MAX_BYTES },
  });
  app.decorateRequest('sessao', null);
  app.decorateRequest('aparelho', null);
  app.decorateRequest('admin', null);

  // Erros: validação vira 400 sem ecoar o valor enviado; falha inesperada vira 500 genérico
  // (a causa vai para o log com request_id, nunca para a resposta).
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const mensagem = error.validation
        .map((i) => `${i.instancePath.replace(/^\//, '') || 'corpo'}: ${i.message}`)
        .join('; ');
      return reply.code(400).send({ erro: 'requisicao_invalida', mensagem });
    }
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: semValoresDaLinha(error) }, 'erro inesperado');
      return reply.code(500).send({ erro: 'erro_interno' });
    }
    return reply.code(status).send({ erro: error.code ?? 'requisicao_invalida' });
  });

  app.addHook('preValidation', async (request, reply) => {
    if (contemNul(request.query) || contemNul(request.params) || contemNul(request.body)) {
      return reply.code(400).send({ erro: 'requisicao_invalida', mensagem: 'texto com caractere nulo (U+0000) não é aceito' });
    }
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  const rotas = app.withTypeProvider<ZodTypeProvider>();

  rotas.get(
    '/health',
    {
      schema: {
        tags: ['saude'],
        summary: 'Saúde da API e do banco',
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (request, reply) => {
      try {
        await pool.query('SELECT 1');
        return { status: 'ok' as const, db: 'ok' as const };
      } catch (err) {
        request.log.error({ err }, 'banco indisponível no health check');
        return reply.code(503).send({ status: 'degraded' as const, db: 'down' as const });
      }
    },
  );

  const deps = { pool, hasher: criarHasher(authPepper), agora, cookieSecure };
  const guardas = criarGuardas(deps);
  await registrarRotasAcesso(app, deps, guardas);
  await registrarRotasAdmin(app, deps, guardas);
  await registrarRotasConfiguracoes(app, deps, guardas);
  await registrarRotasFinanceiro(app, deps, guardas);
  await registrarRotasProdutos(app, deps, guardas);
  await registrarRotasClientes(app, deps, guardas);
  await registrarRotasVendas(app, deps, guardas);
  await registrarRotasCompras(app, deps, guardas);
  await registrarRotasPessoas(app, deps, guardas);

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
