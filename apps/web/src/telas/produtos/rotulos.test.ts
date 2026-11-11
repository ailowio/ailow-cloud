import { describe, expect, it } from 'vitest';
import { ErroApi } from '../../api/cliente';
import {
  dataHoraCurta,
  linhaDoAlerta,
  mensagemProdutos,
  resumoDeRestantes,
  rotuloMovimento,
  rotuloPorte,
  sinalDaQuantidade,
  tituloDoAlerta,
} from './rotulos';

describe('textos de Produtos', () => {
  it('porte em português', () => {
    expect(rotuloPorte('slim')).toBe('Slim');
    expect(rotuloPorte('plus')).toBe('Plus');
  });

  it('tipos de movimento em português, sem jargão', () => {
    expect(rotuloMovimento('inicial')).toBe('Estoque inicial');
    expect(rotuloMovimento('entrada')).toBe('Entrada de mercadoria');
    expect(rotuloMovimento('ajuste')).toBe('Ajuste');
    expect(rotuloMovimento('venda')).toBe('Venda');
    expect(rotuloMovimento('estorno_venda')).toBe('Venda estornada');
  });

  it('quantidade com sinal visível (− de verdade, não hífen)', () => {
    expect(sinalDaQuantidade(3)).toBe('+3');
    expect(sinalDaQuantidade(-3)).toBe('−3');
  });

  describe('aviso de estoque baixo na tela inicial (RF-PRO-05)', () => {
    it('título no singular e no plural', () => {
      expect(tituloDoAlerta(1)).toBe('1 item abaixo do mínimo');
      expect(tituloDoAlerta(3)).toBe('3 itens abaixo do mínimo');
    });

    it('cada linha diz qual peça é e quanto falta, com o nome inteiro', () => {
      const nomeLongo = 'Sutiã Tomara que Caia Essência Plus Size com Bojo Removível';
      expect(linhaDoAlerta({ produto: nomeLongo, tamanho: '46', cor: 'Chocolate', estoque: 1, estoque_minimo: 3 })).toBe(
        `${nomeLongo} · 46 · Chocolate: tem 1, mínimo 3`,
      );
    });

    it('mostra os 3 primeiros e diz quantos faltam', () => {
      expect(resumoDeRestantes(10, 3)).toBe('e mais 7');
      expect(resumoDeRestantes(3, 3)).toBeNull();
      expect(resumoDeRestantes(2, 3)).toBeNull();
    });
  });

  describe('data e hora do histórico', () => {
    it('no horário de São Paulo, dia/mês hora:minuto', () => {
      expect(dataHoraCurta('2026-11-12T15:00:00.000Z')).toBe('12/11 12:00');
      // 01:30 UTC ainda é 22:30 do dia anterior em São Paulo.
      expect(dataHoraCurta('2026-11-12T01:30:00.000Z')).toBe('11/11 22:30');
    });
  });

  describe('mensagens de erro', () => {
    it('estoque insuficiente explica que o saldo não fica negativo (RN-03)', () => {
      expect(mensagemProdutos(new ErroApi(409, 'estoque_insuficiente'))).toMatch(/negativ/i);
    });

    it('categoria desativada diz onde corrigir', () => {
      expect(mensagemProdutos(new ErroApi(400, 'categoria_invalida'))).toMatch(/Configurações/);
    });

    it('atributo que não existe mais na categoria', () => {
      expect(mensagemProdutos(new ErroApi(400, 'atributos_invalidos'))).toMatch(/atributo/i);
    });

    it('limite de produtos', () => {
      expect(mensagemProdutos(new ErroApi(409, 'limite_de_produtos'))).toMatch(/9\.999/);
    });

    it('SKU não encontrado pede para atualizar', () => {
      expect(mensagemProdutos(new ErroApi(404, 'nao_encontrado'))).toMatch(/Atualize/i);
    });

    it('o resto cai na mensagem genérica (sem conexão, erro nosso)', () => {
      expect(mensagemProdutos(new ErroApi(0, 'sem_conexao'))).toMatch(/Sem conexão/);
      expect(mensagemProdutos(new ErroApi(500, 'erro_interno'))).toMatch(/do nosso lado/);
    });
  });
});
