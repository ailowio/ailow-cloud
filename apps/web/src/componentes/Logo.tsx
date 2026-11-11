import { useEffect, useState } from 'react';

/**
 * Marca no topo. Com sessão (`empresa`), tenta `GET /empresa/logo` e cai no placeholder
 * `public/logo.svg` se 401/404. Sem sessão, só o placeholder (evita falhar antes do login e
 * "grudar" no fallback). O SVG NÃO fica em /icons nem /assets: o service worker não o guarda.
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
  const [src, setSrc] = useState(empresa ? empresaSrc : '/logo.svg');
  useEffect(() => {
    setSrc(empresa ? empresaSrc : '/logo.svg');
  }, [empresa, empresaSrc]);

  return (
    <img
      src={src}
      alt={alt}
      height={altura}
      onError={() => setSrc('/logo.svg')}
      style={{ display: 'block', height: altura, width: 'auto', maxWidth: 160 }}
    />
  );
}
