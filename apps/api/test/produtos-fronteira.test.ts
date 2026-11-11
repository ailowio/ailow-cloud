import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ADR 006 / RN-03: o saldo e o histórico de estoque só mudam pela interface pública (src/produtos/estoque.ts).
// As tabelas `produtos`, `skus` e `movimentos_estoque` só aparecem em SQL dentro de src/produtos/.
// Importar a interface pública (`../produtos/estoque.js`) é o caminho correto e não conta.
const RAIZ_SRC = join(import.meta.dirname, '..', 'src');
const CITA_AS_TABELAS = /\b(from|into|update|join|truncate|table)\s+(produtos|skus|movimentos_estoque)\b/i;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

// `conteudos`: caminho relativo a src (com "/") -> texto do arquivo.
function violacoes(conteudos: Record<string, string>): string[] {
  return Object.entries(conteudos)
    .filter(([caminho]) => !caminho.startsWith('produtos/'))
    .filter(([, texto]) => CITA_AS_TABELAS.test(texto))
    .map(([caminho]) => caminho);
}

describe('fronteira do módulo Produtos (RN-03)', () => {
  it('o detector acusa um módulo que mexe nas tabelas fora de Produtos (e deixa passar o próprio Produtos)', () => {
    expect(
      violacoes({
        'vendas/finalizar.ts': 'await c.query("UPDATE skus SET estoque = estoque - 1")',
        'vendas/preco.ts': 'SELECT preco_centavos FROM Produtos',
        'compras/receber.ts': 'INSERT INTO movimentos_estoque (tipo) VALUES (1)',
        'produtos/estoque.ts': 'UPDATE skus SET estoque = estoque + $2',
        'vendas/ok.ts': 'import { registrarMovimento } from "../produtos/estoque.js"',
      }),
    ).toEqual(['vendas/finalizar.ts', 'vendas/preco.ts', 'compras/receber.ts']);
  });

  it('nenhum arquivo de src/ fora de src/produtos/ cita as tabelas de produtos, SKUs e movimentos', () => {
    const conteudos = Object.fromEntries(
      arquivos(RAIZ_SRC).map((f) => [relative(RAIZ_SRC, f).split(sep).join('/'), readFileSync(f, 'utf8')]),
    );
    expect(Object.keys(conteudos).some((c) => c.startsWith('produtos/'))).toBe(true);
    expect(violacoes(conteudos)).toEqual([]);
  });
});
