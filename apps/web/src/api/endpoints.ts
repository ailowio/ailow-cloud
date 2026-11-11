import type {
  Categoria,
  Empresa,
  UsuarioPublico,
} from '@ailow/shared';
import type { Cliente } from './cliente';

// Tipos vêm do pacote compartilhado (só tipos: nada de Zod no bundle do navegador).
export type QuemUsaItem = UsuarioPublico & { bloqueado: boolean };
export type UsuarioAdminItem = QuemUsaItem & { ativo: boolean };
export type CategoriaCorpo = Pick<Categoria, 'nome' | 'atributos'>;
export type CategoriaAlterar = CategoriaCorpo & Pick<Categoria, 'ativa'>;

export function criarApi(c: Cliente) {
  const p = c.pedir;
  return {
    // --- acesso (S04)
    entrar: (email: string, senha: string) =>
      p<{ usuario: UsuarioPublico; precisa_definir_pin: boolean }>('POST', '/acesso/entrar', { email, senha }),
    quemUsa: () => p<{ usuarios: QuemUsaItem[] }>('GET', '/acesso/usuarios'),
    pin: (usuarioId: string, pin: string) =>
      p<{ usuario: UsuarioPublico }>('POST', '/acesso/pin', { usuario_id: usuarioId, pin }),
    eu: () => p<{ usuario: UsuarioPublico; inatividade_minutos: number }>('GET', '/acesso/eu'),
    sair: () => p('POST', '/acesso/sair'),
    definirMeuPin: (senha: string, pin: string) => p('PUT', '/acesso/meu-pin', { senha, pin }),
    // --- usuários (RF-CFG-01)
    usuarios: () => p<{ usuarios: UsuarioAdminItem[] }>('GET', '/usuarios'),
    criarVendedor: (nome: string, pin: string) => p<{ id: string }>('POST', '/usuarios', { nome, pin }),
    redefinirPin: (id: string, pin: string) => p('PUT', `/usuarios/${id}/pin`, { pin }),
    desbloquear: (id: string) => p('POST', `/usuarios/${id}/desbloquear`),
    derrubarSessoes: (id: string) => p('POST', `/usuarios/${id}/derrubar-sessoes`),
    desativar: (id: string) => p('POST', `/usuarios/${id}/desativar`),
    // --- empresa + markup (RF-CFG-02/03)
    empresa: () => p<Empresa>('GET', '/empresa'),
    salvarEmpresa: (e: Empresa) => p<Empresa>('PUT', '/empresa', e),
    // --- categorias (RF-CFG-04)
    categorias: () => p<{ categorias: Categoria[] }>('GET', '/categorias'),
    criarCategoria: (c: CategoriaCorpo) => p<{ id: string }>('POST', '/categorias', c),
    alterarCategoria: (id: string, c: CategoriaAlterar) => p('PUT', `/categorias/${id}`, c),
  };
}

export type Api = ReturnType<typeof criarApi>;
