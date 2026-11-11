import { createTheme, type MantineColorsTuple } from '@mantine/core';

/*
 * Identidade Ailow Cloud (D23, 2026-11-10): **azul elétrico #2448FF primário** + **laranja** como destaque
 * (coral #FF7043 e âmbar #FF9A52), ciano #39CFFF em detalhes luminosos, navy/slate como base.
 * O violeta foi retirado a pedido do Pedro. Cada escala tem 10 tons; o tom da marca fica no índice indicado.
 */
// #2448FF no índice 6 (primária)
export const azul: MantineColorsTuple = [
  '#e8edff', '#ccd6ff', '#9badff', '#6984ff', '#4766ff',
  '#3454ff', '#2448ff', '#1b37d6', '#1429ad', '#0d1c82',
];
// #39CFFF no índice 5
export const ciano: MantineColorsTuple = [
  '#e2f8ff', '#c0efff', '#8de3ff', '#5fd9ff', '#47d3ff',
  '#39cfff', '#1db4e6', '#0e91bd', '#057094', '#00526d',
];
// #FF7043 no índice 5 (destaque laranja: totais, PIN, selos)
export const coral: MantineColorsTuple = [
  '#fff0eb', '#ffd8cb', '#ffb398', '#ff9470', '#ff7f57',
  '#ff7043', '#e6582c', '#bf431e', '#993313', '#73240b',
];
// #FF9A52 no índice 5 (alerta: estoque baixo)
export const ambar: MantineColorsTuple = [
  '#fff4ea', '#ffe2c9', '#ffc796', '#ffb06c', '#ffa35c',
  '#ff9a52', '#e67f38', '#bf6425', '#994c16', '#73370b',
];
// Navy/slate: no tema escuro, 7 = fundo, 6 = superfície, 4 = borda, 2 = texto apagado, 0 = texto
export const navy: MantineColorsTuple = [
  '#e7eaf4', '#bcc3d8', '#8e98b3', '#646f8e', '#3b4566',
  '#2b3454', '#1b2340', '#111832', '#0b1126', '#060a19',
];

export const temaAilow = createTheme({
  primaryColor: 'azul',
  primaryShade: { light: 6, dark: 5 },
  colors: { azul, ciano, coral, ambar, dark: navy },
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
