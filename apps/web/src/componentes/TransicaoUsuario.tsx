import { useEffect, useState } from 'react';
import './transicao.css';

/** UXM-07. Mesma duração do keyframe em transicao.css (800 ms) + folga; no movimento reduzido o fade dura 180 ms. */
const DURACAO_MS = 820;
const DURACAO_REDUZIDA_MS = 200;

function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transição de tela cheia com a marca (traço + preenchimento em CSS puro) ao entrar, sair ou trocar de usuário.
 * `disparo` é um contador: cada incremento reinicia a transição; 0 = nunca disparou. Some sozinha e nunca captura toque.
 * O path é o mesmo de public/logo.svg.
 */
export function TransicaoUsuario({ disparo }: { disparo: number }) {
  const [visivel, setVisivel] = useState(0);

  useEffect(() => {
    if (disparo === 0) return;
    setVisivel(disparo);
    const t = setTimeout(() => setVisivel(0), movimentoReduzido() ? DURACAO_REDUZIDA_MS : DURACAO_MS);
    return () => clearTimeout(t);
  }, [disparo]);

  if (visivel === 0) return null;
  return (
    <div key={visivel} className="ailow-transicao" data-testid="transicao-usuario" aria-hidden="true">
      <svg className="ailow-transicao__marca" viewBox="0 0 378 378" role="img" aria-label="Ailow" focusable="false">
        <path
          pathLength={1}
          fillRule="evenodd"
          d="M189 42L318 336H268L243 278H135L110 336H60ZM154 234H224L189 152ZM78 168H168A22 22 0 1 1 168 212H78A22 22 0 0 1 78 168ZM78 112H138A18 18 0 1 1 138 148H78A18 18 0 0 1 78 112Z"
        />
      </svg>
    </div>
  );
}
