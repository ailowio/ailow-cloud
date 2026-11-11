import { randomUUID } from 'node:crypto';
import { healthResponseSchema } from '@ailow/shared';
import fastifySwagger from '@fastify/swagger';
import fastify, { type FastifyInstance, type FastifyServerOptions, LogController } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type pg from 'pg';

export interface AppDeps {
  pool: pg.Pool;
  logger?: FastifyServerOptions['logger'];
}

// Só aceita ids curtos e "inofensivos" vindos do cliente; qualquer outra coisa vira UUID novo
// (evita log injection: o Fastify não valida o cabeçalho por conta própria).
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{1,64}$/;

class LogComRequestId extends LogController {
  constructor() {
    super({ requestIdLogLabel: 'request_id' });
  }
}

export async function buildApp({ pool, logger = false }: AppDeps): Promise<FastifyInstance> {
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
      info: { title: 'Ailow Cloud API', version: '0.1.0' },
    },
    transform: jsonSchemaTransform,
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

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return app;
}
