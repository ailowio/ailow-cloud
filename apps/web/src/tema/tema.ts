import { createTheme, type MantineColorsTuple } from '@mantine/core';

/*
 * Identidade Ailow Cloud (brief do Pedro, 2026-11-10):
 * violeta elétrico #9200FF dominante · roxo neon #7000E8 · azul elétrico #2448FF secundário ·
 * ciano #39CFFF em detalhes luminosos · coral #FF7043 e âmbar #FF9A52 com moderação ·
 * navy profundo e slate escuro como base neutra.
 * Cada escala tem 10 tons; o tom da marca fica no índice indicado.
 */

// #9200FF no índice 6 (primária); #7000E8 ≈ índice 7
export const violeta: MantineColorsTuple = [
  '#f3e8ff', '#e3c9ff', '#c995ff', '#ae5fff', '#9c36ff',
  '#951aff', '#9200ff', '#7000e8', '#5a00b8', '#430089',
];
// #2448FF no índice 6
export const azul: MantineColorsTuple = [
  '#e8edff', '#ccd6ff', '#9badff', '#6984ff', '#4766ff',
  '#3454ff', '#2448ff', '#1b37d6', '#1429ad', '#0d1c82',
];
// #39CFFF no índice 5
export const ciano: MantineColorsTuple = [
  '#e2f8ff', '#c0efff', '#8de3ff', '#5fd9ff', '#47d3ff',
  '#39cfff', '#1db4e6', '#0e91bd', '#057094', '#00526d',
];
// #FF7043 no índice 5 (perigo, usado com moderação)
export const coral: MantineColorsTuple = [
  '#fff0eb', '#ffd8cb', '#ffb398', '#ff9470', '#ff7f57',
  '#ff7043', '#e6582c', '#bf431e', '#993313', '#73240b',
];
// #FF9A52 no índice 5 (alerta, usado com moderação)
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
  primaryColor: 'violeta',
  primaryShade: { light: 6, dark: 5 },
  colors: { violeta, azul, ciano, coral, ambar, dark: navy },
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
