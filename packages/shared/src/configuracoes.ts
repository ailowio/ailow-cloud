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

// Dois tipos de categoria, em listas separadas: as de PRODUTO (com atributos, usadas ao cadastrar produtos)
// e as FINANCEIRAS (usadas nas despesas e no relatório do Financeiro). O tipo é definido na criação.
export const TIPOS_CATEGORIA = ['produto', 'financeira'] as const;
export const tipoCategoriaSchema = z.enum(TIPOS_CATEGORIA);
export type TipoCategoria = z.infer<typeof tipoCategoriaSchema>;

// Nomes que toda empresa nova já recebe como categorias financeiras (o Dono edita, desativa e cria outras).
export const CATEGORIAS_FINANCEIRAS_PADRAO = [
  'Aluguel',
  'Água',
  'Luz',
  'Internet',
  'Condomínio',
  'Embalagens',
  'Salários',
  'Impostos',
  'Fornecedores',
  'Outros',
] as const;

const categoriaBaseSchema = z.object({
  nome: z.string().trim().min(1, { error: 'informe o nome' }).max(60),
  atributos: atributosSchema,
});
export const categoriaCorpoSchema = categoriaBaseSchema
  // Sem tipo, é de produto: quem já usa a API continua funcionando.
  .extend({ tipo: tipoCategoriaSchema.default('produto') })
  .refine((c) => c.tipo === 'produto' || c.atributos.length === 0, {
    error: 'categoria financeira não tem atributos',
    path: ['atributos'],
  });
// Alterar não troca o tipo (a categoria de produto não vira financeira): por isso o corpo não o tem.
export const categoriaAlterarSchema = categoriaBaseSchema.extend({ ativa: z.boolean() });
export const categoriaSchema = categoriaBaseSchema.extend({ ativa: z.boolean(), tipo: tipoCategoriaSchema, id: z.uuid() });
export type Categoria = z.infer<typeof categoriaSchema>;
export const categoriasResponseSchema = z.object({ categorias: z.array(categoriaSchema) });
export const categoriaIdParamsSchema = z.object({ id: z.uuid() });
export const categoriasQuerySchema = z.object({ tipo: tipoCategoriaSchema.optional() });
