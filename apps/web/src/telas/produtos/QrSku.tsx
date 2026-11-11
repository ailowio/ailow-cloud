import { useMemo } from 'react';
import { BORDA_QR, caminhoDoQr, matrizQr } from '../../lib/qr';

/**
 * QR do código curto do SKU (RF-PRO-02). Sempre escuro sobre fundo branco, mesmo no tema escuro: leitor de câmera
 * precisa de contraste e da zona de silêncio branca em volta.
 */
export function QrSku({ codigo, lado = 176 }: { codigo: string; lado?: number }) {
  const { caminho, modulos } = useMemo(() => {
    const matriz = matrizQr(codigo);
    return { caminho: caminhoDoQr(matriz), modulos: matriz.length + 2 * BORDA_QR };
  }, [codigo]);
  return (
    <svg
      role="img"
      aria-label={`QR do código ${codigo}`}
      viewBox={`0 0 ${modulos} ${modulos}`}
      width={lado}
      height={lado}
      shapeRendering="crispEdges"
      style={{ borderRadius: 8, maxWidth: '100%', height: 'auto' }}
    >
      <rect width={modulos} height={modulos} fill="#ffffff" />
      <path d={caminho} fill="#000000" />
    </svg>
  );
}
