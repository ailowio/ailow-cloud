import type { Perfil } from '@ailow/shared';

export interface Modulo {
  id: 'vendas' | 'produtos' | 'compras' | 'clientes' | 'financeiro' | 'pessoas' | 'configuracoes';
  rotulo: string; // uma palavra (D4)
  perfis: readonly Perfil[];
  // false = ainda não existe nesta versão do app; a grade mostra "em breve" em vez de um botão que não faz nada.
  pronto: boolean;
}

// Ordem fixa: Vendas é o 1º, no canto superior esquerdo (RF-VEN-01). Vendedor nunca vê Financeiro,
// Compras nem Configurações (RN-10). O servidor impõe o mesmo (exigirPerfil); aqui é só para não mostrar o que não abre.
const TODOS: readonly Modulo[] = [
  { id: 'vendas', rotulo: 'Vendas', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'produtos', rotulo: 'Produtos', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'compras', rotulo: 'Compras', perfis: ['dono'], pronto: true },
  { id: 'clientes', rotulo: 'Clientes', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'financeiro', rotulo: 'Financeiro', perfis: ['dono'], pronto: true },
  { id: 'pessoas', rotulo: 'Pessoas', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'configuracoes', rotulo: 'Configurações', perfis: ['dono'], pronto: true },
];

export const modulosPara = (perfil: Perfil): Modulo[] => TODOS.filter((m) => m.perfis.includes(perfil));

/**
 * Aplica a ordem salva no perfil: ids conhecidos e permitidos primeiro;
 * módulos novos (ainda sem preferência) no fim, na ordem padrão.
 */
export function ordenarModulos(disponiveis: readonly Modulo[], preferidos: readonly string[] | undefined): Modulo[] {
  if (!preferidos || preferidos.length === 0) return [...disponiveis];
  const porId = new Map(disponiveis.map((m) => [m.id, m]));
  const usados = new Set<string>();
  const ordenados: Modulo[] = [];
  for (const id of preferidos) {
    const m = porId.get(id as Modulo['id']);
    if (m && !usados.has(m.id)) {
      ordenados.push(m);
      usados.add(m.id);
    }
  }
  for (const m of disponiveis) {
    if (!usados.has(m.id)) ordenados.push(m);
  }
  return ordenados;
}
