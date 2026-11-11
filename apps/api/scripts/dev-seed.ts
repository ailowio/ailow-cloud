import { randomUUID } from 'node:crypto';
import { criarHasher } from '../src/acesso/senhas.js';
import { createPool, withEmpresa } from '../src/db.js';
import { lerAmbienteDev, recusarEmProducao, urlBanco } from './dev-ambiente.js';

// `npm run dev:seed`: cria UMA empresa de exemplo no banco de desenvolvimento, para poder entrar no app.
// Credenciais públicas de propósito (valem só no banco local de dev; nunca rode isto contra outro banco).
const DONO_EMAIL = 'dono@loja.dev';
const DONO_SENHA = 'senha-de-desenvolvimento';
const VENDEDOR_NOME = 'Ana Vendedora';
const VENDEDOR_PIN = '1357';

recusarEmProducao();
const ambiente = lerAmbienteDev();
const pool = createPool(urlBanco(ambiente), 2);
const hasher = criarHasher(ambiente.pepper);

try {
  const existente = await pool.query('SELECT 1 FROM buscar_login($1)', [DONO_EMAIL]);
  if (existente.rowCount) {
    console.log(`A empresa de exemplo já existe (${DONO_EMAIL}). Nada a fazer.`);
  } else {
    const empresaId = randomUUID();
    const donoId = randomUUID();
    const [senhaHash, pinHash] = await Promise.all([hasher.hash(DONO_SENHA), hasher.hash(VENDEDOR_PIN)]);
    // Mesma sequência da rota de criação de empresa (RF-ACE-01), na transação da própria empresa.
    await withEmpresa(pool, empresaId, async (c) => {
      await c.query('INSERT INTO empresas (id, nome) VALUES ($1, $2)', [empresaId, 'Loja de Exemplo']);
      await c.query(
        `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash)
         VALUES ($1, $2, 'Dono de Exemplo', 'dono', $3, $4)`,
        [donoId, empresaId, DONO_EMAIL, senhaHash],
      );
      await c.query('SELECT registrar_login($1, $2, $3)', [DONO_EMAIL, empresaId, donoId]);
      await c.query(
        `INSERT INTO usuarios (empresa_id, nome, perfil, pin_hash) VALUES ($1, $2, 'vendedor', $3)`,
        [empresaId, VENDEDOR_NOME, pinHash],
      );
    });
    console.log('Empresa de exemplo criada.');
    console.log(`  Dono:     ${DONO_EMAIL} / ${DONO_SENHA}  (ainda sem PIN: o app pede para definir)`);
    console.log(`  Vendedor: ${VENDEDOR_NOME} / PIN ${VENDEDOR_PIN}`);
  }
} finally {
  await pool.end();
}
