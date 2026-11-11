import type {
  Categoria,
  ContaAPagar,
  DespesaEntrada,
  Empresa,
  FormaPagamento,
  Lancamento,
  Relatorio,
  TipoCategoria,
  UsuarioPublico,
} from '@ailow/shared';
import type { Cliente } from './cliente';

// Tipos vêm do pacote compartilhado (só tipos: nada de Zod no bundle do navegador).
export type QuemUsaItem = UsuarioPublico & { bloqueado: boolean };
export type UsuarioAdminItem = QuemUsaItem & { ativo: boolean };
// O tipo só vale na criação (a API não deixa trocá-lo depois); sem tipo, é categoria de produto.
export type CategoriaCorpo = Pick<Categoria, 'nome' | 'atributos'> & { tipo?: TipoCategoria };
export type CategoriaAlterar = Pick<Categoria, 'nome' | 'atributos' | 'ativa'>;

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
    // --- empresa + markup + logo (RF-CFG-02/03)
    empresa: () => p<Empresa>('GET', '/empresa'),
    salvarEmpresa: (e: Omit<Empresa, 'tem_logo'>) => p<Empresa>('PUT', '/empresa', e),
    enviarLogo: (arquivo: File) => c.enviarArquivo<Empresa>('/empresa/logo', arquivo),
    removerLogo: () => p<Empresa>('DELETE', '/empresa/logo'),
    // --- categorias (RF-CFG-04)
    categorias: (tipo?: TipoCategoria) =>
      p<{ categorias: Categoria[] }>('GET', tipo ? `/categorias?tipo=${tipo}` : '/categorias'),
    criarCategoria: (c: CategoriaCorpo) => p<{ id: string }>('POST', '/categorias', c),
    alterarCategoria: (id: string, c: CategoriaAlterar) => p('PUT', `/categorias/${id}`, c),
    // --- financeiro (S06, só Dono)
    novaDespesa: (d: DespesaEntrada) => p<{ id: string }>('POST', '/financeiro/despesas', d),
    contasAPagar: () => p<{ hoje: string; contas: ContaAPagar[] }>('GET', '/financeiro/contas-a-pagar'),
    pagar: (id: string, forma: FormaPagamento) =>
      p('POST', `/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: forma }),
    estornar: (id: string, motivo: string) => p<{ id: string }>('POST', `/financeiro/lancamentos/${id}/estornar`, { motivo }),
    // Estorna a venda inteira (todos os pagamentos dela de uma vez, RN-08); `origemId` é o id da venda.
    estornarVenda: (origemId: string, motivo: string) =>
      p<{ ids: string[] }>('POST', `/financeiro/vendas/${origemId}/estornar`, { motivo }),
    extrato: (data: string) => p<{ data: string; lancamentos: Lancamento[] }>('GET', `/financeiro/extrato?data=${data}`),
    relatorio: (periodo: 'dia' | 'mes', data: string) =>
      p<Relatorio>('GET', `/financeiro/relatorio?periodo=${periodo}&data=${data}`),
  };
}

export type Api = ReturnType<typeof criarApi>;
