import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { ErroApi } from '../../api/cliente';
import { mensagemGenerica } from '../../acesso/mensagens';
import { avisarErro } from '../../lib/avisos';

/**
 * Roda uma ação do usuário: o botão fica ocupado enquanto roda (evita toque duplo),
 * o sucesso e o erro viram toast (UXM-04: resposta a ação nunca vira bloco que empurra o layout), com texto que diz o que fazer.
 * `mensagem`: texto do conflito 409 daquela tela, ou uma função que traduz o erro.
 */
export function useAcao(mensagem?: string | ((e: ErroApi) => string)) {
  const [pendente, setPendente] = useState(false);

  async function rodar(fn: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    setPendente(true);
    try {
      await fn();
      // Sem botão X: ele seria um alvo de 28 px (abaixo dos 48 px). O aviso some sozinho.
      notifications.show({ message: sucesso, color: 'teal', autoClose: 3500, withCloseButton: false });
      return true;
    } catch (e) {
      const erroApi = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      // Texto fixo = mensagem do conflito (409); função = tradução própria do módulo.
      avisarErro(typeof mensagem === 'function' ? mensagem(erroApi) : mensagemGenerica(erroApi, mensagem));
      return false;
    } finally {
      setPendente(false);
    }
  }
  return { pendente, rodar };
}

/**
 * Como `useAcao`, para os assistentes (S13): sucesso e erro viram toast (o erro não vira bloco que empurra o layout, UXM-04).
 */
export function useSalvarComToast(mensagem?: string | ((e: ErroApi) => string)) {
  const [pendente, setPendente] = useState(false);
  async function rodar(fn: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    setPendente(true);
    try {
      await fn();
      notifications.show({ message: sucesso, color: 'teal', autoClose: 3500, withCloseButton: false });
      return true;
    } catch (e) {
      const erroApi = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      const texto = typeof mensagem === 'function' ? mensagem(erroApi) : mensagemGenerica(erroApi, mensagem);
      notifications.show({ message: texto, color: 'red', autoClose: 4500, withCloseButton: false });
      return false;
    } finally {
      setPendente(false);
    }
  }
  return { pendente, rodar };
}

// O botão de fechar padrão do Modal é pequeno; alvo de toque mínimo é 48 px (RNF-05).
export const fecharModal = { size: 48, 'aria-label': 'Fechar' } as const;
