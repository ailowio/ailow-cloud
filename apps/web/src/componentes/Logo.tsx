import { useEffect, useState } from 'react';

/**
 * Marca no topo. Com sessão (`empresa`), tenta `GET /empresa/logo` e cai em
 * `public/logo.png` se 401/404. Sem sessão, só a marca do produto (evita falhar
 * antes do login e "grudar" no fallback). Fora de /icons e /assets: o SW não guarda.
 */
export function Logo({
  altura = 36,
  alt = 'Ailow ERP',
  empresa = false,
  /** Incrementar após upload/remoção para forçar novo GET. */
  versao = 0,
}: {
  altura?: number;
  alt?: string;
  empresa?: boolean;
  versao?: number;
}) {
  const marca = '/logo.png';
  const empresaSrc = `/empresa/logo?v=${versao}`;
  const [src, setSrc] = useState(empresa ? empresaSrc : marca);
  useEffect(() => {
    setSrc(empresa ? empresaSrc : marca);
  }, [empresa, empresaSrc]);

  return (
    <img
      src={src}
      alt={alt}
      height={altura}
      onError={() => setSrc(marca)}
      style={{ display: 'block', height: altura, width: 'auto', maxWidth: 160 }}
    />
  );
}
