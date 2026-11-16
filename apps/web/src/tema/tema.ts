import { createTheme, type MantineColorsTuple } from '@mantine/core';

/*
 * Paleta única (UXM-08, 2026-11-13): a **marca é a cor do "A" da logo** (#07BDD5, public/logo.svg).
 * O azul #2448FF (antes primário) ficou só como cor secundária/de apoio. O tema escuro é cinza chumbo.
 * Âmbar permanece apenas como cor semântica de alerta (estoque baixo). Laranja/coral e ciano foram retirados.
 * Cada escala tem 10 tons; o tom da marca fica no índice indicado.
 */
// #07BDD5 (cor do A da logo) no índice 5; 7 = ação no claro (branco sobre ele = 4,78:1); 8 = texto no claro.
export const marca: MantineColorsTuple = [
  '#e0fafe', '#b8f1fb', '#86e6f5', '#4fd8ec', '#26cbe3',
  '#07bdd5', '#05a0b6', '#047e90', '#036171', '#024654',
];
// #2448FF no índice 6 (secundária)
export const azul: MantineColorsTuple = [
  '#e8edff', '#ccd6ff', '#9badff', '#6984ff', '#4766ff',
  '#3454ff', '#2448ff', '#1b37d6', '#1429ad', '#0d1c82',
];
// #FF9A52 no índice 5 (alerta: estoque baixo)
export const ambar: MantineColorsTuple = [
  '#fff4ea', '#ffe2c9', '#ffc796', '#ffb06c', '#ffa35c',
  '#ff9a52', '#e67f38', '#bf6425', '#994c16', '#73370b',
];
// Cinza chumbo (saturação baixa): no tema escuro 0 = texto, 2 = texto apagado, 4 = borda, 6 = superfície, 7 = fundo
export const chumbo: MantineColorsTuple = [
  '#ececed', '#c6c8cc', '#a3a7ad', '#757980', '#44474c',
  '#2f3236', '#26282b', '#1b1c1e', '#141516', '#0d0e0f',
];

export const temaAilow = createTheme({
  primaryColor: 'marca',
  primaryShade: { light: 7, dark: 5 },
  colors: { marca, azul, ambar, dark: chumbo },
  autoContrast: true,
  fontFamily: '"Manrope Variable", "Segoe UI", system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "Cascadia Mono", Consolas, monospace',
  headings: { fontFamily: '"Sora Variable", "Segoe UI", system-ui, sans-serif', fontWeight: '650' },
  defaultRadius: 'md',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { size: 'lg' } }, // altura >= 48 px (RNF-05)
  },
});
