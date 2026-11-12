import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import pg from 'pg';
import { buildApp } from '../src/app.js';
import { criarAdmin } from '../src/admin/criar-admin.js';
import { criarHasher } from '../src/acesso/senhas.js';

export const TEST_PEPPER = 'pepper-de-teste-com-pelo-menos-32-caracteres';

// Conexão do DONO do schema (migrador). Só os testes a usam, para semear dados.
export function adminPool(): pg.Pool {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST ausente: o globalSetup não rodou');
  return new pg.Pool({ connectionString: url, max: 4 });
}

export async function criarEmpresa(admin: pg.Pool, nome: string): Promise<string> {
  const id = randomUUID();
  await admin.query('INSERT INTO empresas (id, nome) VALUES ($1, $2)', [id, nome]);
  return id;
}

// Relógio controlável: os testes de expiração avançam o tempo sem dormir.
export class Relogio {
  constructor(public agora = new Date('2026-11-11T12:00:00.000Z')) {}
  readonly fn = () => this.agora;
  // CUIDADO (L-0016): o relógio vale para o arquivo inteiro e a sessão expira por inatividade. Para só diferenciar
  // datas use `avancarSegundos`; minutos são para testar expiração, e derrubam os testes seguintes com 401.
  avancarMinutos(min: number) {
    this.agora = new Date(this.agora.getTime() + min * 60_000);
  }
  avancarSegundos(s: number) {
    this.agora = new Date(this.agora.getTime() + s * 1000);
  }
}

export async function appDeTeste(
  pool: pg.Pool,
  relogio: Relogio,
  extra: { logger?: Parameters<typeof buildApp>[0]['logger'] } = {},
): Promise<FastifyInstance> {
  const app = await buildApp({
    pool,
    authPepper: TEST_PEPPER,
    cookieSecure: true,
    agora: relogio.fn,
    ...extra,
  });
  await app.ready();
  return app;
}

// Cliente HTTP com "cookie jar": guarda os Set-Cookie e os reenvia, como um navegador.
export class Cliente {
  readonly jar = new Map<string, string>();
  readonly ultimosCookies: LightMyRequestResponse['cookies'] = [];

  constructor(private readonly app: FastifyInstance) {}

  async req(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await this.app.inject({
      method,
      url,
      payload: payload as object | Buffer | undefined,
      headers: { ...(cookie ? { cookie } : {}), ...headers },
    });
    for (const c of res.cookies) {
      if (c.value === '') this.jar.delete(c.name);
      else this.jar.set(c.name, c.value);
    }
    this.ultimosCookies.splice(0, this.ultimosCookies.length, ...res.cookies);
    return res;
  }
  get = (url: string) => this.req('GET', url);
  post = (url: string, payload?: unknown) => this.req('POST', url, payload ?? {});
  put = (url: string, payload?: unknown) => this.req('PUT', url, payload ?? {});
  delete = (url: string) => this.req('DELETE', url);

  /** Multipart PUT (campo `file`) — usado no upload da logo. */
  putArquivo(url: string, bytes: Buffer, filename: string, contentType: string) {
    const boundary = '----ailowTestBoundary7MA4YWxk';
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    return this.req('PUT', url, Buffer.concat([head, bytes, tail]), {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    });
  }
  // Outro "navegador" no mesmo aparelho: só leva o cookie do aparelho vinculado.
  somenteAparelho(): Cliente {
    const novo = new Cliente(this.app);
    const ap = this.jar.get('aparelho');
    if (ap) novo.jar.set('aparelho', ap);
    return novo;
  }
}

export function codigoTotp(segredo: string, quando: Date): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(segredo), period: 30, digits: 6 }).generate({
    timestamp: quando.getTime(),
  });
}

export interface AdminDeTeste {
  email: string;
  senha: string;
  segredo: string;
}

export async function semearAdmin(pool: pg.Pool): Promise<AdminDeTeste> {
  const email = `admin-${randomUUID()}@ailow.test`;
  const senha = `senha-admin-${randomUUID()}`;
  const { segredo } = await criarAdmin(pool, criarHasher(TEST_PEPPER), { email, senha });
  return { email, senha, segredo };
}

// Cada login do Admin usa um passo TOTP novo (o código não vale duas vezes): avança 31 s antes.
export async function loginAdmin(app: FastifyInstance, relogio: Relogio, adm: AdminDeTeste): Promise<Cliente> {
  relogio.avancarSegundos(31);
  const c = new Cliente(app);
  const res = await c.post('/admin/login', {
    email: adm.email,
    senha: adm.senha,
    codigo: codigoTotp(adm.segredo, relogio.agora),
  });
  if (res.statusCode !== 200) throw new Error(`login do admin falhou: ${res.statusCode} ${res.body}`);
  return c;
}

export interface EmpresaDeTeste {
  empresaId: string;
  donoId: string;
  email: string;
  senha: string;
}

export async function criarEmpresaPelaApi(adminCli: Cliente, nome: string): Promise<EmpresaDeTeste> {
  const email = `dono-${randomUUID()}@loja.test`;
  const senha = `senha-dono-${randomUUID()}`;
  const res = await adminCli.post('/admin/empresas', { nome, dono: { nome: `Dono ${nome}`, email, senha } });
  if (res.statusCode !== 201) throw new Error(`criar empresa falhou: ${res.statusCode} ${res.body}`);
  const corpo = res.json() as { empresa_id: string; dono_id: string };
  return { empresaId: corpo.empresa_id, donoId: corpo.dono_id, email, senha };
}

// Outro aparelho da mesma empresa: o Dono entra por e-mail + senha num navegador novo.
// (Um aparelho tem uma sessão por vez: quem usa PIN nele encerra a sessão anterior.)
export async function novoAparelho(app: FastifyInstance, empresa: EmpresaDeTeste): Promise<Cliente> {
  const c = new Cliente(app);
  const r = await c.post('/acesso/entrar', { email: empresa.email, senha: empresa.senha });
  if (r.statusCode !== 200) throw new Error(`novo aparelho falhou: ${r.statusCode}`);
  return c;
}

export const PIN_DONO = '4321';
export const PIN_VENDEDOR = '1357';

// Dono com PIN definido + um Vendedor, tudo pela API. Devolve clientes já "logados".
export async function prepararEmpresa(
  app: FastifyInstance,
  adminCli: Cliente,
  nome: string,
): Promise<{ empresa: EmpresaDeTeste; dono: Cliente; vendedorId: string }> {
  const empresa = await criarEmpresaPelaApi(adminCli, nome);
  const dono = new Cliente(app);
  const r1 = await dono.post('/acesso/entrar', { email: empresa.email, senha: empresa.senha });
  if (r1.statusCode !== 200) throw new Error(`entrar falhou: ${r1.statusCode} ${r1.body}`);
  const r2 = await dono.put('/acesso/meu-pin', { senha: empresa.senha, pin: PIN_DONO });
  if (r2.statusCode !== 204) throw new Error(`definir PIN falhou: ${r2.statusCode} ${r2.body}`);
  const r3 = await dono.post('/usuarios', { nome: `Vendedor ${nome}`, pin: PIN_VENDEDOR });
  if (r3.statusCode !== 201) throw new Error(`criar vendedor falhou: ${r3.statusCode} ${r3.body}`);
  return { empresa, dono, vendedorId: (r3.json() as { id: string }).id };
}
