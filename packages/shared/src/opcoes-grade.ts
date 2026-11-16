import { z } from 'zod';
import { corSchema, tamanhoSchema } from './produtos.js';

// Contrato das opções da grade (ADR 017): tamanhos e cores configuráveis por empresa (só o Dono).
// As regras de texto são as MESMAS do SKU (tamanhoSchema, corSchema): uma opção sempre vira um SKU válido.
export * from './opcoes-grade-padrao.js';

export const TIPOS_OPCAO_GRADE = ['tamanho', 'cor'] as const;
export const tipoOpcaoGradeSchema = z.enum(TIPOS_OPCAO_GRADE);
export type TipoOpcaoGrade = z.infer<typeof tipoOpcaoGradeSchema>;

// Amostra do chip de cor: #rrggbb em minúsculas (o app manda assim; o banco confere o mesmo formato).
export const amostraSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, { error: 'amostra no formato #rrggbb' });

export const opcaoGradeCorpoSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('tamanho'), nome: tamanhoSchema }),
  z.strictObject({ tipo: z.literal('cor'), nome: corSchema, amostra: amostraSchema.nullable().optional() }),
]);
export type OpcaoGradeCorpo = z.infer<typeof opcaoGradeCorpoSchema>;

// PUT: o tipo não muda; o servidor valida o nome pela regra do tipo da linha (tamanho ou cor).
export const opcaoGradeAlterarSchema = z.strictObject({
  nome: z.string().trim().min(1).max(30),
  amostra: amostraSchema.nullable(),
  ativa: z.boolean(),
});
export type OpcaoGradeAlterar = z.infer<typeof opcaoGradeAlterarSchema>;

export const opcaoGradeIdParamsSchema = z.object({ id: z.uuid() });

export const opcaoGradeSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  amostra: z.string().nullable(),
  ativa: z.boolean(),
});
export type OpcaoGrade = z.infer<typeof opcaoGradeSchema>;

// Tamanhos na ordem de grade (P, M, G, GG… 40, 42…); cores na ordem de cadastro.
export const opcoesGradeResponseSchema = z.object({
  tamanhos: z.array(opcaoGradeSchema),
  cores: z.array(opcaoGradeSchema),
});
export type OpcoesGrade = z.infer<typeof opcoesGradeResponseSchema>;
