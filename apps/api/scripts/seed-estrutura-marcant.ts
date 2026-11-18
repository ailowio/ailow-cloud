/**
 * Seed estrutural Marcant (só categorias + eixos + valores). Zero produtos/preços/estoque.
 *
 * Uso (pedido explícito do humano + EMPRESA_ID real):
 *   npx tsx apps/api/scripts/seed-estrutura-marcant.ts --empresa-id <UUID> --dry-run
 *   npx tsx apps/api/scripts/seed-estrutura-marcant.ts --empresa-id <UUID>
 *
 * Requer DATABASE_URL com papel que rode withEmpresa (ou superuser que seta app.empresa_id).
 */
import pg from 'pg';
import { CORES_PADRAO, TAMANHOS_PADRAO } from '@ailow/shared';

const CATEGORIAS: { nome: string; atributos: string[] }[] = [
  { nome: 'Calcinha', atributos: ['renda', 'compressão'] },
  { nome: 'Sutiã', atributos: ['bojo', 'aro', 'compressão', 'alça removível', 'renda'] },
  { nome: 'Modelador', atributos: ['compressão'] },
  { nome: 'Cinta', atributos: ['compressão'] },
  { nome: 'Body', atributos: [] },
  { nome: 'Robe', atributos: [] },
  { nome: 'Baby doll', atributos: [] },
  { nome: 'Conjunto', atributos: [] },
  { nome: 'Acessório', atributos: [] },
];

const TACAS = ['A', 'B', 'C', 'D'] as const;

function args(): { empresaId: string; dryRun: boolean } {
  const empresaId = process.argv.find((a) => a.startsWith('--empresa-id='))?.slice('--empresa-id='.length)
    ?? process.argv[process.argv.indexOf('--empresa-id') + 1];
  if (!empresaId || !/^[0-9a-f-]{36}$/i.test(empresaId)) {
    console.error('Informe --empresa-id <uuid>');
    process.exit(1);
  }
  return { empresaId, dryRun: process.argv.includes('--dry-run') };
}

async function withEmpresa<T>(pool: pg.Pool, empresaId: string, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.empresa_id', $1, true)`, [empresaId]);
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

async function main() {
  const { empresaId, dryRun } = args();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL obrigatório');
    process.exit(1);
  }
  console.log(JSON.stringify({ empresaId, dryRun, categorias: CATEGORIAS.map((c) => c.nome), eixos: ['tamanho', 'cor', 'taca'] }, null, 2));
  if (dryRun) {
    console.log('dry-run: nada gravado');
    return;
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    await withEmpresa(pool, empresaId, async (c) => {
      const agora = new Date();
      await c.query(
        `INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema, criado_em)
         VALUES ($1,'Tamanho','tamanho','tamanho',true,$2), ($1,'Cor','cor','cor',true,$2), ($1,'Taça','taca','texto',false,$2)
         ON CONFLICT (empresa_id, slug) DO NOTHING`,
        [empresaId, agora],
      );
      const eixos = await c.query<{ id: string; slug: string }>(`SELECT id, slug FROM eixos_grade`);
      const idTam = eixos.rows.find((e) => e.slug === 'tamanho')!.id;
      const idCor = eixos.rows.find((e) => e.slug === 'cor')!.id;
      const idTaca = eixos.rows.find((e) => e.slug === 'taca')!.id;

      await c.query(
        `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, criado_em)
         SELECT $1, $2, nome, $4 FROM unnest($3::text[]) AS t(nome) ON CONFLICT DO NOTHING`,
        [empresaId, idTam, [...TAMANHOS_PADRAO], agora],
      );
      await c.query(
        `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, criado_em)
         SELECT $1, $2, nome, amostra, $5 FROM unnest($3::text[], $4::text[]) AS t(nome, amostra) ON CONFLICT DO NOTHING`,
        [empresaId, idCor, CORES_PADRAO.map((x) => x.nome), CORES_PADRAO.map((x) => x.amostra), agora],
      );
      await c.query(
        `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, criado_em)
         SELECT $1, $2, nome, $4 FROM unnest($3::text[]) AS t(nome) ON CONFLICT DO NOTHING`,
        [empresaId, idTaca, [...TACAS], agora],
      );

      for (const cat of CATEGORIAS) {
        const existente = await c.query(
          `SELECT id FROM categorias WHERE tipo = 'produto' AND lower(btrim(nome)) = lower(btrim($1))`,
          [cat.nome],
        );
        let catId: string;
        if (existente.rowCount === 1) {
          catId = existente.rows[0].id as string;
          await c.query(`UPDATE categorias SET atributos = $2, ativa = true WHERE id = $1`, [catId, cat.atributos]);
        } else {
          const r = await c.query(
            `INSERT INTO categorias (empresa_id, nome, atributos, tipo, criado_em)
             VALUES ($1, $2, $3, 'produto', $4) RETURNING id`,
            [empresaId, cat.nome, cat.atributos, agora],
          );
          catId = r.rows[0].id as string;
        }
        await c.query(`DELETE FROM categoria_eixos WHERE categoria_id = $1`, [catId]);
        await c.query(
          `INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq) VALUES
           ($1,$2,$3,0), ($1,$2,$4,1)`,
          [empresaId, catId, idTam, idCor],
        );
        // Taça na biblioteca, NÃO ligada (spec §5.2)
      }

      const produtos = await c.query(`SELECT count(*)::int AS n FROM produtos`);
      if (produtos.rows[0].n > 0) {
        console.warn(`aviso: empresa já tem ${produtos.rows[0].n} produtos; seed não cria nem apaga produtos`);
      }
    });
    console.log('seed estrutura Marcant concluído (0 produtos criados; Taça desligada das categorias)');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
