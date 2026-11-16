/** Matemática de cor do WCAG 2.x (luminância relativa, razão de contraste) e saturação HSL. Sem dependências. */

export type Rgb = readonly [number, number, number];

/** Aceita `#rgb`, `#rrggbb` ou `rgb(r, g, b)` / `rgb(r g b)` (como o navegador devolve estilos calculados). */
export function lerCor(texto: string): Rgb {
  const t = texto.trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(t);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t);
  if (!hex) throw new Error(`Cor não reconhecida: "${texto}"`);
  const h = hex[1] as string;
  const cheio = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as unknown as Rgb;
}

function linear(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminancia(cor: Rgb): number {
  return 0.2126 * linear(cor[0]) + 0.7152 * linear(cor[1]) + 0.0722 * linear(cor[2]);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(lerCor(a));
  const lb = luminancia(lerCor(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Saturação HSL em % (0 a 100). */
export function saturacaoHsl(cor: string): number {
  const [r, g, b] = lerCor(cor).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return (d / (1 - Math.abs(2 * l - 1))) * 100;
}

export function hexNormalizado(cor: string): string {
  return '#' + lerCor(cor).map((v) => v.toString(16).padStart(2, '0')).join('');
}
