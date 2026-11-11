/**
 * Logo do app. Hoje é um placeholder: para trocar, basta substituir `apps/web/public/logo.svg`
 * (qualquer proporção; a altura é fixa e a largura se ajusta). O arquivo NÃO fica em /icons nem
 * /assets de propósito: o service worker guarda esses caminhos e a logo nova não apareceria.
 */
export function Logo({ altura = 36, alt = 'Ailow' }: { altura?: number; alt?: string }) {
  return <img src="/logo.svg" alt={alt} height={altura} style={{ display: 'block', height: altura, width: 'auto', maxWidth: 160 }} />;
}
