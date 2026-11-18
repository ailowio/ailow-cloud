import { useEffect, useState } from 'react';
import marcaSvg from '../../public/logo.svg?raw';
import { extrairPathsMarca } from '../marca/extrair-path';

const { viewBox, paths } = extrairPathsMarca(marcaSvg);

/**
 * Marca no topo. Com sessão (`empresa`), tenta `GET /empresa/logo` e cai na
 * marca SVG se 401/404. Sem sessão (ou fallback), SVG com fill currentColor
 * para acompanhar `--ailow-marca-texto` nos dois temas. Fora de /icons e /assets:
 * o SW não guarda.
 * Desenho = marca oficial (mesmos 5 paths do vídeo Remotion / brand/logo-ailow.svg).
 */
export function Logo({
  altura = 36,
  alt = 'Ailow',
  empresa = false,
  /** Incrementar após upload/remoção para forçar novo GET. */
  versao = 0,
}: {
  altura?: number;
  alt?: string;
  empresa?: boolean;
  versao?: number;
}) {
  const empresaSrc = `/empresa/logo?v=${versao}`;
  const [srcEmpresa, setSrcEmpresa] = useState<string | null>(empresa ? empresaSrc : null);
  useEffect(() => {
    setSrcEmpresa(empresa ? empresaSrc : null);
  }, [empresa, empresaSrc]);

  if (srcEmpresa) {
    return (
      <img
        src={empresaSrc}
        alt={alt}
        height={altura}
        onError={() => setSrcEmpresa(null)}
        style={{ display: 'block', height: altura, width: 'auto', maxWidth: 160 }}
      />
    );
  }

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={alt || 'Ailow'}
      height={altura}
      focusable="false"
      style={{
        display: 'block',
        height: altura,
        width: 'auto',
        maxWidth: 160,
        color: 'var(--ailow-marca-texto)',
        flexShrink: 0,
      }}
    >
      {paths.map((d) => (
        <path key={d.slice(0, 24)} fill="currentColor" d={d} />
      ))}
    </svg>
  );
}
