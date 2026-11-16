import { useState } from 'react';
import { Badge, Button, Group, PasswordInput, PinInput, Stack, Text, TextInput } from '@mantine/core';
import { Modal } from '../../componentes/navegacao';
import { IconLock, IconPlus } from '@tabler/icons-react';
import type { Api, UsuarioAdminItem } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { fecharModal, useAcao } from './comum';

const PERFIL = { dono: 'Dono', vendedor: 'Vendedor' } as const;
type Modo = 'menu' | 'pin' | 'meu-pin' | 'desativar';

/** RF-CFG-01: criar Vendedor, redefinir PIN, desbloquear, derrubar sessões e desativar. */
export function Usuarios(props: { api: Api; eu: string }) {
  const { api } = props;
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.usuarios().then((r) => r.usuarios));
  const [novo, setNovo] = useState(false);
  const [alvo, setAlvo] = useState<UsuarioAdminItem | null>(null);

  return (
    <Stack gap="md">
      <Button leftSection={<IconPlus aria-hidden />} onClick={() => setNovo(true)}>
        Novo vendedor
      </Button>

      {carga.fase === 'carregando' && <Carregando />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.length === 0 && (
        <EstadoVazio titulo="Nenhum usuário" texto="Cadastre o primeiro vendedor." />
      )}
      {carga.fase === 'pronto' &&
        carga.dados.map((u) => (
          <Stack key={u.id} gap="xs" p="md" className="ailow-cartao">
            {/* Nome inteiro, nunca cortado (D23). */}
            <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
              {u.nome}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color="gray">
                {PERFIL[u.perfil]}
              </Badge>
              {!u.ativo && <Badge color="gray">Desativado</Badge>}
              {u.bloqueado && (
                <Badge color="red" variant="light" leftSection={<IconLock size={12} aria-hidden />}>
                  Bloqueado
                </Badge>
              )}
            </Group>
            {/* Desativado não volta (a API não reativa): sem ações. */}
            {u.ativo && (
              <Button variant="default" onClick={() => setAlvo(u)} aria-label={`Opções de ${u.nome}`}>
                Opções
              </Button>
            )}
          </Stack>
        ))}

      <NovoVendedor
        aberto={novo}
        api={api}
        aoFechar={() => setNovo(false)}
        aoCriar={() => {
          setNovo(false);
          void recarregar();
        }}
      />
      {alvo && (
        <OpcoesUsuario
          key={alvo.id}
          api={api}
          alvo={alvo}
          souEu={alvo.id === props.eu}
          aoFechar={() => setAlvo(null)}
          aoMudar={() => {
            setAlvo(null);
            void recarregar();
          }}
        />
      )}
    </Stack>
  );
}

function NovoVendedor(props: { aberto: boolean; api: Api; aoFechar: () => void; aoCriar: () => void }) {
  const [nome, setNome] = useState('');
  const [pin, setPin] = useState('');
  const { pendente, rodar } = useAcao();

  async function salvar() {
    if (!(await rodar(() => props.api.criarVendedor(nome.trim(), pin), 'Vendedor criado'))) return;
    setNome('');
    setPin('');
    props.aoCriar();
  }

  return (
    <Modal opened={props.aberto} onClose={props.aoFechar} title="Novo vendedor" centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        <TextInput label="Nome" required size="lg" maxLength={120} value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
        <Stack gap={6}>
          <Text component="label" size="sm" fw={500} id="rotulo-pin-novo">
            PIN de 4 dígitos
          </Text>
          <PinInput length={4} type="number" mask inputMode="numeric" size="lg" aria-labelledby="rotulo-pin-novo" value={pin} onChange={setPin} />
          <Text size="xs" c="dimmed">
            O vendedor usa este PIN para abrir o app.
          </Text>
        </Stack>
        <Button onClick={() => void salvar()} loading={pendente} disabled={!nome.trim() || pin.length !== 4}>
          Criar vendedor
        </Button>
      </Stack>
    </Modal>
  );
}

