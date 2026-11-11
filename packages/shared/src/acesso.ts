import { z } from 'zod';

// Contrato do módulo de acesso (S04). A API gera o OpenAPI a partir destes schemas.

export const perfilSchema = z.enum(['dono', 'vendedor']);
export type Perfil = z.infer<typeof perfilSchema>;

// PIN de 4 dígitos (RF-ACE-03). Sempre string: "0042" não pode virar número.
export const pinSchema = z.string().regex(/^\d{4}$/, { error: 'o PIN deve ter exatamente 4 dígitos' });

// Senha: tamanho mínimo/máximo; o máximo evita DoS de hashing com entrada gigante.
export const senhaSchema = z
  .string()
  .min(10, { error: 'a senha deve ter ao menos 10 caracteres' })
  .max(128, { error: 'a senha deve ter no máximo 128 caracteres' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: 'e-mail inválido' }));

export const nomeSchema = z.string().trim().min(1, { error: 'informe o nome' }).max(120);

export const usuarioPublicoSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  perfil: perfilSchema,
});
export type UsuarioPublico = z.infer<typeof usuarioPublicoSchema>;

export const erroSchema = z.object({
  erro: z.string(),
  mensagem: z.string().optional(),
  tentativas_restantes: z.number().int().min(0).optional(),
});
export type Erro = z.infer<typeof erroSchema>;

export const entrarBodySchema = z.object({ email: emailSchema, senha: z.string().min(1).max(128) });
export const entrarResponseSchema = z.object({
  usuario: usuarioPublicoSchema,
  precisa_definir_pin: z.boolean(),
});

export const quemUsaItemSchema = usuarioPublicoSchema.extend({ bloqueado: z.boolean() });
export const quemUsaResponseSchema = z.object({ usuarios: z.array(quemUsaItemSchema) });

export const pinBodySchema = z.object({ usuario_id: z.uuid(), pin: pinSchema });
export const sessaoResponseSchema = z.object({ usuario: usuarioPublicoSchema });

export const definirMeuPinBodySchema = z.object({ senha: z.string().min(1).max(128), pin: pinSchema });

export const criarVendedorBodySchema = z.object({ nome: nomeSchema, pin: pinSchema });
export const definirPinBodySchema = z.object({ pin: pinSchema });
export const usuarioAdminItemSchema = usuarioPublicoSchema.extend({
  ativo: z.boolean(),
  bloqueado: z.boolean(),
});
export const usuariosResponseSchema = z.object({ usuarios: z.array(usuarioAdminItemSchema) });

export const usuarioIdParamsSchema = z.object({ id: z.uuid() });

// --- Administração da plataforma (Admin) ---
export const totpCodigoSchema = z.string().regex(/^\d{6}$/, { error: 'o código TOTP tem 6 dígitos' });
export const adminLoginBodySchema = z.object({
  email: emailSchema,
  senha: z.string().min(1).max(128),
  codigo: totpCodigoSchema,
});
export const criarEmpresaBodySchema = z.object({
  nome: nomeSchema,
  dono: z.object({ nome: nomeSchema, email: emailSchema, senha: senhaSchema }),
});
export const criarEmpresaResponseSchema = z.object({ empresa_id: z.uuid(), dono_id: z.uuid() });
export const redefinirSenhaBodySchema = z.object({ senha: senhaSchema });
export const empresaIdParamsSchema = z.object({ empresaId: z.uuid() });
