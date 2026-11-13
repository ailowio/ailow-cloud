import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate, type NavigateOptions } from 'react-router';
import { Button, Loader, Stack, Text } from '@mantine/core';
import type { UsuarioPublico } from '@ailow/shared';
import { ErroApi, criarCliente } from './api/cliente';
import { criarApi, type QuemUsaItem } from './api/endpoints';
import { mensagemPin } from './acesso/mensagens';
import { modulosPara, type Modulo } from './acesso/modulos';
import { useTravaInatividade } from './acesso/useTrava';
import { TravaVoltar, useVoltar } from './componentes/navegacao';
import { SessaoContexto } from './componentes/sessao';
import { TransicaoUsuario } from './componentes/TransicaoUsuario';
import { DefinirPin } from './telas/DefinirPin';
import { Entrar } from './telas/Entrar';
import { Inicio } from './telas/Inicio';
import { Moldura } from './telas/Moldura';
import { PinTela } from './telas/PinTela';
import { QuemUsa } from './telas/QuemUsa';
import { Clientes } from './telas/clientes/Clientes';
import { Configuracoes } from './telas/config/Configuracoes';
import { Financeiro } from './telas/financeiro/Financeiro';
import { Produtos } from './telas/produtos/Produtos';
import { Compras } from './telas/compras/Compras';
import { Pessoas } from './telas/pessoas/Pessoas';
import { Vendas } from './telas/vendas/Vendas';

// A tela atual é a ROTA (ADR 011): /entrar, /definir-pin, /quem-usa, /pin sem sessão; / e /<módulo> com sessão.
// O estado guarda só os dados que as telas precisam. `sessao` guarda o usuário e o limite de inatividade do servidor.
type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto' };
interface Sessao {
  usuario: UsuarioPublico;
  inatividade: number;
}

const SESSAO_ENCERRADA = 'Sua sessão terminou. Toque no seu nome e digite o PIN.';
const TRAVADO = 'App travado por falta de uso. Toque no seu nome e digite o PIN.';

