import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Loader, Stack, Text } from '@mantine/core';
import type { UsuarioPublico } from '@ailow/shared';
import { ErroApi, criarCliente } from './api/cliente';
import { criarApi, type QuemUsaItem } from './api/endpoints';
import { mensagemPin } from './acesso/mensagens';
import type { Modulo } from './acesso/modulos';
import { useTravaInatividade } from './acesso/useTrava';
import { DefinirPin } from './telas/DefinirPin';
import { Entrar } from './telas/Entrar';
import { Inicio } from './telas/Inicio';
import { Moldura } from './telas/Moldura';
import { PinTela } from './telas/PinTela';
import { QuemUsa } from './telas/QuemUsa';
import { Configuracoes } from './telas/config/Configuracoes';
import { Financeiro } from './telas/financeiro/Financeiro';

// Um estado por tela. `inicio` guarda a sessão aberta e o limite de inatividade vindo do servidor.
type Estado =
  | { tela: 'carregando' }
  | { tela: 'erro'; mensagem: string }
  | { tela: 'entrar'; aviso?: string }
  | { tela: 'definir-pin'; usuario: UsuarioPublico }
  | { tela: 'quem-usa'; usuarios: QuemUsaItem[]; aviso?: string }
  | { tela: 'pin'; alvo: QuemUsaItem }
  | { tela: 'inicio'; usuario: UsuarioPublico; inatividade: number; modulo: Modulo['id'] | null };

const SESSAO_ENCERRADA = 'Sua sessão terminou. Toque no seu nome e digite o PIN.';
const TRAVADO = 'App travado por falta de uso. Toque no seu nome e digite o PIN.';

