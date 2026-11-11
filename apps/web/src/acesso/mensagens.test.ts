import { describe, expect, it } from 'vitest';
import { ErroApi } from '../api/cliente';
import { mensagemEntrar, mensagemPin } from './mensagens';

describe('mensagens do PIN (RF-ACE-05)', () => {
  it('PIN errado informa quantas tentativas restam', () => {
    const e = new ErroApi(401, 'pin_invalido', undefined, 3);
    expect(mensagemPin(e)).toBe('PIN errado. Restam 3 tentativas.');
  });

  it('com 1 tentativa, avisa que a próxima bloqueia', () => {
    const e = new ErroApi(401, 'pin_invalido', undefined, 1);
    expect(mensagemPin(e)).toBe('PIN errado. Resta 1 tentativa: o próximo erro bloqueia.');
  });

  it('usuário bloqueado (423) manda procurar o Dono', () => {
    expect(mensagemPin(new ErroApi(423, 'usuario_bloqueado'))).toBe(
      'Usuário bloqueado por PIN errado. Peça ao Dono para desbloquear.',
    );
  });

  it('sem conexão e erro do servidor têm texto próprio, sem detalhe técnico', () => {
    expect(mensagemPin(new ErroApi(0, 'sem_conexao'))).toBe('Sem conexão. Verifique a internet e tente de novo.');
    expect(mensagemPin(new ErroApi(500, 'erro_interno'))).toBe('Algo deu errado do nosso lado. Tente de novo.');
  });
});

describe('mensagens de entrar', () => {
  it('credenciais erradas não dizem se o e-mail existe', () => {
    expect(mensagemEntrar(new ErroApi(401, 'credenciais_invalidas'))).toBe('E-mail ou senha incorretos.');
  });

  it('sem conexão', () => {
    expect(mensagemEntrar(new ErroApi(0, 'sem_conexao'))).toBe('Sem conexão. Verifique a internet e tente de novo.');
  });
});
