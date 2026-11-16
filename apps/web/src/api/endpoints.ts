import type {
  AjusteEditar,
  AjusteEstoque,
  AjusteExcluir,
  AjusteNovo,
  AlertaEstoque,
  Categoria,
  Cliente as ClienteFicha,
  ContaAPagar,
  DespesaEntrada,
  Empresa,
  Espelho,
  EtiquetasPedido,
  FormaPagamento,
  Fornecedor,
  FornecedorNovo,
  Lancamento,
  Marca,
  Movimento,
  Pedido,
  PedidoEnviado,
  PedidoNovo,
  PedidoReceber,
  PontoBatido,
  PontoEstado,
  Produto,
  ProdutoEditar,
  ProdutoNovo,
  Relatorio,
  RelatorioCompras,
  RelatorioVendas,
  SkuParaVenda,
  StatusPedido,
  TipoCategoria,
  UsuarioPublico,
  Venda,
  VendaFinalizar,
  VendaResumo,
} from '@ailow/shared';
import type { Cliente } from './cliente';

// Tipos vêm do pacote compartilhado (só tipos: nada de Zod no bundle do navegador).
export type QuemUsaItem = UsuarioPublico & { bloqueado: boolean };
export type UsuarioAdminItem = QuemUsaItem & { ativo: boolean };
// O tipo só vale na criação (a API não deixa trocá-lo depois); sem tipo, é categoria de produto.
export type CategoriaCorpo = Pick<Categoria, 'nome' | 'atributos'> & { tipo?: TipoCategoria };
export type CategoriaAlterar = Pick<Categoria, 'nome' | 'atributos' | 'ativa'>;
// O celular segue como a pessoa digitou (máscara, +55); a API devolve só os dígitos.
export interface ClienteCorpo {
  nome: string;
  celular: string;
  aviso_lgpd: boolean;
}

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
    // --- produtos e estoque (S07). Listar é do Dono e do Vendedor (sem custo); o resto é só do Dono.
    produtos: (q?: string) => {
      const busca = q?.trim() ?? '';
      return p<{ produtos: Produto[]; truncado: boolean }>('GET', busca === '' ? '/produtos' : `/produtos?q=${encodeURIComponent(busca)}`);
    },
    criarProduto: (n: ProdutoNovo) =>
      p<{ id: string; numero: number; skus: { id: string; codigo: string }[] }>('POST', '/produtos', n),
    editarProduto: (id: string, e: ProdutoEditar) => p<{ id: string }>('PUT', `/produtos/${id}`, e),
    arquivarProduto: (id: string) => p<{ id: string }>('POST', `/produtos/${id}/arquivar`),
    ajustarEstoque: (skuId: string, a: AjusteEstoque) => p<{ estoque: number }>('POST', `/skus/${skuId}/estoque`, a),
    movimentos: (skuId: string) => p<{ movimentos: Movimento[] }>('GET', `/skus/${skuId}/movimentos`),
    alertasEstoque: () => p<{ total: number; itens: AlertaEstoque[] }>('GET', '/estoque/alertas'),
    // --- etiquetas (S08, só Dono): o PDF volta como Blob.
    etiquetasPdf: (itens: EtiquetasPedido['itens']) => c.baixar('/etiquetas', { itens }),
    // --- clientes (S09/S09b). Dono e Vendedor cadastram, editam, buscam e registram o aviso; só o Dono inativa/reativa/exclui.
    clientes: (q?: string, situacao: 'ativos' | 'inativos' = 'ativos') => {
      // A API assume "ativos"; só os inativos (aba do Dono) levam a situação na URL.
      const partes = [q?.trim() ? `q=${encodeURIComponent(q.trim())}` : '', situacao === 'inativos' ? 'situacao=inativos' : ''].filter(Boolean);
      return p<{ clientes: ClienteFicha[]; truncado: boolean }>('GET', `/clientes${partes.length ? `?${partes.join('&')}` : ''}`);
    },
    criarCliente: (n: ClienteCorpo) => p<{ id: string }>('POST', '/clientes', n),
    cliente: (id: string) => p<ClienteFicha>('GET', `/clientes/${id}`),
    editarCliente: (id: string, d: Pick<ClienteCorpo, 'nome' | 'celular'>) => p<ClienteFicha>('PUT', `/clientes/${id}`, d),
    avisarCliente: (id: string) => p<ClienteFicha>('POST', `/clientes/${id}/aviso-lgpd`),
    inativarCliente: (id: string) => p<ClienteFicha>('POST', `/clientes/${id}/inativar`),
    reativarCliente: (id: string) => p<ClienteFicha>('POST', `/clientes/${id}/reativar`),
    excluirCliente: (id: string) => p('DELETE', `/clientes/${id}`),
    // --- vendas (S10). Dono e Vendedor; o relatório do mês é só do Dono.
    skuPorCodigo: (codigo: string) => p<SkuParaVenda>('GET', `/skus/por-codigo?codigo=${encodeURIComponent(codigo)}`),
    finalizarVenda: (corpo: VendaFinalizar) => p<Venda>('POST', '/vendas', corpo),
    venda: (id: string) => p<Venda>('GET', `/vendas/${id}`),
    cancelarVenda: (id: string, motivo: string) => p<Venda>('POST', `/vendas/${id}/cancelar`, { motivo }),
    relatorioVendas: (periodo: 'dia' | 'mes', data: string) =>
      p<RelatorioVendas>('GET', `/vendas/relatorio?periodo=${periodo}&data=${data}`),
    listaVendas: (periodo: 'dia' | 'mes', data: string) =>
      p<{ vendas: VendaResumo[] }>('GET', `/vendas/lista?periodo=${periodo}&data=${data}`),
    comprasDoCliente: (id: string) =>
      p<{ compras: { id: string; numero: number; total_centavos: number; status: Venda['status']; criado_em: string }[] }>(
        'GET',
        `/vendas/por-cliente/${id}`,
      ),
    // --- compras (S11, só Dono)
    fornecedores: (q?: string) => {
      const busca = q?.trim() ?? '';
      return p<{ fornecedores: Fornecedor[]; truncado: boolean }>(
        'GET',
        busca === '' ? '/fornecedores' : `/fornecedores?q=${encodeURIComponent(busca)}`,
      );
    },
    criarFornecedor: (n: FornecedorNovo) => p<{ id: string }>('POST', '/fornecedores', n),
    fornecedor: (id: string) => p<Fornecedor>('GET', `/fornecedores/${id}`),
    editarFornecedor: (id: string, n: FornecedorNovo) => p<Fornecedor>('PUT', `/fornecedores/${id}`, n),
    pedidosCompra: (status?: StatusPedido) =>
      p<{
        pedidos: {
          id: string;
          numero: number;
          status: StatusPedido;
          total_centavos: number;
          fornecedor_nome: string;
          criado_em: string;
          enviado_em: string | null;
          recebido_em: string | null;
        }[];
      }>('GET', status ? `/compras?status=${status}` : '/compras'),
    criarPedidoCompra: (corpo: PedidoNovo) => p<Pedido>('POST', '/compras', corpo),
    pedidoCompra: (id: string) => p<Pedido>('GET', `/compras/${id}`),
    editarPedidoCompra: (id: string, corpo: PedidoNovo) => p<Pedido>('PUT', `/compras/${id}`, corpo),
    enviarPedidoCompra: (id: string) => p<PedidoEnviado>('POST', `/compras/${id}/enviar`),
    receberPedidoCompra: (id: string, corpo: PedidoReceber) => p<Pedido>('POST', `/compras/${id}/receber`, corpo),
    relatorioCompras: (data: string) => p<RelatorioCompras>('GET', `/compras/relatorio?periodo=mes&data=${data}`),
    // --- pessoas / ponto (S12): a hora é do servidor, o corpo da batida é vazio
    estadoDoPonto: () => p<PontoEstado>('GET', '/pontos/estado'),
    baterPonto: () => p<PontoBatido>('POST', '/pontos'),
    // Ajustes do Dono (RF-PES-03): dia + HH:MM de São Paulo e motivo; o servidor converte e valida a sequência.
    adicionarPonto: (n: AjusteNovo) => p<Marca>('POST', '/pontos/manual', n),
    editarPonto: (id: string, e: AjusteEditar) => p<Marca>('PUT', `/pontos/${id}`, e),
    excluirPonto: (id: string, e: AjusteExcluir) => p('POST', `/pontos/${id}/excluir`, e),
    espelhoDePonto: (mes: string, usuarioId?: string) => {
      const filtro = usuarioId ? `&usuario_id=${usuarioId}` : '';
      return p<Espelho>('GET', `/pontos/espelho?mes=${mes}${filtro}`);
    },
  };
}

export type Api = ReturnType<typeof criarApi>;
