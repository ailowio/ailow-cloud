import { FORMAS_PAGAMENTO, SITUACOES_CONTA, TIPOS_CATEGORIA } from '@ailow/shared';
import { describe, expect, it } from 'vitest';
import { ErroApi } from '../../api/cliente';
import {
  FORMAS,
  SITUACOES,
  TIPOS_DE_CATEGORIA,
  mensagemFinanceiro,
  pagamentosDaVenda,
  rotuloForma,
  rotuloSituacao,
  rotuloTipoCategoria,
  tituloLancamento,
} from './rotulos';

describe('textos do Financeiro (para quem não é da tecnologia)', () => {
  it('toda forma de pagamento tem rótulo em português, com acento, e nenhum é o código cru', () => {
    expect(FORMAS_PAGAMENTO.map(rotuloForma)).toEqual(['Dinheiro', 'Pix', 'Débito', 'Crédito']);
  });

  describe('pagamentos de uma venda no extrato (estornar a venda inteira)', () => {
    const l = (id: string, origem_id: string | null, status: 'pago' | 'estornado' = 'pago', origem_tipo = 'venda') =>
      ({ id, origem_id, status, origem_tipo, valor_centavos: 100 }) as never;

    it('junta os pagamentos da mesma venda que ainda podem ser estornados, e só eles', () => {
      const lista = [l('1', 'v1'), l('2', 'v1'), l('3', 'v2'), l('4', 'v1', 'estornado'), l('5', 'v1', 'pago', 'estorno')];
      expect(pagamentosDaVenda(lista, 'v1').map((x) => x.id)).toEqual(['1', '2']);
    });

    it('sem pagamentos da venda na lista, devolve vazio', () => {
      expect(pagamentosDaVenda([l('1', 'v1')], 'v9')).toEqual([]);
    });
  });

  it('os dois tipos de categoria têm nome em português, no plural, para as abas', () => {
    expect(TIPOS_CATEGORIA.map(rotuloTipoCategoria)).toEqual(['Produtos', 'Financeiras']);
    expect([...TIPOS_DE_CATEGORIA]).toEqual([...TIPOS_CATEGORIA]);
  });

  it('a lista de formas do seletor segue a ordem do contrato', () => {
    expect([...FORMAS]).toEqual([...FORMAS_PAGAMENTO]);
  });

  describe('título de um lançamento na lista', () => {
    const base = { descricao: null, origem_tipo: 'venda' as const };
    it('usa a descrição quando existe', () => {
      expect(tituloLancamento({ ...base, descricao: 'Condomínio', origem_tipo: 'despesa' })).toBe('Condomínio');
    });
    it.each([
      ['venda', 'Venda'],
      ['compra', 'Compra'],
      ['despesa', 'Despesa'],
      ['estorno', 'Estorno'],
    ] as const)('sem descrição, %s vira "%s"', (origem_tipo, titulo) => {
      expect(tituloLancamento({ ...base, origem_tipo })).toBe(titulo);
    });
  });

  it('toda situação de conta tem rótulo, e a lista local segue a ordem do contrato (vencidas primeiro)', () => {
    expect(SITUACOES_CONTA.map(rotuloSituacao)).toEqual(['Vencidas', 'Vencem hoje', 'Próximos 7 dias', 'Depois']);
    expect([...SITUACOES]).toEqual([...SITUACOES_CONTA]);
  });

  describe('mensagens de erro', () => {
    const msg = (status: number, codigo: string, detalhe?: string) => mensagemFinanceiro(new ErroApi(status, codigo, detalhe));

    it.each([
      ['ja_pago', 'Esta conta já foi paga.'],
      ['ja_estornado', 'Este lançamento já foi estornado.'],
      ['e_estorno', 'Um estorno não pode ser estornado.'],
      ['lancamento_estornado', 'Esta conta foi cancelada e não pode ser paga.'],
    ])('conflito %s diz o que aconteceu', (codigo, texto) => {
      expect(msg(409, codigo)).toBe(texto);
    });

    it('categoria que não vale para despesa diz o que fazer, sem código técnico', () => {
      expect(msg(400, 'categoria_invalida')).toBe(
        'Essa categoria não existe ou está desativada. Escolha outra, ou cadastre em Configurações › Categorias.',
      );
    });

    it('404 diz que o lançamento não existe mais', () => {
      expect(msg(404, 'nao_encontrado')).toBe('Não encontramos este lançamento. Atualize a tela.');
    });

    it('sem internet pede para verificar a conexão', () => {
      expect(msg(0, 'sem_conexao')).toBe('Sem conexão. Verifique a internet e tente de novo.');
    });

    it('validação do servidor (400) mostra a frase do servidor', () => {
      expect(msg(400, 'requisicao_invalida', 'descricao: informe a descrição')).toBe('descricao: informe a descrição');
    });

    it('erro desconhecido não vaza código técnico', () => {
      const texto = msg(500, 'erro_interno');
      expect(texto).toBe('Algo deu errado do nosso lado. Tente de novo.');
      expect(texto).not.toMatch(/erro_interno/);
    });
  });
});
