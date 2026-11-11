#!/usr/bin/env node
/**
 * Para o ambiente de desenvolvimento local (L-0012):
 * Postgres embutido (.dev-data/pg), API (:3000) e Vite (:5173).
 * Confere as portas 54329, 3000 e 5173 ao final.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pgData = join(raiz, '.dev-data', 'pg');
const portas = [54329, 3000, 5173];
const win = process.platform === 'win32';

function log(msg) {
  console.log(`[dev:parar] ${msg}`);
}

function pgCtlStop() {
  if (!existsSync(pgData)) {
    log('sem .dev-data/pg — nada a parar no Postgres embutido');
    return;
  }
  const bin = win
    ? join(raiz, 'node_modules', 'embedded-postgres', 'native', 'pgsql', 'bin', 'pg_ctl.exe')
    : join(raiz, 'node_modules', 'embedded-postgres', 'native', 'pgsql', 'bin', 'pg_ctl');
  const candidatos = [bin, 'pg_ctl'];
  for (const cmd of candidatos) {
    try {
      if (cmd !== 'pg_ctl' && !existsSync(cmd)) continue;
      execFileSync(cmd, ['stop', '-D', pgData, '-m', 'fast'], { stdio: 'inherit' });
      log(`Postgres parado (${cmd})`);
      return;
    } catch {
      /* tenta o próximo */
    }
  }
  log('aviso: não conseguiu pg_ctl stop — tentando liberar a porta 54329 mesmo assim');
}

function pidsNaPorta(porta) {
  if (win) {
    const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' });
    if (out.status !== 0) return [];
    const pids = new Set();
    for (const linha of out.stdout.split(/\r?\n/)) {
      if (!linha.includes(`:${porta}`) || !linha.includes('LISTENING')) continue;
      const m = linha.trim().match(/(\d+)\s*$/);
      if (m) pids.add(m[1]);
    }
    return [...pids];
  }
  const out = spawnSync('sh', ['-c', `lsof -tiTCP:${porta} -sTCP:LISTEN 2>/dev/null || true`], {
    encoding: 'utf8',
  });
  return out.stdout
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matar(pid) {
  if (win) {
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  } else {
    spawnSync('kill', ['-TERM', pid], { stdio: 'ignore' });
  }
}

function liberarPortas() {
  for (const porta of portas) {
    const pids = pidsNaPorta(porta);
    if (pids.length === 0) {
      log(`porta ${porta}: livre`);
      continue;
    }
    for (const pid of pids) {
      log(`porta ${porta}: encerrando PID ${pid}`);
      matar(pid);
    }
  }
}

function conferir() {
  let ok = true;
  for (const porta of portas) {
    const pids = pidsNaPorta(porta);
    if (pids.length) {
      ok = false;
      log(`FALHA: porta ${porta} ainda com PID(s) ${pids.join(', ')}`);
    } else {
      log(`ok: porta ${porta} livre`);
    }
  }
  if (!ok) process.exitCode = 1;
}

pgCtlStop();
liberarPortas();
// Segunda passagem: filhos órfãos (L-0012)
liberarPortas();
conferir();
