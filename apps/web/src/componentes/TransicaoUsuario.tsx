import { useEffect, useState } from 'react';
import marcaSvg from '../../public/logo.svg?raw';
import { extrairPathMarca } from '../marca/extrair-path';
import './transicao.css';

/** UXM-07. Mesma duração do keyframe em transicao.css (800 ms) + folga; no movimento reduzido o fade dura 180 ms. */
const DURACAO_MS = 820;
const DURACAO_REDUZIDA_MS = 200;
const { viewBox, d } = extrairPathMarca(marcaSvg);

function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transição de tela cheia com a marca (traço + preenchimento em CSS puro) ao entrar, sair ou trocar de usuário.
 * `disparo` é um contador: cada incremento reinicia a transição; 0 = nunca disparou. Some sozinha e nunca captura toque.
 * Desenho vem de public/logo.svg (única fonte).
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
      <svg className="ailow-transicao__marca" viewBox={viewBox} role="img" aria-label="Ailow" focusable="false">
        <path pathLength={1} fillRule="evenodd" d={d} />
      </svg>
    </div>
  );
}
