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
      if (posicao() === 0) navigate(window.location.pathname + window.location.search);
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

/** Um passo para trás no histórico; sem passo anterior dentro do app, vai para `reserva`. */
export function useVoltar(reserva = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    if (posicao() > 0) navigate(-1);
    else navigate(reserva, { replace: true });
  }, [navigate, reserva]);
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
