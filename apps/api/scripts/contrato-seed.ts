import { randomUUID } from 'node:crypto';
import { criarHasher } from '../src/acesso/senhas.js';
import { semearCategoriasFinanceiras } from '../src/configuracoes/categorias.js';
import { createPool, withEmpresa } from '../src/db.js';

// Parte de `scripts/contrato.sh` (teste de contrato com Schemathesis, S13a): cria UMA empresa descartável com um Dono
// no banco efêmero do teste. A senha vem de CONTRATO_SENHA (gerada a cada execução); nada fica no repositório.
const { DATABASE_URL, AUTH_PEPPER, CONTRATO_SENHA } = process.env;
if (!DATABASE_URL || !AUTH_PEPPER || !CONTRATO_SENHA) {
  throw new Error('defina DATABASE_URL, AUTH_PEPPER e CONTRATO_SENHA');
}
// Trava: este seed só roda contra um banco na própria máquina.
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) {
  throw new Error('o seed do contrato só roda contra um banco local (127.0.0.1 ou localhost)');
}

const EMAIL = 'dono@contrato.test';
const pool = createPool(DATABASE_URL, 2);
try {
  const senhaHash = await criarHasher(AUTH_PEPPER).hash(CONTRATO_SENHA);
  const empresaId = randomUUID();
  const donoId = randomUUID();
  await withEmpresa(pool, empresaId, async (c) => {
    await c.query('INSERT INTO empresas (id, nome) VALUES ($1, $2)', [empresaId, 'Empresa do Contrato']);
    await c.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash)
       VALUES ($1, $2, 'Dono do Contrato', 'dono', $3, $4)`,
      [donoId, empresaId, EMAIL, senhaHash],
    );
    await c.query('SELECT registrar_login($1, $2, $3)', [EMAIL, empresaId, donoId]);
    await semearCategoriasFinanceiras(c, empresaId, new Date());
  });
  console.log(`empresa do contrato criada (${EMAIL})`);
} finally {
  await pool.end();
}
