// ADR 017: tamanhos e cores que toda empresa recebe na primeira vez que abre a grade (o Dono renomeia, desativa e
// cria outras na engrenagem do "Novo produto"). Sem Zod: o app web também usa (ponto de entrada `puro`).
// São as mesmas listas que antes eram fixas no app (grades da pesquisa P1 e cores sugeridas da S10).

// Já na ordem de grade (compararTamanhos): letras (U incluso), depois números.
export const TAMANHOS_PADRAO = ['P', 'M', 'G', 'GG', 'U', '40', '42', '44', '46', '48', '50', '52', '54', '56'] as const;

export const CORES_PADRAO: readonly { nome: string; amostra: string }[] = [
  { nome: 'Preto', amostra: '#111111' },
  { nome: 'Nude', amostra: '#e3bc9a' },
  { nome: 'Branco', amostra: '#ffffff' },
  { nome: 'Vermelho', amostra: '#d32f2f' },
  { nome: 'Chocolate', amostra: '#5d3a1a' },
  { nome: 'Vinho', amostra: '#722f37' },
  { nome: 'Rosa', amostra: '#f48fb1' },
  { nome: 'Azul', amostra: '#1e64c8' },
];
