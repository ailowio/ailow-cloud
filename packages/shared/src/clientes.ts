import { z } from 'zod';
import { normalizarCelular } from './clientes-calculos.js';

// Contrato de Clientes (S09, RF-CLI-01…04; D8). ADR 007.
// Sem .transform() nos schemas de RESPOSTA (o serializador do Zod 4 não codifica transformação de mão única).
export * from './clientes-calculos.js';

export const NOME_CLIENTE_MAX = 80;
export const LIMITE_CLIENTES_NA_LISTA = 200;

const nomeSchema = z.string().trim().min(1, { error: 'informe o nome' }).max(NOME_CLIENTE_MAX);

// Aceita o celular como a pessoa digita (máscara, +55) e entrega só os 11 dígitos.
export const celularSchema = z
  .string()
  .max(40)
  .refine((v) => normalizarCelular(v) !== null, { error: 'celular com DDD e 9 dígitos, ex.: (11) 91234-5678' })
  .transform((v) => normalizarCelular(v) as string);

// ------------------------------------------------------------------ entrada
// A empresa e o autor vêm da sessão, nunca do corpo: campo desconhecido é recusado.
export const clienteNovoSchema = z.strictObject({
  nome: nomeSchema,
  celular: celularSchema,
  // RF-CLI-04: "já informei ao cliente para que usamos o celular dele"; a API grava a data.
  aviso_lgpd: z.boolean().default(false),
});
export type ClienteNovo = z.infer<typeof clienteNovoSchema>;

export const clientesQuerySchema = z.object({ q: z.string().trim().max(80).optional() });
export const clienteIdParamsSchema = z.object({ id: z.uuid() });

// ------------------------------------------------------------------ saída
// Depois de anonimizado (RF-CLI-04) o cliente continua existindo para as vendas, sem celular e sem o nome.
export const clienteSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  celular: z.string().nullable(),
  aviso_lgpd_em: z.string().nullable(),
  anonimizado_em: z.string().nullable(),
  criado_em: z.string(),
});
export type Cliente = z.infer<typeof clienteSchema>;

export const clientesResponseSchema = z.object({ clientes: z.array(clienteSchema), truncado: z.boolean() });
export const clienteCriadoSchema = z.object({ id: z.uuid() });
