/** Extrai viewBox e o `d` do primeiro path de um SVG de marca (fonte: public/logo.svg). */
export function extrairPathMarca(svg: string): { viewBox: string; d: string } {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim();
  if (!viewBox) throw new Error('SVG da marca sem viewBox');
  const bruto = /\bd="([^"]*)"/.exec(svg)?.[1];
  if (bruto === undefined) throw new Error('SVG da marca sem path d');
  const d = bruto.replace(/\s+/g, ' ').trim();
  if (!d) throw new Error('SVG da marca sem path d');
  return { viewBox, d };
}
