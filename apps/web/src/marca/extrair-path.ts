/** Extrai viewBox e todos os `d` de paths da marca oficial (fonte: public/logo.svg). */
export function extrairPathsMarca(svg: string): { viewBox: string; paths: string[] } {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim();
  if (!viewBox) throw new Error('SVG da marca sem viewBox');
  const paths = [...svg.matchAll(/\bd="([^"]*)"/g)]
    .map((m) => (m[1] ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (paths.length === 0) throw new Error('SVG da marca sem path d');
  return { viewBox, paths };
}

/** Compat: primeiro path (testes/legado). Prefira `extrairPathsMarca`. */
export function extrairPathMarca(svg: string): { viewBox: string; d: string } {
  const { viewBox, paths } = extrairPathsMarca(svg);
  return { viewBox, d: paths[0]! };
}
