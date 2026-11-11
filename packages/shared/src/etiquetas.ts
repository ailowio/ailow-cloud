import { z } from 'zod';
import { MAX_ETIQUETAS_POR_PDF } from './etiquetas-calculos.js';

// Contrato das etiquetas (S08, RF-PRO-06, ADR 003). A resposta é o PDF (binário, fora do Zod).
export * from './etiquetas-calculos.js';

export const etiquetaItemSchema = z.object({
  sku_id: z.uuid(),
  quantidade: z.number().int({ error: 'quantidade inteira' }).min(1).max(MAX_ETIQUETAS_POR_PDF),
});

export const etiquetasPedidoSchema = z
  .object({ itens: z.array(etiquetaItemSchema).min(1, { error: 'escolha ao menos um SKU' }).max(MAX_ETIQUETAS_POR_PDF) })
  .refine((p) => new Set(p.itens.map((i) => i.sku_id)).size === p.itens.length, {
    error: 'SKU repetido',
    path: ['itens'],
  })
  .refine((p) => p.itens.reduce((t, i) => t + i.quantidade, 0) <= MAX_ETIQUETAS_POR_PDF, {
    error: `no máximo ${MAX_ETIQUETAS_POR_PDF} etiquetas por PDF`,
    path: ['itens'],
  });
export type EtiquetasPedido = z.infer<typeof etiquetasPedidoSchema>;
