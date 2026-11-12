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
  { id: 'vendas', rotulo: 'Vendas', perfis: ['dono', 'vendedor'], pronto: false },
  { id: 'produtos', rotulo: 'Produtos', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'compras', rotulo: 'Compras', perfis: ['dono'], pronto: false },
  { id: 'clientes', rotulo: 'Clientes', perfis: ['dono', 'vendedor'], pronto: true },
  { id: 'financeiro', rotulo: 'Financeiro', perfis: ['dono'], pronto: true },
  { id: 'pessoas', rotulo: 'Pessoas', perfis: ['dono', 'vendedor'], pronto: false },
  { id: 'configuracoes', rotulo: 'Configurações', perfis: ['dono'], pronto: true },
];

export const modulosPara = (perfil: Perfil): Modulo[] => TODOS.filter((m) => m.perfis.includes(perfil));
