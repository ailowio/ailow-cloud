import { useCallback, useEffect, useId, useRef } from 'react';
import { Modal as ModalMantine, type ModalProps } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { useLocation, useNavigate, useNavigationType } from 'react-router';

// UXM-03: o botão Voltar do sistema nunca sai do app. Três peças, todas sobre o histórico do navegador:
// 1) TravaVoltar (raiz): o app guarda uma entrada "de reserva" e, se o Voltar chegar nela, volta para a frente;
// 2) useVoltar: a seta da Moldura anda um passo para trás, como o Voltar do sistema;
// 3) Modal: abrir empurra uma entrada no histórico; o Voltar fecha o modal e não muda de tela.

/** O react-router grava em history.state a posição (idx) da entrada atual; 0 = a primeira do app. */
const posicao = (): number => (window.history.state as { idx?: number } | null)?.idx ?? 0;

/**
 * Raiz do app: impede que o Voltar saia. O navegador só respeita entradas criadas depois de um gesto do usuário,
 * por isso a entrada de reserva é criada no 1º toque; se o Voltar pousar na entrada 0, avança de novo.
 */
export function TravaVoltar() {
  const navigate = useNavigate();
  const tipo = useNavigationType();
  const location = useLocation();
  const armada = useRef(false);

  useEffect(() => {
    const armar = () => {
      if (armada.current) return;
      armada.current = true;
      // `trava` marca a entrada de reserva: ela repete a tela da entrada 0, então a seta não deve "recuar" para ela.
      if (posicao() === 0) navigate(window.location.pathname + window.location.search, { state: { trava: true } });
    };
    window.addEventListener('pointerdown', armar, { once: true, capture: true });
    window.addEventListener('keydown', armar, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', armar, { capture: true });
      window.removeEventListener('keydown', armar, { capture: true });
    };
  }, [navigate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a rota (location) é o gatilho: reavalia a cada navegação
  useEffect(() => {
    if (armada.current && tipo === 'POP' && posicao() === 0) navigate(1);
  }, [location, tipo, navigate]);

  return null;
}

/** Ids dos modais abertos na entrada atual do histórico (a pilha, do mais de baixo ao mais de cima). */
const modaisDaEntrada = (): string[] =>
  (window.history.state as { usr?: { modais?: string[] } | null } | null)?.usr?.modais ?? [];

interface EstadoDaEntrada {
  trava?: boolean;
  /** Quantos passos de assistente foram empurrados acima da primeira tela dele. */
  n?: number;
}
const estadoAtual = (): EstadoDaEntrada => (window.history.state as { usr?: EstadoDaEntrada | null } | null)?.usr ?? {};

/** Estado da entrada do próximo passo de um assistente: guarda o passo, quantos passos há e se a base é a reserva. */
export const estadoDoPasso = <P extends string>(passo: P, n: number) => ({
  passo,
  n,
  ...(estadoAtual().trava ? { trava: true } : {}),
});

/**
 * Um passo para trás no histórico; sem passo anterior dentro do app (link direto, recarregar), vai para `reserva`
 * (o pai da tela). Na entrada de reserva (que repete a tela) a seta também vai ao pai, senão ela não sairia do lugar.
 */
export function useVoltar(reserva = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (posicao() > 0 && !estadoAtual().trava) navigate(-1);
    else navigate(reserva, { replace: true, state: posicao() > 0 ? { trava: true } : null });
  }, [navigate, reserva]);
}

/**
 * Sair de um assistente (cancelar ou concluir) devolve todas as entradas que ele empurrou e cai no pai; com `depois`,
 * segue para outra tela empurrando-a (o Voltar dela volta ao pai, nunca ao assistente). Sem entradas para devolver
 * (link direto), troca a tela atual pelo pai.
 */
