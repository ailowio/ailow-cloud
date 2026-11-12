// Parte de `scripts/contrato.sh` (S13a): entra como o Dono do contrato e imprime o cabeçalho `Cookie` da sessão
// (e só ele) em stdout, para o Schemathesis testar as rotas autenticadas. Nenhum segredo é gravado em arquivo.
const alvo = process.env.ALVO_LOCAL ?? 'http://127.0.0.1:3002';
const senha = process.env.CONTRATO_SENHA;
if (!senha) throw new Error('defina CONTRATO_SENHA');

const cabecalhos = { 'content-type': 'application/json' };
const entrou = await fetch(`${alvo}/acesso/entrar`, {
  method: 'POST',
  headers: cabecalhos,
  body: JSON.stringify({ email: 'dono@contrato.test', senha }),
});
if (!entrou.ok) throw new Error(`entrar falhou: ${entrou.status}`);

const cookies = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0] as string);
const jar = new Map<string, string>();
for (const c of cookies(entrou)) jar.set(c.split('=')[0] as string, c);
const cabecalhoCookie = () => [...jar.values()].join('; ');

// O Dono nasce sem PIN; definir o PIN deixa a sessão no mesmo estado das usadas pelo app.
const pin = await fetch(`${alvo}/acesso/meu-pin`, {
  method: 'PUT',
  headers: { ...cabecalhos, cookie: cabecalhoCookie() },
  body: JSON.stringify({ senha, pin: '4321' }),
});
if (pin.status !== 204) throw new Error(`definir PIN falhou: ${pin.status}`);

process.stdout.write(cabecalhoCookie());
