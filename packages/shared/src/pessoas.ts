import { z } from 'zod';
import { dataSchema } from './financeiro.js';
import { MOTIVO_AJUSTE_MAX } from './pessoas-calculos.js';

// Contrato de Pessoas (S12, RF-PES-01/02). Sem .transform() nas respostas.
export * from './pessoas-calculos.js';

const tipoSchema = z.enum(['entrada', 'saida']);

export const marcaSchema = z.object({
  id: z.uuid(),
  tipo: tipoSchema,
  registrado_em: z.iso.datetime(),
  ajustado: z.boolean(), // true = criado ou mudado pelo Dono (aparece marcado no espelho)
});

// ------------------------------------------------------------------ ajustes do Dono (RF-PES-03)
// A hora vem como dia + "HH:MM" no relógio de São Paulo; o servidor converte (o app não faz conta de fuso).
const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'hora no formato HH:MM' });
const motivoSchema = z.string().trim().min(1, { error: 'informe o motivo' }).max(MOTIVO_AJUSTE_MAX);

export const pontoIdParamsSchema = z.object({ id: z.uuid() });

export const ajusteNovoSchema = z.strictObject({
  usuario_id: z.uuid(),
  tipo: tipoSchema,
  data: dataSchema,
  hora: horaSchema,
  motivo: motivoSchema,
});
export type AjusteNovo = z.infer<typeof ajusteNovoSchema>;

// Editar muda só o horário; para trocar entrada por saída, exclui-se e adiciona-se (a sequência é validada).
export const ajusteEditarSchema = z.strictObject({ data: dataSchema, hora: horaSchema, motivo: motivoSchema });
export type AjusteEditar = z.infer<typeof ajusteEditarSchema>;

export const ajusteExcluirSchema = z.strictObject({ motivo: motivoSchema });
export type AjusteExcluir = z.infer<typeof ajusteExcluirSchema>;

// ------------------------------------------------------------------ bater ponto (RF-PES-01)
// POST /pontos não tem corpo: quem bate é a sessão e a hora é a do servidor.
export const pontoEstadoSchema = z.object({
  proximo: tipoSchema,
  ultima: marcaSchema.nullable(),
});
export type PontoEstado = z.infer<typeof pontoEstadoSchema>;

export const pontoBatidoSchema = z.object({
  marca: marcaSchema,
  proximo: tipoSchema,
});
export type PontoBatido = z.infer<typeof pontoBatidoSchema>;

// ------------------------------------------------------------------ espelho (RF-PES-02)
export const espelhoQuerySchema = z.object({
  mes: dataSchema, // qualquer dia do mês; vale o mês
  usuario_id: z.uuid().optional(),
});

const diaSchema = z.object({
  data: dataSchema,
  marcas: z.array(marcaSchema),
  trabalhado_segundos: z.number().int().nonnegative(),
  em_aberto: z.boolean(),
});

export const espelhoSchema = z.object({
  mes: dataSchema,
  usuarios: z.array(
    z.object({
      usuario_id: z.uuid(),
      nome: z.string(),
      total_segundos: z.number().int().nonnegative(),
      dias: z.array(diaSchema),
    }),
  ),
});
export type Espelho = z.infer<typeof espelhoSchema>;