export function App() {
  const [estado, setEstado] = useState<Estado>({ tela: 'carregando' });
  // O cliente da API precisa chamar o app quando a sessão expira, mas o app é criado depois dele: ponte por ref.
  const aoExpirar = useRef<() => void>(() => {});
  const api = useMemo(() => criarApi(criarCliente({ aoSessaoExpirar: () => aoExpirar.current() })), []);
  // A senha só existe em memória entre "Entrar" e "definir o primeiro PIN" (a API exige a senha para isso).
  const senhaTemporaria = useRef<string | null>(null);

  const irParaQuemUsa = useCallback(
    async (aviso?: string) => {
      try {
        const { usuarios } = await api.quemUsa();
        setEstado({ tela: 'quem-usa', usuarios, aviso });
      } catch (e) {
        if (e instanceof ErroApi && e.codigo === 'nao_autenticado') {
          // Aparelho não vinculado (ou vínculo perdido): volta para o e-mail e senha do Dono.
          setEstado({ tela: 'entrar', aviso: aviso ?? 'Este aparelho ainda não está vinculado. Entre como Dono.' });
        } else {
          setEstado({ tela: 'erro', mensagem: e instanceof ErroApi && e.status === 0 ? 'Sem conexão. Verifique a internet.' : 'Algo deu errado do nosso lado.' });
        }
      }
    },
    [api],
  );

  // Ao abrir o app: sessão ativa → início; senão aparelho vinculado → "Quem está usando?"; senão → Entrar.
  const iniciar = useCallback(async () => {
    setEstado({ tela: 'carregando' });
    try {
      const eu = await api.eu();
      setEstado({ tela: 'inicio', usuario: eu.usuario, inatividade: eu.inatividade_minutos, modulo: null });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 0) {
        setEstado({ tela: 'erro', mensagem: 'Sem conexão. Verifique a internet.' });
        return;
      }
      await irParaQuemUsa();
    }
  }, [api, irParaQuemUsa]);

  useEffect(() => {
    void iniciar();
  }, [iniciar]);

  // Sessão derrubada ou expirada no servidor enquanto o app está em uso. Nas outras telas o erro é tratado no local.
  aoExpirar.current = () => {
    if (estado.tela === 'inicio') void irParaQuemUsa(SESSAO_ENCERRADA);
  };

  // A sessão aberta pela senha serve só para o onboarding; o uso diário é por PIN.
  async function aoEntrar(email: string, senha: string) {
    const r = await api.entrar(email, senha);
    if (r.precisa_definir_pin) {
      senhaTemporaria.current = senha;
      setEstado({ tela: 'definir-pin', usuario: r.usuario });
      return;
    }
    await api.sair().catch(() => {});
    await irParaQuemUsa();
  }

  async function aoDefinirPin(pin: string) {
    const senha = senhaTemporaria.current;
    if (!senha) throw new ErroApi(401, 'credenciais_invalidas');
    await api.definirMeuPin(senha, pin);
    senhaTemporaria.current = null;
    await api.sair().catch(() => {});
    await irParaQuemUsa('PIN definido. Agora toque no seu nome e digite o PIN.');
  }

  async function aoConfirmarPin(alvo: QuemUsaItem, pin: string): Promise<string | null> {
    try {
      await api.pin(alvo.id, pin);
      const eu = await api.eu();
      setEstado({ tela: 'inicio', usuario: eu.usuario, inatividade: eu.inatividade_minutos, modulo: null });
      return null;
    } catch (e) {
      const erro = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      if (erro.codigo === 'nao_autenticado') {
        setEstado({ tela: 'entrar', aviso: 'Este aparelho precisa entrar de novo. Use e-mail e senha do Dono.' });
        return null;
      }
      return mensagemPin(erro);
    }
  }

  // "Trocar" e a trava por inatividade encerram a sessão no servidor (o cookie deixa de valer) antes de voltar.
  async function sairParaQuemUsa(aviso?: string) {
    await api.sair().catch(() => {});
    await irParaQuemUsa(aviso);
  }

  switch (estado.tela) {
    case 'carregando':
      return (
        <Moldura titulo="Ailow Cloud">
          <Stack align="center" py="xl" role="status" aria-label="Carregando">
            <Loader />
          </Stack>
        </Moldura>
      );
    case 'erro':
      return (
        <Moldura titulo="Sem conexão">
          <Stack gap="md" align="flex-start">
            <Text>{estado.mensagem}</Text>
            <Button onClick={() => void iniciar()}>Tentar de novo</Button>
          </Stack>
        </Moldura>
      );
    case 'entrar':
      return <Entrar aviso={estado.aviso} aoEntrar={aoEntrar} />;
    case 'definir-pin':
      return <DefinirPin nome={estado.usuario.nome} aoDefinir={aoDefinirPin} />;
    case 'quem-usa':
      return (
        <QuemUsa
          usuarios={estado.usuarios}
          aviso={estado.aviso}
          aoEscolher={(alvo) => setEstado({ tela: 'pin', alvo })}
          aoEntrarComSenha={() => setEstado({ tela: 'entrar' })}
        />
      );
    case 'pin':
      return (
        <PinTela
          alvo={estado.alvo}
          aoConfirmar={(pin) => aoConfirmarPin(estado.alvo, pin)}
          aoVoltar={() => void irParaQuemUsa()}
        />
      );
    case 'inicio':
      return (
        <Logado
          key={estado.usuario.id}
          usuario={estado.usuario}
          inatividade={estado.inatividade}
          modulo={estado.modulo}
          api={api}
          aoAbrir={(modulo) => setEstado({ ...estado, modulo })}
          aoMudarInatividade={(minutos) => setEstado({ ...estado, inatividade: minutos })}
          aoTrocar={() => void sairParaQuemUsa()}
          aoTravar={() => void sairParaQuemUsa(TRAVADO)}
        />
      );
  }
}

// Tudo que existe só com sessão aberta: a trava por inatividade vale em qualquer tela daqui.
function Logado(props: {
  usuario: UsuarioPublico;
  inatividade: number;
  modulo: Modulo['id'] | null;
  api: ReturnType<typeof criarApi>;
  aoAbrir: (m: Modulo['id'] | null) => void;
  aoMudarInatividade: (minutos: number) => void;
  aoTrocar: () => void;
  aoTravar: () => void;
}) {
  // Enquanto a pessoa usa o app sem chamar a API, avisa o servidor (senão a sessão expira por baixo dela).
  useTravaInatividade(props.inatividade, props.aoTravar, () => void props.api.eu().catch(() => {}));

  if (props.modulo === 'financeiro' && props.usuario.perfil === 'dono') {
    return <Financeiro api={props.api} aoVoltar={() => props.aoAbrir(null)} />;
  }
  if (props.modulo === 'configuracoes' && props.usuario.perfil === 'dono') {
    return (
      <Configuracoes
        api={props.api}
        usuarioId={props.usuario.id}
        aoVoltar={() => props.aoAbrir(null)}
        aoMudarInatividade={props.aoMudarInatividade}
      />
    );
  }
  return <Inicio usuario={props.usuario} aoAbrir={props.aoAbrir} aoTrocar={props.aoTrocar} />;
}