function OpcoesUsuario(props: {
  api: Api;
  alvo: UsuarioAdminItem;
  souEu: boolean;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const { api, alvo } = props;
  const [modo, setModo] = useState<Modo>('menu');
  const [pin, setPin] = useState('');
  const [senha, setSenha] = useState('');
  const { pendente, rodar } = useAcao();
  const ehVendedor = alvo.perfil === 'vendedor';

  // Trocar de modo limpa o que foi digitado: PIN e senha não ficam esperando em memória.
  const ir = (m: Modo) => {
    setModo(m);
    setPin('');
    setSenha('');
  };
  async function executar(fn: () => Promise<unknown>, ok: string) {
    if (await rodar(fn, ok)) props.aoMudar();
  }

  return (
    <Modal opened onClose={props.aoFechar} title={alvo.nome} centered closeButtonProps={fecharModal}>
      <Stack gap="sm">
        {modo === 'menu' && (
          <>
            {/* PIN do Vendedor é redefinido pelo Dono; o do Dono, por ele mesmo com a senha (a API exige). */}
            {ehVendedor && (
              <Button variant="default" onClick={() => ir('pin')}>
                Redefinir PIN
              </Button>
            )}
            {props.souEu && (
              <Button variant="default" onClick={() => ir('meu-pin')}>
                Trocar meu PIN
              </Button>
            )}
            {alvo.bloqueado && (
              <Button variant="default" loading={pendente} onClick={() => void executar(() => api.desbloquear(alvo.id), 'Usuário desbloqueado')}>
                Desbloquear
              </Button>
            )}
            {/* Derrubar a própria sessão desconectaria o Dono no meio da tela. */}
            {!props.souEu && (
              <Button variant="default" loading={pendente} onClick={() => void executar(() => api.derrubarSessoes(alvo.id), 'Sessões encerradas')}>
                Derrubar sessões
              </Button>
            )}
            {ehVendedor && (
              <Button color="red" variant="light" onClick={() => ir('desativar')}>
                Desativar
              </Button>
            )}
          </>
        )}

        {modo === 'pin' && (
          <>
            <Text>Novo PIN de {alvo.nome}. As sessões abertas dele serão encerradas.</Text>
            <PinInput length={4} type="number" mask inputMode="numeric" size="lg" aria-label="Novo PIN de 4 dígitos" value={pin} onChange={setPin} />
            <Button loading={pendente} disabled={pin.length !== 4} onClick={() => void executar(() => api.redefinirPin(alvo.id, pin), 'PIN redefinido')}>
              Salvar PIN
            </Button>
          </>
        )}

        {modo === 'meu-pin' && (
          <>
            <PasswordInput label="Sua senha" autoComplete="current-password" size="lg" value={senha} onChange={(e) => setSenha(e.currentTarget.value)} />
            <Text size="sm">Novo PIN de 4 dígitos</Text>
            <PinInput length={4} type="number" mask inputMode="numeric" size="lg" aria-label="Novo PIN de 4 dígitos" value={pin} onChange={setPin} />
            <Button loading={pendente} disabled={pin.length !== 4 || !senha} onClick={() => void executar(() => api.definirMeuPin(senha, pin), 'PIN trocado')}>
              Salvar PIN
            </Button>
          </>
        )}

        {/* Ação destrutiva: pede confirmação nomeando quem será desativado. */}
        {modo === 'desativar' && (
          <>
            <Text>
              Desativar <strong>{alvo.nome}</strong>? A pessoa deixa de aparecer em “Quem está usando?” e as sessões abertas caem agora.
            </Text>
            <Button color="red" loading={pendente} onClick={() => void executar(() => api.desativar(alvo.id), 'Usuário desativado')}>
              Sim, desativar {alvo.nome}
            </Button>
          </>
        )}

        {modo !== 'menu' && (
          <Button variant="subtle" onClick={() => ir('menu')}>
            Voltar
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