export function App() {
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' });
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [usuarios, setUsuarios] = useState<QuemUsaItem[] | null>(null);
  const [avisoQuemUsa, setAvisoQuemUsa] = useState<string | undefined>();
  const [avisoEntrar, setAvisoEntrar] = useState<string | undefined>();
  const [alvo, setAlvo] = useState<QuemUsaItem | null>(null);
  const [usuarioPin, setUsuarioPin] = useState<UsuarioPublico | null>(null);
  // O cliente da API precisa chamar o app quando a sessão expira, mas o app é criado depois dele: ponte por ref.
  const aoExpirar = useRef<() => void>(() => {});
  const api = useMemo(() => criarApi(criarCliente({ aoSessaoExpirar: () => aoExpirar.current() })), []);
  // A senha só existe em memória entre "Entrar" e "definir o primeiro PIN" (a API exige a senha para isso).
  const senhaTemporaria = useRef<string | null>(null);
  // `navigate` muda de identidade a cada rota; a ref mantém os callbacks (e o efeito de abertura) estáveis.
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;
  const ir = useCallback((para: string, opcoes?: NavigateOptions) => void navRef.current(para, opcoes), []);
  const voltarParaQuemUsa = useVoltar('/quem-usa');
  // UXM-07: contador que dispara a transição (entrada, saída, troca). Cada ponto onde a sessão do usuário muda chama `transicao`.
  const [disparo, setDisparo] = useState(0);
  const [saiu, setSaiu] = useState(false);
  const transicao = useCallback(() => setDisparo((n) => n + 1), []);

  const irParaQuemUsa = useCallback(
    async (aviso?: string) => {
      try {
        const r = await api.quemUsa();
        setSaiu(false);
        setSessao(null);
        setUsuarios(r.usuarios);
        setAvisoQuemUsa(aviso);
        setCarga({ fase: 'pronto' });
        ir('/quem-usa', { replace: true });
      } catch (e) {
        if (e instanceof ErroApi && e.codigo === 'nao_autenticado') {
          // Aparelho não vinculado (ou vínculo perdido): volta para o e-mail e senha do Dono.
          setSessao(null);
          setAvisoEntrar(aviso ?? 'Este aparelho ainda não está vinculado. Entre como Dono.');
          setCarga({ fase: 'pronto' });
          ir('/entrar', { replace: true });
        } else {
          setCarga({ fase: 'erro', mensagem: e instanceof ErroApi && e.status === 0 ? 'Sem conexão. Verifique a internet.' : 'Algo deu errado do nosso lado.' });
        }
      }
    },
    [api, ir],
  );

  // Ao abrir o app: sessão ativa → fica na rota pedida (início por padrão); senão aparelho vinculado → "Quem está usando?"; senão → Entrar.
  const iniciar = useCallback(async () => {
    setCarga({ fase: 'carregando' });
    try {
      const eu = await api.eu();
      setSessao({ usuario: eu.usuario, inatividade: eu.inatividade_minutos });
      setCarga({ fase: 'pronto' });
    } catch (e) {
      if (e instanceof ErroApi && e.status === 0) {
        setCarga({ fase: 'erro', mensagem: 'Sem conexão. Verifique a internet.' });
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
    if (sessao) void irParaQuemUsa(SESSAO_ENCERRADA);
  };

  // A sessão aberta pela senha serve só para o onboarding; o uso diário é por PIN.
  async function aoEntrar(email: string, senha: string) {
    const r = await api.entrar(email, senha);
    if (r.precisa_definir_pin) {
      senhaTemporaria.current = senha;
      setUsuarioPin(r.usuario);
      transicao();
      ir('/definir-pin', { replace: true });
      return;
    }
    await api.sair().catch(() => {});
    transicao();
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

  async function aoConfirmarPin(escolhido: QuemUsaItem, pin: string): Promise<string | null> {
    try {
      await api.pin(escolhido.id, pin);
      const eu = await api.eu();
      setSessao({ usuario: eu.usuario, inatividade: eu.inatividade_minutos });
      transicao();
      ir('/', { replace: true });
      return null;
    } catch (e) {
      const erro = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      if (erro.codigo === 'nao_autenticado') {
        setAvisoEntrar('Este aparelho precisa entrar de novo. Use e-mail e senha do Dono.');
        ir('/entrar', { replace: true });
        return null;
      }
      return mensagemPin(erro);
    }
  }

  // "Trocar" e a trava por inatividade encerram a sessão no servidor (o cookie deixa de valer) antes de voltar.
  const sairParaQuemUsa = useCallback(
    async (aviso?: string) => {
      await api.sair().catch(() => {});
      transicao();
      await irParaQuemUsa(aviso);
    },
    [api, irParaQuemUsa, transicao],
  );

  const aoTrocar = useCallback(() => void sairParaQuemUsa(), [sairParaQuemUsa]);

  // UXM-06 "Sair": encerra a sessão no servidor e volta ao login do Dono. Não existe endpoint para desvincular o
  // aparelho (ADR 004: "não há revogação do aparelho em si"), então o vínculo continua; recarregar abre "Quem está usando?".
  const aoSair = useCallback(async () => {
    await api.sair().catch(() => {});
    setSaiu(true);
    setSessao(null);
    setAvisoEntrar('Você saiu. Para entrar de novo, use o e-mail e a senha do Dono.');
    transicao();
    ir('/entrar', { replace: true });
  }, [api, ir, transicao]);

  let corpo: ReactNode;
  if (carga.fase === 'carregando') {
    corpo = (
      <Moldura titulo="Ailow ERP">
        <Stack align="center" py="xl" role="status" aria-label="Carregando">
          <Loader />
        </Stack>
      </Moldura>
    );
  } else if (carga.fase === 'erro') {
    corpo = (
      <Moldura titulo="Sem conexão">
        <Stack gap="md" align="flex-start">
          <Text>{carga.mensagem}</Text>
          <Button onClick={() => void iniciar()}>Tentar de novo</Button>
        </Stack>
      </Moldura>
    );
  } else if (sessao) {
    corpo = (
      <Logado
        key={sessao.usuario.id}
        usuario={sessao.usuario}
        inatividade={sessao.inatividade}
        api={api}
        aoMudarInatividade={(minutos) => setSessao({ ...sessao, inatividade: minutos })}
        aoTrocar={aoTrocar}
        aoSair={aoSair}
        aoTravar={() => void sairParaQuemUsa(TRAVADO)}
      />
    );
  } else {
    // Sem sessão, qualquer rota que não seja de entrada cai na tela de entrada do aparelho.
    // Depois de "Sair" o destino é /entrar; sem isso o fallback "*" (renderizado antes da navegação) o jogava em /quem-usa.
    const padrao = usuarios && !saiu ? '/quem-usa' : '/entrar';
    corpo = (
      <Routes>
        {/* `usuarios` só é preenchido quando "Quem está usando?" respondeu, ou seja, o aparelho está vinculado (ADR 004). */}
        <Route
          path="/entrar"
          element={<Entrar aviso={avisoEntrar} aoEntrar={aoEntrar} aoTrocarUsuario={usuarios ? () => void irParaQuemUsa() : undefined} />}
        />
        <Route
          path="/definir-pin"
          element={usuarioPin ? <DefinirPin nome={usuarioPin.nome} aoDefinir={aoDefinirPin} /> : <Navigate to={padrao} replace />}
        />
        <Route
          path="/quem-usa"
          element={
            usuarios ? (
              <QuemUsa
                usuarios={usuarios}
                aviso={avisoQuemUsa}
                aoEscolher={(u) => {
                  setAlvo(u);
                  ir('/pin');
                }}
                aoEntrarComSenha={() => {
                  setAvisoEntrar(undefined);
                  ir('/entrar');
                }}
              />
            ) : (
              <Navigate to="/entrar" replace />
            )
          }
        />
        <Route
          path="/pin"
          element={alvo ? <PinTela alvo={alvo} aoConfirmar={(pin) => aoConfirmarPin(alvo, pin)} aoVoltar={voltarParaQuemUsa} /> : <Navigate to={padrao} replace />}
        />
        <Route path="*" element={<Navigate to={padrao} replace />} />
      </Routes>
    );
  }

  return (
    <>
      <TravaVoltar />
      {corpo}
      <TransicaoUsuario disparo={disparo} />
    </>
  );
}

// Tela de cada módulo. A permissão por perfil vem de acesso/modulos.ts (modulosPara); o servidor impõe o mesmo (RN-10).
// Vendas, Produtos, Clientes e Pessoas abrem para Dono e Vendedor; a tela e a API cuidam do que cada um vê.
function telaDoModulo(
  id: Modulo['id'],
  p: { usuario: UsuarioPublico; api: ReturnType<typeof criarApi>; aoVoltar: () => void; aoMudarInatividade: (m: number) => void },
): ReactNode {
  const { api, usuario, aoVoltar } = p;
  switch (id) {
    case 'vendas':
      return <Vendas api={api} perfil={usuario.perfil} aoVoltar={aoVoltar} />;
    case 'produtos':
      return <Produtos api={api} perfil={usuario.perfil} aoVoltar={aoVoltar} />;
    case 'clientes':
      return <Clientes api={api} perfil={usuario.perfil} aoVoltar={aoVoltar} />;
    case 'pessoas':
      return <Pessoas api={api} perfil={usuario.perfil} aoVoltar={aoVoltar} />;
    case 'compras':
      return <Compras api={api} aoVoltar={aoVoltar} />;
    case 'financeiro':
      return <Financeiro api={api} aoVoltar={aoVoltar} />;
    case 'configuracoes':
      return <Configuracoes api={api} usuarioId={usuario.id} aoVoltar={aoVoltar} aoMudarInatividade={p.aoMudarInatividade} />;
  }
}

// Tudo que existe só com sessão aberta: a trava por inatividade vale em qualquer tela daqui.
function Logado(props: {
  usuario: UsuarioPublico;
  inatividade: number;
  api: ReturnType<typeof criarApi>;
  aoMudarInatividade: (minutos: number) => void;
  aoTrocar: () => void;
  aoSair: () => void;
  aoTravar: () => void;
}) {
  // Enquanto a pessoa usa o app sem chamar a API, avisa o servidor (senão a sessão expira por baixo dela).
  useTravaInatividade(props.inatividade, props.aoTravar, () => void props.api.eu().catch(() => {}));
  const navigate = useNavigate();
  const voltar = useVoltar('/');

  const sessaoUi = useMemo(
    () => ({ nome: props.usuario.nome, aoTrocar: props.aoTrocar, aoSair: props.aoSair }),
    [props.usuario.nome, props.aoTrocar, props.aoSair],
  );

  return (
    <SessaoContexto.Provider value={sessaoUi}>
    <Routes>
      <Route path="/" element={<Inicio usuario={props.usuario} api={props.api} aoAbrir={(m) => navigate(`/${m}`)} />} />
      {modulosPara(props.usuario.perfil).map((m) => (
        <Route
          key={m.id}
          path={`/${m.id}/*`}
          element={telaDoModulo(m.id, { usuario: props.usuario, api: props.api, aoVoltar: voltar, aoMudarInatividade: props.aoMudarInatividade })}
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </SessaoContexto.Provider>
  );
}
