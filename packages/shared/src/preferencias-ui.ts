import { z } from 'zod';

/** Ids dos módulos da home (espelho de apps/web/src/acesso/modulos.ts). */
export const moduloIdSchema = z.enum([
  'vendas',
  'produtos',
  'compras',
  'clientes',
  'financeiro',
  'pessoas',
  'configuracoes',
]);
export type ModuloId = z.infer<typeof moduloIdSchema>;

export const CHAVE_MODULOS_ORDEM = 'modulos_ordem' as const;

export const preferenciaUiPutSchema = z.object({
  chave: z.literal(CHAVE_MODULOS_ORDEM),
  valor: z.array(moduloIdSchema).max(16),
});
export type PreferenciaUiPut = z.infer<typeof preferenciaUiPutSchema>;

export const preferenciasUiResponseSchema = z.object({
  modulos_ordem: z.array(moduloIdSchema).optional(),
});
export type PreferenciasUi = z.infer<typeof preferenciasUiResponseSchema>;