export function useSairDoAssistente(pai: string): (depois?: string) => void {
  const navigate = useNavigate();
  return useCallback(
    (depois?: string) => {
      const { trava, n = 0 } = estadoAtual();
      const devolver = trava ? n : n + 1;
      const seguir = () => {
        if (trava) navigate(pai, { replace: true, state: { trava: true } });
        if (depois && window.location.pathname !== depois) navigate(depois);
      };
      if (devolver === 0) seguir();
      else if (posicao() >= devolver) {
        window.addEventListener('popstate', () => setTimeout(seguir, 0), { once: true });
        navigate(-devolver);
      } else navigate(depois ?? pai, { replace: true });
    },
    [navigate, pai],
  );
}

/**
 * Modal do Mantine ligado ao histórico: ao abrir, empurra uma entrada; o Voltar do sistema (ou da seta) fecha o
 * modal e mantém a tela. Fechar pelo X, pelo fundo ou pelo próprio app desfaz a entrada.
 */
export function Modal({ opened, onClose, ...resto }: ModalProps) {
  const id = useId();
  const navigate = useNavigate();
  const location = useLocation();
  // A verdade está na entrada atual do navegador (sincronizada no pushState), não no render do router: assim um
  // Voltar dado antes de o router processar a abertura também fecha o modal.
  // Modais aninhados (ex.: calendário dentro de "Adicionar ponto"): cada entrada guarda a PILHA de ids abertos,
  // e o modal de baixo continua "na entrada" enquanto o de cima está aberto.
  const naEntrada = useCallback(() => modaisDaEntrada().includes(id), [id]);
  const fase = useRef<'fora' | 'empurrando' | 'dentro'>('fora');
  const aoFechar = useRef(onClose);
  aoFechar.current = onClose;

  useEffect(() => {
    if (opened && fase.current === 'fora') {
      fase.current = 'empurrando';
      // Mantém o resto do estado da entrada (ex.: o passo do assistente de novo produto): só a pilha de modais muda.
      const resto = (window.history.state as { usr?: Record<string, unknown> | null } | null)?.usr ?? {};
      navigate(location.pathname + location.search, { state: { ...resto, modais: [...modaisDaEntrada(), id] } });
    } else if (!opened && fase.current !== 'fora') {
      if (fase.current === 'dentro') navigate(-1);
      fase.current = 'fora';
    }
  }, [opened, navigate, id, location.pathname, location.search]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a rota (location) é o gatilho: reavalia a cada navegação
  useEffect(() => {
    if (fase.current === 'fora') return;
    if (naEntrada()) fase.current = 'dentro';
    else {
      fase.current = 'fora';
      aoFechar.current();
    }
  }, [location]);

  // Desmontado pelo pai com o modal aberto: devolve a entrada do histórico.
  // `navigate` troca de identidade a cada rota: a ref evita que o efeito de saída rode fora da hora.
  const navegar = useRef(navigate);
  navegar.current = navigate;
  // A devolução espera um microtask: o StrictMode (dev) desmonta e remonta o componente no mesmo instante, e
  // devolver a entrada ali fechava na hora todo modal que já nasce aberto (ex.: "Adicionar ponto").
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      queueMicrotask(() => {
        if (!montado.current && fase.current === 'dentro' && naEntrada()) navegar.current(-1);
      });
    };
  }, [naEntrada]);

  // Formato de pop-up de celular (S05/UXM-10): centrado, 16 px de margem lateral, entrada com escala + fade de 180 ms
  // (sem animação com prefers-reduced-motion), fundo escurecido, X de 48 px. Altura máxima e rolagem do corpo: tema.css.
  const semMovimento = useReducedMotion();
  return (
    <ModalMantine
      centered
      xOffset={16}
      className="ailow-popup"
      overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
      transitionProps={{ transition: 'pop', duration: semMovimento ? 0 : 180 }}
      closeButtonProps={{ size: 48 }}
      opened={opened}
      onClose={() => (naEntrada() ? navigate(-1) : onClose())}
      {...resto}
    />
  );
}
