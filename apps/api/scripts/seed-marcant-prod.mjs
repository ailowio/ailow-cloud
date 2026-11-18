/**
 * Orquestra seed Marcant em produção (ou DEMO_BASE):
 * 1) Admin + TOTP cria empresa+Dono se ainda não existir (ou lista)
 * 2) Login Dono + seed categorias/eixos + produtos estimados (--com-produtos)
 *
 * Env (nunca imprimidos):
 *   ADMIN_EMAIL, ADMIN_SENHA, ADMIN_TOTP (6 dígitos, fresco)
 *   DEMO_EMAIL, DEMO_SENHA — se a loja já existe (pula criação)
 *   DEMO_BASE (default https://cloud.ailow.com.br)
 *   DONO_EMAIL (default gerado) — só na criação
 *
 * Uso:
 *   node apps/api/scripts/seed-marcant-prod.mjs [--dry-run] [--com-produtos] [--criar-loja]
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = (process.env.DEMO_BASE || 'https://cloud.ailow.com.br').replace(/\/$/, '');
const dryRun = process.argv.includes('--dry-run');
const comProdutos = process.argv.includes('--com-produtos');
const criarLoja = process.argv.includes('--criar-loja');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

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

async function api(method, pathName, body) {
  const res = await fetch(`${BASE}${pathName}`, {
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

function segredo(n = 16) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => a[b % a.length]).join('');
}

async function garantirDono() {
  const email = (process.env.DEMO_EMAIL || '').trim().toLowerCase();
  const senha = process.env.DEMO_SENHA || '';
  if (email && senha.length >= 10) {
    const login = await api('POST', '/acesso/entrar', { email, senha });
    if (login.status === 200) {
      await api('POST', '/acesso/sair');
      return { email, senha, criado: false };
    }
    console.error('DEMO_EMAIL/SENHA não entraram (HTTP', login.status, ').');
  }

  if (!criarLoja) {
    console.error('Loja Marcant: defina DEMO_EMAIL+DEMO_SENHA do Dono, ou passe --criar-loja com ADMIN_EMAIL+ADMIN_SENHA+ADMIN_TOTP.');
    process.exit(1);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminSenha = process.env.ADMIN_SENHA || '';
  const totp = (process.env.ADMIN_TOTP || '').trim();
  if (!adminEmail || adminSenha.length < 10 || !/^\d{6}$/.test(totp)) {
    console.error('Para --criar-loja: ADMIN_EMAIL, ADMIN_SENHA e ADMIN_TOTP (6 dígitos frescos).');
    process.exit(1);
  }

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, acao: 'criar-loja', base: BASE }, null, 2));
    return { email: 'dry-run@example.com', senha: 'dry-run-senha-ok', criado: true };
  }

  jar.clear();
  const login = await api('POST', '/admin/login', { email: adminEmail, senha: adminSenha, codigo: totp });
  if (login.status !== 200) {
    console.error('Admin login falhou', login.status, login.json);
    process.exit(1);
  }

  const donoEmail = (process.env.DONO_EMAIL || `marcos+${Date.now()}@ailow.local`).trim().toLowerCase();
  const donoSenha = segredo(16);
  const criou = await api('POST', '/admin/empresas', {
    nome: 'Marcant',
    dono: { nome: 'Marcos', email: donoEmail, senha: donoSenha },
  });
  await api('POST', '/admin/sair');
  if (criou.status === 409) {
    console.error('E-mail do Dono já existe. Use DEMO_EMAIL/SENHA dessa loja.');
    process.exit(1);
  }
  if (criou.status !== 201) {
    console.error('Criar empresa falhou', criou.status, criou.json);
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, empresa_id: criou.json.empresa_id, dono_email: donoEmail }, null, 2));
  console.log('Guarde a senha do Dono fora do Git (impressa uma vez abaixo).');
  console.log('DONO_SENHA=' + donoSenha);
  return { email: donoEmail, senha: donoSenha, criado: true, empresaId: criou.json.empresa_id };
}

function rodarSeed(email, senha) {
  return new Promise((resolve, reject) => {
    const args = [path.join(root, 'apps/api/scripts/seed-marcant-via-api.mjs')];
    if (dryRun) args.push('--dry-run');
    if (comProdutos) args.push('--com-produtos');
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, DEMO_BASE: BASE, DEMO_EMAIL: email, DEMO_SENHA: senha },
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exit ${code}`))));
  });
}

async function main() {
  console.log(JSON.stringify({ base: BASE, dryRun, comProdutos, criarLoja }, null, 2));
  if (dryRun && !process.env.DEMO_EMAIL && !criarLoja) {
    console.log('dry-run: plano = criar/usar Dono + seed categorias' + (comProdutos ? ' + 6 produtos estimados' : ''));
    return;
  }
  const dono = await garantirDono();
  if (dryRun && dono.criado) return;
  await rodarSeed(dono.email, dono.senha);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
