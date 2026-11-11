import type { ErroApi } from '../api/cliente';

// Textos para quem não é da tecnologia: dizem o que fazer, sem código de erro nem detalhe técnico.
const SEM_CONEXAO = 'Sem conexão. Verifique a internet e tente de novo.';
const ERRO_NOSSO = 'Algo deu errado do nosso lado. Tente de novo.';

export function mensagemPin(e: ErroApi): string {
  if (e.status === 423) return 'Usuário bloqueado por PIN errado. Peça ao Dono para desbloquear.';
  if (e.codigo === 'pin_invalido') {
    const n = e.tentativasRestantes;
    if (n === 1) return 'PIN errado. Resta 1 tentativa: o próximo erro bloqueia.';
    if (typeof n === 'number') return `PIN errado. Restam ${n} tentativas.`;
    return 'PIN errado.';
  }
  if (e.status === 0) return SEM_CONEXAO;
  return ERRO_NOSSO;
}

export function mensagemEntrar(e: ErroApi): string {
  // Não revela se o e-mail existe (mesma frase para e-mail inexistente e senha errada).
  if (e.codigo === 'credenciais_invalidas') return 'E-mail ou senha incorretos.';
  if (e.status === 0) return SEM_CONEXAO;
  return ERRO_NOSSO;
}

// Erros de formulário de Configurações: 400 traz a frase de validação do servidor (sem o valor enviado).
export function mensagemGenerica(e: ErroApi, conflito?: string): string {
  if (e.status === 0) return SEM_CONEXAO;
  if (e.status === 409 && conflito) return conflito;
  if (e.status === 400 && e.detalhe) return e.detalhe;
  if (e.status === 403) return 'Só o Dono pode fazer isso.';
  return ERRO_NOSSO;
}
