// O service worker só existe no build de produção: em desenvolvimento ele guardaria arquivos velhos e confundiria o teste.
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o app continua funcionando; só não abre offline nem fica instalável em alguns navegadores.
    });
  });
}
