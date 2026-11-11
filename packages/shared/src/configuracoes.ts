import { z } from 'zod';
import { nomeSchema } from './acesso.js';

// Contrato das Configurações (S05, RF-CFG-02/03/04). Só o Dono acessa.

// Telefone brasileiro: DDD + 8 ou 9 dígitos, guardado só com dígitos.
const digitos = z.string().regex(/^\d{10,11}$/, { error: 'telefone com DDD: 10 ou 11 dígitos' });

// Resposta: sem transformações (o serializador do Zod 4 não codifica transformação de mão única).
export const empresaSchema = z.object({
  nome: nomeSchema,
  telefone: digitos.nullable(),
  endereco: z.string().trim().min(1).max(200).nullable(),
  // Markup em pontos-base (1% = 100), inteiro: sem float em regra de dinheiro. 0 a 1000%.
  markup_bps: z.number().int().min(0).max(100_000),
  // Minutos sem uso até travar o app e expirar a sessão no servidor (RF-ACE-04).
  inatividade_minutos: z.number().int().min(1).max(120),
});
export type Empresa = z.infer<typeof empresaSchema>;

// Entrada: aceita máscara no telefone ((11) 98765-4321) e normaliza para dígitos.
export const empresaEntradaSchema = empresaSchema.extend({
  telefone: z
    .string()
    .transform((v) => v.replace(/[\s().-]/g, ''))
    .pipe(digitos)
    .nullable(),
});

const atributoSchema = z.string().trim().min(1).max(40);
const atributosSchema = z
  .array(atributoSchema)
  .max(20)
  .refine((l) => new Set(l.map((a) => a.toLowerCase())).size === l.length, { error: 'atributos repetidos' });

export const categoriaCorpoSchema = z.object({
  nome: z.string().trim().min(1, { error: 'informe o nome' }).max(60),
  atributos: atributosSchema,
});
export const categoriaAlterarSchema = categoriaCorpoSchema.extend({ ativa: z.boolean() });
export const categoriaSchema = categoriaAlterarSchema.extend({ id: z.uuid() });
export type Categoria = z.infer<typeof categoriaSchema>;
export const categoriasResponseSchema = z.object({ categorias: z.array(categoriaSchema) });
export const categoriaIdParamsSchema = z.object({ id: z.uuid() });
