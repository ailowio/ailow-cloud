// Versão embutida no build (VITE_APP_VERSION). Em produção o Dockerfile passa a tag (ex.: v1.1.0); no dev fica "dev".

export function versaoDoApp(): string {
  const v = import.meta.env.VITE_APP_VERSION;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : 'dev';
}
