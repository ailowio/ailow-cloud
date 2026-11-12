import { describe, expect, it } from 'vitest';
import { ErroApi } from '../../api/cliente';
import { dataDoDia, linhaDoAviso, mensagemClientes } from './rotulos';

describe('textos de Clientes', () => {
  it('data no fuso do negócio: 02:30 UTC ainda é o dia anterior em São Paulo', () => {
    expect(dataDoDia('2026-11-11T02:30:00.000Z')).toBe('10/11/2026');
    expect(dataDoDia('2026-11-11T12:00:00.000Z')).toBe('11/11/2026');
  });

  it('o aviso mostra a data ou diz que ainda não foi dado', () => {
    expect(linhaDoAviso('2026-11-11T12:00:00.000Z')).toBe('Avisado da finalidade em 11/11/2026');
    expect(linhaDoAviso(null)).toBe('Ainda não avisado da finalidade do celular');
  });

  it('celular repetido diz o que fazer, sem código de erro', () => {
    const m = mensagemClientes(new ErroApi(409, 'celular_ja_cadastrado'));
    expect(m).toBe('Já existe um cliente com este celular. Busque pelo número; se não aparecer, ele pode estar inativo: peça ao Dono.');
  });

  it('inativar quem já está inativo (ou reativar quem está ativo) pede para atualizar a tela', () => {
    expect(mensagemClientes(new ErroApi(409, 'cliente_ja_inativo'))).toBe('Este cliente já está inativo. Atualize a tela.');
    expect(mensagemClientes(new ErroApi(409, 'cliente_ja_ativo'))).toBe('Este cliente já está ativo. Atualize a tela.');
  });

  it('cliente que sumiu (excluído ou de outra loja) pede para atualizar a tela', () => {
    expect(mensagemClientes(new ErroApi(404, 'nao_encontrado'))).toBe('Não encontramos este cliente. Atualize a tela.');
  });

  it('o Vendedor que tenta inativar ou excluir recebe a explicação', () => {
    expect(mensagemClientes(new ErroApi(403, 'sem_permissao'))).toBe('Só o Dono pode inativar, reativar ou excluir um cliente.');
  });

  it('sem internet e erro nosso caem nas frases gerais', () => {
    expect(mensagemClientes(new ErroApi(0, 'sem_conexao'))).toMatch(/Sem conexão/);
    expect(mensagemClientes(new ErroApi(500, 'erro_interno'))).toMatch(/do nosso lado/);
  });

  it('validação do servidor aparece como veio (sem eco do valor)', () => {
    expect(mensagemClientes(new ErroApi(400, 'requisicao_invalida', 'celular: celular com DDD e 9 dígitos'))).toBe(
      'celular: celular com DDD e 9 dígitos',
    );
  });
});
