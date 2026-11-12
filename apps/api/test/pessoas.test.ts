import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import {
  Cliente,
  type EmpresaDeTeste,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// S12 / RF-PES-01/02, TEST-17. Só ids criados neste arquivo (L-0008). Relógio: só segundos (L-0016).
// O relógio começa em 2026-11-11T12:00Z = 09:00 em São Paulo.

interface Lado {
  dados: EmpresaDeTeste;
  dono: Cliente;
  vendedor: Cliente;
  vendedorId: string;
}

interface Marca {
  id: string;
  tipo: 'entrada' | 'saida';
  registrado_em: string;
}
interface EspelhoResp {
  mes: string;
  usuarios: {
    usuario_id: string;
    nome: string;
    total_segundos: number;
    dias: { data: string; marcas: Marca[]; trabalhado_segundos: number; em_aberto: boolean }[];
  }[];
}

describe('Pessoas — ponto (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const pin = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (pin.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${pin.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor, vendedorId: p.vendedorId };
  }

  // Marcas antigas direto no banco (como dono do schema), em ordem cronológica: entrada, saída, entrada…
  async function semear(lado: Lado, usuarioId: string, instantes: string[]) {
    let n = 0;
    for (const em of instantes) {
      n += 1;
      await owner.query(
        'INSERT INTO pontos (empresa_id, usuario_id, tipo, registrado_em) VALUES ($1, $2, $3, $4)',
        [lado.dados.empresaId, usuarioId, n % 2 === 1 ? 'entrada' : 'saida', em],
      );
    }
  }

  let a: Lado;
  let b: Lado;
  let c: Lado;
  let d: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 8);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Pessoas A');
    b = await montar('Pessoas B');
    c = await montar('Pessoas C');
    d = await montar('Pessoas D');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('autorização (TEST-17)', () => {
    it('sem sessão: 401 nas três rotas', async () => {
      const anon = new Cliente(app);
      expect((await anon.get('/pontos/estado')).statusCode).toBe(401);
      expect((await anon.post('/pontos')).statusCode).toBe(401);
      expect((await anon.get('/pontos/espelho?mes=2026-11-01')).statusCode).toBe(401);
    });
  });

  describe('bater ponto (RF-PES-01)', () => {
    it('a primeira batida é entrada, com a hora do servidor, ignorando hora mandada no corpo', async () => {
      const antes = await a.vendedor.get('/pontos/estado');
      expect(antes.statusCode).toBe(200);
      expect(antes.json()).toEqual({ proximo: 'entrada', ultima: null });

      const res = await a.vendedor.post('/pontos', { registrado_em: '2001-01-01T00:00:00.000Z', tipo: 'saida' });
      expect(res.statusCode).toBe(201);
      const corpo = res.json() as { marca: Marca; proximo: string };
      expect(corpo.marca.tipo).toBe('entrada');
      expect(corpo.marca.registrado_em).toBe(relogio.agora.toISOString());
      expect(corpo.proximo).toBe('saida');

      const depois = await a.vendedor.get('/pontos/estado');
      expect(depois.json()).toEqual({ proximo: 'saida', ultima: corpo.marca });
    });

    it('a batida seguinte, depois do intervalo, é saída; depois volta a entrada', async () => {
      relogio.avancarSegundos(31);
      const saida = await a.vendedor.post('/pontos');
      expect(saida.statusCode).toBe(201);
      expect((saida.json() as { marca: Marca }).marca.tipo).toBe('saida');
      relogio.avancarSegundos(31);
      const entrada = await a.vendedor.post('/pontos');
      expect((entrada.json() as { marca: Marca }).marca.tipo).toBe('entrada');
    });

    it('toque duplo (< 30 s) é recusado com 409 e nada é gravado', async () => {
      relogio.avancarSegundos(10);
      const duplo = await a.vendedor.post('/pontos');
      expect(duplo.statusCode).toBe(409);
      expect(duplo.json()).toEqual({ erro: 'muito_rapido' });
      const estado = (await a.vendedor.get('/pontos/estado')).json() as { proximo: string };
      expect(estado.proximo).toBe('saida'); // continua dentro: a recusa não alternou nada
    });

    it('duas batidas simultâneas gravam só uma (nunca duas entradas seguidas)', async () => {
      relogio.avancarSegundos(31);
      const [r1, r2] = await Promise.all([b.vendedor.post('/pontos'), b.vendedor.post('/pontos')]);
      expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
      const n = await owner.query('SELECT count(*)::int AS n FROM pontos WHERE usuario_id = $1', [b.vendedorId]);
      expect(n.rows[0].n).toBe(1);
    });

    it('o Dono também bate ponto, e o ponto é de quem está na sessão', async () => {
      relogio.avancarSegundos(31);
      const res = await a.dono.post('/pontos');
      expect(res.statusCode).toBe(201);
      const dono = await owner.query('SELECT tipo FROM pontos WHERE usuario_id = $1', [a.dados.donoId]);
      expect(dono.rows).toEqual([{ tipo: 'entrada' }]);
    });
  });

  describe('integridade no banco', () => {
    it('o banco recusa tipo inválido e marca de usuário inexistente', async () => {
      const u = c.vendedorId;
      await expect(
        owner.query("INSERT INTO pontos (empresa_id, usuario_id, tipo, registrado_em) VALUES ($1, $2, 'almoco', now())", [
          c.dados.empresaId,
          u,
        ]),
      ).rejects.toThrow(/check constraint|violates/i);
      await expect(
        owner.query("INSERT INTO pontos (empresa_id, usuario_id, tipo, registrado_em) VALUES ($1, $2, 'entrada', now())", [
          c.dados.empresaId,
          randomUUID(),
        ]),
      ).rejects.toThrow(/foreign key|violates/i);
    });

    it('o papel da aplicação nunca apaga linha, nem muda tipo ou dono da marca; os ajustes não se reescrevem', async () => {
      const so = (sql: string) => withEmpresa(pool, a.dados.empresaId, (cl) => cl.query(sql, [a.vendedorId]));
      await expect(so('DELETE FROM pontos WHERE usuario_id = $1')).rejects.toThrow(/permission denied/i);
      await expect(so("UPDATE pontos SET tipo = 'saida' WHERE usuario_id = $1")).rejects.toThrow(/permission denied/i);
      await expect(so('UPDATE pontos SET usuario_id = usuario_id WHERE usuario_id = $1')).rejects.toThrow(/permission denied/i);
      await expect(so('UPDATE pontos_ajustes SET motivo = motivo WHERE ator_id = $1')).rejects.toThrow(/permission denied/i);
      await expect(so('DELETE FROM pontos_ajustes WHERE ator_id = $1')).rejects.toThrow(/permission denied/i);
    });
  });

  describe('espelho (RF-PES-02)', () => {
    it('o Vendedor vê só o próprio; pedir o de outro dá 403', async () => {
      const proprio = await a.vendedor.get('/pontos/espelho?mes=2026-11-01');
      expect(proprio.statusCode).toBe(200);
      const corpo = proprio.json() as EspelhoResp;
      expect(corpo.usuarios.map((u) => u.usuario_id)).toEqual([a.vendedorId]);
      expect(corpo.usuarios[0]?.dias[0]?.data).toBe('2026-11-11');

      const doDono = await a.vendedor.get(`/pontos/espelho?mes=2026-11-01&usuario_id=${a.dados.donoId}`);
      expect(doDono.statusCode).toBe(403);
      const eleMesmo = await a.vendedor.get(`/pontos/espelho?mes=2026-11-01&usuario_id=${a.vendedorId}`);
      expect(eleMesmo.statusCode).toBe(200);
    });

    it('o Dono vê todos; o filtro por usuário traz só aquele', async () => {
      const todos = (await a.dono.get('/pontos/espelho?mes=2026-11-01')).json() as EspelhoResp;
      expect(todos.usuarios.map((u) => u.usuario_id).sort()).toEqual([a.dados.donoId, a.vendedorId].sort());
      const um = (await a.dono.get(`/pontos/espelho?mes=2026-11-15&usuario_id=${a.vendedorId}`)).json() as EspelhoResp;
      expect(um.mes).toBe('2026-11-01');
      expect(um.usuarios.map((u) => u.usuario_id)).toEqual([a.vendedorId]);
    });

    it('a empresa B nunca enxerga a A, nem pedindo o id (404), e a lista dela só tem os dela', async () => {
      const lista = (await b.dono.get('/pontos/espelho?mes=2026-11-01')).json() as EspelhoResp;
      const ids = lista.usuarios.map((u) => u.usuario_id);
      expect(ids).toEqual([b.vendedorId]);
      expect(ids).not.toContain(a.vendedorId);
      const alheio = await b.dono.get(`/pontos/espelho?mes=2026-11-01&usuario_id=${a.vendedorId}`);
      expect(alheio.statusCode).toBe(404);
      const inexistente = await b.dono.get(`/pontos/espelho?mes=2026-11-01&usuario_id=${randomUUID()}`);
      expect(inexistente.statusCode).toBe(404);
    });

    it('mês inválido dá 400', async () => {
      expect((await a.dono.get('/pontos/espelho?mes=novembro')).statusCode).toBe(400);
      expect((await a.dono.get('/pontos/espelho')).statusCode).toBe(400);
    });

    it('fuso de São Paulo e virada de mês: turno 30/11 22:00 → 01/12 02:00 é de novembro, 4 h, no dia 30', async () => {
      const u = c.vendedorId;
      await semear(c, u, [
        '2026-10-05T11:00:00.000Z', // out 08:00
        '2026-10-05T15:00:00.000Z', // out 12:00
        '2026-12-01T01:00:00.000Z', // 30/11 22:00 em SP
        '2026-12-01T05:00:00.000Z', // 01/12 02:00 em SP
        '2026-12-01T11:00:00.000Z', // 01/12 08:00
      ]);
      const nov = (await c.dono.get(`/pontos/espelho?mes=2026-11-01&usuario_id=${u}`)).json() as EspelhoResp;
      const dias = nov.usuarios[0]?.dias ?? [];
      expect(dias.map((d) => d.data)).toEqual(['2026-11-30']);
      expect(dias[0]?.trabalhado_segundos).toBe(4 * 3600);
      expect(dias[0]?.marcas).toHaveLength(2);
      expect(nov.usuarios[0]?.total_segundos).toBe(4 * 3600);

      const dez = (await c.dono.get(`/pontos/espelho?mes=2026-12-01&usuario_id=${u}`)).json() as EspelhoResp;
      const diasDez = dez.usuarios[0]?.dias ?? [];
      expect(diasDez.map((d) => d.data)).toEqual(['2026-12-01']);
      expect(diasDez[0]?.em_aberto).toBe(true); // entrada das 08:00 sem saída
      expect(diasDez[0]?.trabalhado_segundos).toBe(0);
      expect(dez.usuarios[0]?.total_segundos).toBe(0);

      const out = (await c.dono.get(`/pontos/espelho?mes=2026-10-20&usuario_id=${u}`)).json() as EspelhoResp;
      expect(out.usuarios[0]?.total_segundos).toBe(4 * 3600);
    });

    it('quem não bateu ponto no mês não aparece no espelho do Dono', async () => {
      const vazio = (await c.dono.get('/pontos/espelho?mes=2025-01-01')).json() as EspelhoResp;
      expect(vazio.usuarios).toEqual([]);
    });
  });

  // RF-PES-03: só o Dono adiciona, edita e exclui. A hora vem em dia + HH:MM de São Paulo (UTC−3).
  describe('ajustes do Dono (RF-PES-03)', () => {
    const DIA = '2026-11-10';
    const manual = (lado: Lado, corpo: object) => lado.dono.post('/pontos/manual', corpo);
    const espelho = async (cli: Cliente, usuarioId?: string) => {
      const q = usuarioId ? `&usuario_id=${usuarioId}` : '';
      const r = await cli.get(`/pontos/espelho?mes=${DIA}${q}`);
      return (r.json() as EspelhoResp).usuarios.find((u) => u.usuario_id === (usuarioId ?? ''));
    };
    const log = async (usuarioId: string, acao: string) =>
      (
        await owner.query(
          `SELECT a.acao, a.motivo, a.ator_id, a.antes, a.depois
             FROM pontos_ajustes a JOIN pontos p ON p.id = a.ponto_id
            WHERE p.usuario_id = $1 AND a.acao = $2 ORDER BY a.criado_em`,
          [usuarioId, acao],
        )
      ).rows as { acao: string; motivo: string; ator_id: string; antes: unknown; depois: unknown }[];

    let entradaId = '';
    let saidaId = '';

    it('sem sessão 401; Vendedor 403 nas três ações; outra empresa não enxerga nem cria (404)', async () => {
      const corpo = { usuario_id: d.vendedorId, tipo: 'entrada', data: DIA, hora: '08:00', motivo: 'esqueceu' };
      expect((await new Cliente(app).post('/pontos/manual', corpo)).statusCode).toBe(401);
      expect((await d.vendedor.post('/pontos/manual', corpo)).statusCode).toBe(403);
      expect((await d.vendedor.put(`/pontos/${randomUUID()}`, { data: DIA, hora: '08:00', motivo: 'x' })).statusCode).toBe(403);
      expect((await d.vendedor.post(`/pontos/${randomUUID()}/excluir`, { motivo: 'x' })).statusCode).toBe(403);
      // Dono da empresa B tentando mexer no usuário da empresa D: o id não existe para ele.
      expect((await manual(b, corpo)).statusCode).toBe(404);
    });

    it('o Dono adiciona entrada e saída em dia passado: hora de SP convertida, marcada como ajustada, com log', async () => {
      const e = await manual(d, { usuario_id: d.vendedorId, tipo: 'entrada', data: DIA, hora: '08:00', motivo: 'Esqueceu de bater' });
      expect(e.statusCode).toBe(201);
      const entrada = e.json() as Marca & { ajustado: boolean };
      expect(entrada).toMatchObject({ tipo: 'entrada', registrado_em: '2026-11-10T11:00:00.000Z', ajustado: true });
      entradaId = entrada.id;
      const s = await manual(d, { usuario_id: d.vendedorId, tipo: 'saida', data: DIA, hora: '12:00', motivo: 'Esqueceu de bater' });
      expect(s.statusCode).toBe(201);
      saidaId = (s.json() as Marca).id;

      const u = await espelho(d.dono, d.vendedorId);
      expect(u?.total_segundos).toBe(4 * 3600);
      expect(u?.dias[0]?.marcas.every((m) => (m as Marca & { ajustado: boolean }).ajustado)).toBe(true);

      const l = await log(d.vendedorId, 'adicionar');
      expect(l).toHaveLength(2);
      expect(l[0]).toMatchObject({ ator_id: d.dados.donoId, motivo: 'Esqueceu de bater', antes: null });
    });

    it('recusa o que quebra a sequência, o futuro, motivo vazio, hora ruim e usuário inexistente', async () => {
      const base = { usuario_id: d.vendedorId, tipo: 'entrada', data: DIA, hora: '15:00', motivo: 'teste' };
      // Entrada depois de uma saída é válida; duas entradas seguidas não.
      expect(((await manual(d, { ...base, hora: '09:00' })).json() as { erro: string }).erro).toBe('nao_alterna');
      expect(((await manual(d, { ...base, tipo: 'saida', hora: '13:00' })).json() as { erro: string }).erro).toBe('nao_alterna');
      expect(((await manual(d, { ...base, tipo: 'saida', hora: '08:00' })).json() as { erro: string }).erro).toBe('horario_repetido');
      expect((await manual(d, { ...base, data: '2026-11-12' })).json()).toEqual({ erro: 'no_futuro' });
      expect((await manual(d, { ...base, motivo: '   ' })).statusCode).toBe(400);
      expect((await manual(d, { ...base, hora: '25:00' })).statusCode).toBe(400);
      expect((await manual(d, { ...base, usuario_id: randomUUID() })).statusCode).toBe(404);
      // Nada disso gravou.
      expect((await espelho(d.dono, d.vendedorId))?.dias[0]?.marcas).toHaveLength(2);
    });

    it('a primeira marca de quem nunca bateu não pode ser saída', async () => {
      const novo = await manual(d, { usuario_id: d.dados.donoId, tipo: 'saida', data: DIA, hora: '10:00', motivo: 'teste' });
      expect(novo.statusCode).toBe(409);
      expect(novo.json()).toEqual({ erro: 'comecar_com_entrada' });
    });

    it('o Dono edita o horário: total recalculado, antes/depois no log; se inverte a ordem, 409 e nada muda', async () => {
      const ok = await d.dono.put(`/pontos/${saidaId}`, { data: DIA, hora: '13:00', motivo: 'Saiu às 13h' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ id: saidaId, tipo: 'saida', registrado_em: '2026-11-10T16:00:00.000Z', ajustado: true });
      expect((await espelho(d.dono, d.vendedorId))?.total_segundos).toBe(5 * 3600);
      const l = await log(d.vendedorId, 'editar');
      expect(l).toHaveLength(1);
      expect(l[0]?.antes).toMatchObject({ registrado_em: '2026-11-10T15:00:00.000Z' });
      expect(l[0]?.depois).toMatchObject({ registrado_em: '2026-11-10T16:00:00.000Z' });

      const inverte = await d.dono.put(`/pontos/${saidaId}`, { data: DIA, hora: '07:00', motivo: 'erro' });
      expect(inverte.statusCode).toBe(409);
      expect((await espelho(d.dono, d.vendedorId))?.total_segundos).toBe(5 * 3600);
      expect((await d.dono.put(`/pontos/${randomUUID()}`, { data: DIA, hora: '07:00', motivo: 'x' })).statusCode).toBe(404);
      expect((await b.dono.put(`/pontos/${saidaId}`, { data: DIA, hora: '09:00', motivo: 'x' })).statusCode).toBe(404);
    });

    it('excluir a saída deixa a entrada "em aberto" e a linha continua no banco (exclusão lógica + log)', async () => {
      const del = await d.dono.post(`/pontos/${saidaId}/excluir`, { motivo: 'Batida duplicada' });
      expect(del.statusCode).toBe(204);
      const dia = (await espelho(d.dono, d.vendedorId))?.dias[0];
      expect(dia?.em_aberto).toBe(true);
      expect(dia?.marcas).toHaveLength(1);
      const linha = await owner.query('SELECT removido_em, removido_por FROM pontos WHERE id = $1', [saidaId]);
      expect(linha.rows[0].removido_em).not.toBeNull();
      expect(linha.rows[0].removido_por).toBe(d.dados.donoId);
      const l = await log(d.vendedorId, 'excluir');
      expect(l[0]).toMatchObject({ motivo: 'Batida duplicada', ator_id: d.dados.donoId });
      expect((await d.dono.post(`/pontos/${saidaId}/excluir`, { motivo: 'de novo' })).statusCode).toBe(404);
      expect((await d.dono.put(`/pontos/${saidaId}`, { data: DIA, hora: '14:00', motivo: 'x' })).statusCode).toBe(404);
    });

    it('a batida do Vendedor passa a olhar só as marcas ativas: depois da exclusão a próxima é saída', async () => {
      const estado = (await d.vendedor.get('/pontos/estado')).json() as { proximo: string; ultima: { id: string } };
      expect(estado.proximo).toBe('saida');
      expect(estado.ultima.id).toBe(entradaId);
    });

    it('excluir uma entrada que deixaria a saída sozinha é recusado (409)', async () => {
      await manual(d, { usuario_id: d.vendedorId, tipo: 'saida', data: DIA, hora: '17:00', motivo: 'refaz' });
      const r = await d.dono.post(`/pontos/${entradaId}/excluir`, { motivo: 'erro' });
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ erro: 'comecar_com_entrada' });
    });

    it('o Vendedor vê no próprio espelho o que foi ajustado, e o excluído não aparece', async () => {
      const u = await espelho(d.vendedor, d.vendedorId);
      const marcas = u?.dias.flatMap((x) => x.marcas) ?? [];
      expect(marcas.length).toBeGreaterThan(0);
      expect(marcas.every((m) => (m as Marca & { ajustado: boolean }).ajustado)).toBe(true);
      expect(marcas.map((m) => m.id)).not.toContain(saidaId);
    });
  });
});
