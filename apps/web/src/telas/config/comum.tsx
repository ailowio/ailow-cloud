import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { ErroApi } from '../../api/cliente';
import { mensagemGenerica } from '../../acesso/mensagens';

/**
 * Roda uma ação do usuário: o botão fica ocupado enquanto roda (evita toque duplo),
 * o sucesso vira um aviso curto e o erro aparece na própria tela, com texto que diz o que fazer.
 */
export function useAcao(conflito?: string) {
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function rodar(fn: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    setPendente(true);
    setErro(null);
    try {
      await fn();
      // Sem botão X: ele seria um alvo de 28 px (abaixo dos 48 px). O aviso some sozinho.
      notifications.show({ message: sucesso, color: 'teal', autoClose: 3500, withCloseButton: false });
      return true;
    } catch (e) {
      setErro(mensagemGenerica(e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno'), conflito));
      return false;
    } finally {
      setPendente(false);
    }
  }
  return { pendente, erro, limparErro: () => setErro(null), rodar };
}

// O botão de fechar padrão do Modal é pequeno; alvo de toque mínimo é 48 px (RNF-05).
export const fecharModal = { size: 48, 'aria-label': 'Fechar' } as const;
