import { useEffect, useState } from 'react';
import marcaSvg from '../../public/logo.svg?raw';
import { extrairPathsMarca } from '../marca/extrair-path';
import './transicao.css';

/**
 * UXM-07. Animação portada do Remotion `LogoA` (vídeo do projeto final):
 * desenha o contorno (~700 ms) e preenche (~300 ms a partir de 450 ms).
 * Duração total do overlay = keyframe 1000 ms + folga.
 */
const DURACAO_MS = 1050;
const DURACAO_REDUZIDA_MS = 200;
/** ViewBox ampliado como no Remotion, para o stroke não cortar. */
const VIEWBOX_TRANSICAO = '-1389 -980 12600 12600';
const { paths } = extrairPathsMarca(marcaSvg);

function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Transição de tela cheia com a marca oficial Ailow (5 paths do brand/logo-ailow.svg)
 * ao entrar, sair ou trocar de usuário. `disparo` incrementa a cada troca; 0 = nunca.
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
      <svg className="ailow-transicao__marca" viewBox={VIEWBOX_TRANSICAO} role="img" aria-label="Ailow" focusable="false">
        {paths.map((d) => (
          <path key={d.slice(0, 24)} pathLength={1} d={d} />
        ))}
      </svg>
    </div>
  );
}
