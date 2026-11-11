/*
 * Trava por inatividade (RF-ACE-04). O servidor expira a sessão após N minutos sem requisição
 * (`empresas.inatividade_minutos`); o app trava na mesma hora, medindo o uso do PRÓPRIO usuário (toque, tecla).
 * Enquanto a pessoa usa o app sem chamar a API, avisa o servidor de tempos em tempos para a sessão
 * não expirar por baixo dela. Ao travar, o chamador encerra a sessão no servidor e volta ao "Quem está usando?".
 */
export interface OpcoesTrava {
  minutos: number;
  aoTravar: () => void;
  aoManterVivo: () => void;
  intervaloManterVivoMs?: number;
  agora?: () => number;
}

export function criarTravaInatividade(opcoes: OpcoesTrava) {
  const agora = opcoes.agora ?? Date.now;
  const limite = opcoes.minutos * 60_000;
  const intervalo = opcoes.intervaloManterVivoMs ?? Math.min(limite / 2, 60_000);

  let ultimaAtividade = agora();
  let ultimoAviso = ultimaAtividade; // o servidor acabou de ser contactado ao abrir a sessão
  let timer: ReturnType<typeof setTimeout> | undefined;
  let encerrada = false;

  function agendar() {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(verificar, Math.max(limite - (agora() - ultimaAtividade), 0));
  }

  function parar() {
    encerrada = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  // Também chamada ao voltar para a aba/app: os timers congelam com o celular bloqueado.
  function verificar() {
    if (encerrada) return;
    if (agora() - ultimaAtividade >= limite) {
      parar();
      opcoes.aoTravar();
    } else {
      agendar();
    }
  }

  function atividade() {
    if (encerrada) return;
    const t = agora();
    // Se o limite já passou (timer congelado), a atividade NÃO ressuscita a sessão: trava.
    if (t - ultimaAtividade >= limite) return verificar();
    ultimaAtividade = t;
    if (t - ultimoAviso >= intervalo) {
      ultimoAviso = t;
      opcoes.aoManterVivo();
    }
    agendar();
  }

  agendar();
  return { atividade, verificar, parar };
}
