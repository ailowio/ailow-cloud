// Ponto de entrada SEM Zod, para o app web (`@ailow/shared/puro`): só regras puras, nada que valide em runtime.
// O web continua importando apenas TIPOS de `@ailow/shared`; o que precisa executar vem daqui.
export * from './produtos-calculos.js';
export * from './etiquetas-calculos.js';
export * from './clientes-calculos.js';
export * from './vendas-calculos.js';
export * from './compras-calculos.js';
