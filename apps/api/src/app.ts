import { randomUUID } from 'node:crypto';
import { healthResponseSchema } from '@ailow/shared';
import fastifyCookie from '@fastify/cookie';
import fastifySwagger from '@fastify/swagger';
import fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions, LogController } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';
import { criarGuardas } from './acesso/guardas.js';
import { registrarRotasAcesso } from './acesso/rotas.js';
import { criarHasher } from './acesso/senhas.js';
import { registrarRotasAdmin } from './admin/rotas.js';
import { registrarRotasConfiguracoes } from './configuracoes/rotas.js';

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
        ? { ...logger, redact: ['req.headers.authorization', 'req.headers.cookie'] }
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
      info: { title: 'Ailow Cloud API', version: '0.3.0' },
      tags: [
        { name: 'acesso', description: 'Entrar, aparelho vinculado, PIN e sessão' },
        { name: 'usuarios', description: 'Gestão de usuários da empresa (somente Dono)' },
        { name: 'admin', description: 'Administração da plataforma (Admin com TOTP)' },
        { name: 'configuracoes', description: 'Dados da empresa, markup e categorias (somente Dono)' },
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
    transform: jsonSchemaTransform,
  });

  await app.register(fastifyCookie);
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
      request.log.error({ err: error }, 'erro inesperado');
      return reply.code(500).send({ erro: 'erro_interno' });
    }
    return reply.code(status).send({ erro: error.code ?? 'requisicao_invalida' });
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  const rotas = app.withTypeProvider<ZodTypeProvider>();

  rotas.get(
    '/health',
    {
      schema: {
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

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
