import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// RF-FIN-06 / ADR 005: outros módulos só criam lançamentos pela interface pública do Financeiro.
// A tabela `lancamentos` só aparece em SQL dentro de src/financeiro/. Importar a interface pública
// (`../financeiro/lancamentos.js`) é o caminho correto e não conta.
const RAIZ_SRC = join(import.meta.dirname, '..', 'src');
const CITA_A_TABELA = /\b(from|into|update|join|truncate|table)\s+lancamentos\b/i;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

// `conteudos`: caminho relativo a src (com "/") -> texto do arquivo.
function violacoes(conteudos: Record<string, string>): string[] {
  return Object.entries(conteudos)
    .filter(([caminho]) => !caminho.startsWith('financeiro/'))
    .filter(([, texto]) => CITA_A_TABELA.test(texto))
    .map(([caminho]) => caminho);
}

describe('fronteira do módulo Financeiro (RF-FIN-06)', () => {
  it('o detector acusa um módulo que toca a tabela fora do Financeiro (e deixa passar o próprio Financeiro)', () => {
    expect(
      violacoes({
        'vendas/finalizar.ts': 'await c.query("INSERT INTO lancamentos (tipo) VALUES ($1)")',
        'estoque/baixa.ts': 'SELECT 1 FROM Lancamentos',
        'financeiro/lancamentos.ts': 'INSERT INTO lancamentos',
        'vendas/ok.ts': 'import { registrarLancamento } from "../financeiro/lancamentos.js"',
      }),
    ).toEqual(['vendas/finalizar.ts', 'estoque/baixa.ts']);
  });

  it('nenhum arquivo de src/ fora de src/financeiro/ cita a tabela lancamentos', () => {
    const conteudos = Object.fromEntries(
      arquivos(RAIZ_SRC).map((f) => [relative(RAIZ_SRC, f).split(sep).join('/'), readFileSync(f, 'utf8')]),
    );
    expect(Object.keys(conteudos).some((c) => c.startsWith('financeiro/'))).toBe(true);
    expect(violacoes(conteudos)).toEqual([]);
  });
});
