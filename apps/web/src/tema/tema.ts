import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Camada 2: tema da empresa (virá de Configurações; valores da Marcant como exemplo)
export const marca: MantineColorsTuple = [
  '#fde9f1', '#f9c6da', '#f39fc0', '#ec77a6', '#e4518d',
  '#d63777', '#b82a63', '#952150', '#72193d', '#4f102a',
];
export const ouro: MantineColorsTuple = [
  '#fbf5e6', '#f3e5c0', '#e9d296', '#dfbe6b', '#d4ab4a',
  '#c39836', '#a67f2b', '#856523', '#644c1a', '#433311',
];

// Camada 1: Ailow Cloud (fixa)
export const temaAilow = createTheme({
  primaryColor: 'marca',
  primaryShade: { light: 6, dark: 5 },
  colors: { marca, ouro },
  autoContrast: true,
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: '700' },
  defaultRadius: 'md',
  components: {
    Button: { defaultProps: { size: 'lg' } }, // altura >= 48 px (RNF-05)
  },
});
