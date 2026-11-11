import { useEffect, useRef } from 'react';
import { criarTravaInatividade } from './inatividade';

const EVENTOS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/** Liga a trava por inatividade (RF-ACE-04) ao uso real do app: toque, tecla, rolagem e volta à aba. */
export function useTravaInatividade(minutos: number, aoTravar: () => void, aoManterVivo: () => void) {
  const travar = useRef(aoTravar);
  const manter = useRef(aoManterVivo);
  travar.current = aoTravar;
  manter.current = aoManterVivo;

  useEffect(() => {
    const trava = criarTravaInatividade({
      minutos,
      aoTravar: () => travar.current(),
      aoManterVivo: () => manter.current(),
    });
    const atividade = () => trava.atividade();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') trava.verificar();
    };
    for (const e of EVENTOS) window.addEventListener(e, atividade, { passive: true, capture: true });
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      trava.parar();
      for (const e of EVENTOS) window.removeEventListener(e, atividade, { capture: true });
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [minutos]);
}
