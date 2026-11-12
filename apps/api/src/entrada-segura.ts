// Barreira única de entrada (S13a, achado do Schemathesis ST101): o Postgres não aceita o caractere nulo (U+0000)
// em texto e cada rota que gravasse ou buscasse esse texto respondia 500. Aqui vira 400 em qualquer rota.

/** Há U+0000 em algum texto, valor ou nome de campo? (corpo JSON, query e parâmetros do caminho) */
export function contemNul(valor: unknown): boolean {
  if (typeof valor === 'string') return valor.includes('\u0000');
  if (Array.isArray(valor)) return valor.some(contemNul);
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).some(([campo, v]) => campo.includes('\u0000') || contemNul(v));
  }
  return false;
}
