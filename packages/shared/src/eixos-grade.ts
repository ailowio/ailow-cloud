import { z } from 'zod';
import {
  MAX_EIXOS_POR_CATEGORIA,
  SLUGS_EIXO_SISTEMA,
  TIPOS_VALOR_EIXO,
  type TipoValorEixo,
} from './eixos-grade-padrao.js';
import { amostraSchema } from './opcoes-grade.js';
import { corSchema, tamanhoSchema } from './produtos.js';

export * from './eixos-grade-padrao.js';
export type { TipoValorEixo };

export const tipoValorEixoSchema = z.enum(TIPOS_VALOR_EIXO);

const nomeEixoSchema = z.string().trim().min(1, { error: 'informe o nome' }).max(40);

export const valorTextoEixoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,3}$/, { error: 'valor com 1 a 3 letras ou números' });

/** Body criar eixo: slug é derivado no servidor a partir do nome. */
export const eixoGradeNovoSchema = z.strictObject({
  nome: nomeEixoSchema,
  tipo_valor: tipoValorEixoSchema,
});
export type EixoGradeNovo = z.infer<typeof eixoGradeNovoSchema>;
export const eixoGradeCorpoSchema = eixoGradeNovoSchema;
export type EixoGradeCorpo = EixoGradeNovo;

export const eixoGradeIdParamsSchema = z.object({ id: z.uuid() });

export const valorEixoNovoSchema = z.strictObject({
  nome: z.string().trim().min(1).max(30),
  amostra: amostraSchema.nullable().optional(),
});
export type ValorEixoNovo = z.infer<typeof valorEixoNovoSchema>;
export const valorEixoCorpoSchema = valorEixoNovoSchema;
export type ValorEixoCorpo = ValorEixoNovo;

export const valorEixoAlterarSchema = z.strictObject({
  nome: z.string().trim().min(1).max(30),
  amostra: amostraSchema.nullable(),
  ativa: z.boolean(),
});
export type ValorEixoAlterar = z.infer<typeof valorEixoAlterarSchema>;

export const valorEixoIdParamsSchema = z.object({ id: z.uuid() });

export const categoriaEixoItemSchema = z.strictObject({
  eixo_id: z.uuid(),
  seq: z.number().int().min(0).max(99),
});

export const categoriaEixosDefinirSchema = z
  .strictObject({
    eixos: z.array(categoriaEixoItemSchema).max(MAX_EIXOS_POR_CATEGORIA, {
      error: `no máximo ${MAX_EIXOS_POR_CATEGORIA} eixos por categoria`,
    }),
  })
  .refine((b) => new Set(b.eixos.map((e) => e.eixo_id)).size === b.eixos.length, {
    error: 'eixo repetido',
    path: ['eixos'],
  });
export type CategoriaEixosDefinir = z.infer<typeof categoriaEixosDefinirSchema>;
export const categoriaEixosCorpoSchema = categoriaEixosDefinirSchema;
export type CategoriaEixosCorpo = CategoriaEixosDefinir;

export const valorEixoSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  amostra: z.string().nullable(),
  ativa: z.boolean(),
  eixo_id: z.uuid().optional(),
  seq: z.number().int().optional(),
});
export type ValorEixo = z.infer<typeof valorEixoSchema>;

export const eixoGradeSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  slug: z.string(),
  tipo_valor: tipoValorEixoSchema,
  sistema: z.boolean(),
  ativo: z.boolean(),
  valores: z.array(valorEixoSchema),
  seq: z.number().int().optional(),
});
export type EixoGrade = z.infer<typeof eixoGradeSchema>;

export const eixosGradeResponseSchema = z.object({
  eixos: z.array(eixoGradeSchema),
});
export type EixosGradeResponse = z.infer<typeof eixosGradeResponseSchema>;

export const categoriaEixoSchema = z.object({
  eixo_id: z.uuid(),
  slug: z.string(),
  nome: z.string(),
  tipo_valor: tipoValorEixoSchema,
  seq: z.number().int(),
});
export type CategoriaEixo = z.infer<typeof categoriaEixoSchema>;

export const categoriaEixosResponseSchema = z.object({
  eixos: z.array(categoriaEixoSchema),
});

export const categoriaEixosSchema = z.object({
  categoria_id: z.uuid(),
  eixos: z.array(categoriaEixoSchema),
});

/** Slug a partir do nome: minúsculas, sem acento, só [a-z0-9_]. */
export function slugDeNomeEixo(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base.length > 0 ? base : 'eixo';
}

export function validarNomeValorEixo(tipo: TipoValorEixo, nome: string): string {
  if (tipo === 'tamanho') return tamanhoSchema.parse(nome);
  if (tipo === 'cor') return corSchema.parse(nome);
  return valorTextoEixoSchema.parse(nome);
}

export function ehSlugSistema(slug: string): boolean {
  return (SLUGS_EIXO_SISTEMA as readonly string[]).includes(slug);
}
