import { useEffect, useState } from 'react';
import { Button, SegmentedControl, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import type { Cliente, Perfil } from '@ailow/shared';
import { mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { Moldura } from '../Moldura';
import { FichaCliente } from './FichaCliente';
import { NovoCliente } from './NovoCliente';

type Vista = 'lista' | 'novo';
type Situacao = 'ativos' | 'inativos';

/**
 * Clientes (S09, RF-CLI-01…05). Dono e Vendedor cadastram, corrigem, buscam por nome ou celular e abrem a ficha;
 * só o Dono vê os inativos, inativa, reativa e exclui.
 */
export function Clientes(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const [vista, setVista] = useState<Vista>('lista');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  // Muda quando algo muda na ficha: a lista busca de novo.
  const [rodada, setRodada] = useState(0);
  const dono = props.perfil === 'dono';

  if (vista === 'novo') {
    return (
      <Moldura titulo="Novo cliente" voltar={{ rotulo: 'Clientes', aoVoltar: () => setVista('lista') }}>
        <NovoCliente
          api={props.api}
          aoCriar={(id) => {
            setRodada((r) => r + 1);
            setAbertoId(id);
            setVista('lista');
          }}
        />
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Clientes" voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <Lista key={rodada} api={props.api} dono={dono} aoNovo={() => setVista('novo')} aoAbrir={setAbertoId} />
      {abertoId && (
        <FichaCliente
          api={props.api}
          dono={dono}
          id={abertoId}
          aoFechar={() => setAbertoId(null)}
          aoMudar={() => setRodada((r) => r + 1)}
        />
      )}
    </Moldura>
  );
}

function Lista(props: { api: Api; dono: boolean; aoNovo: () => void; aoAbrir: (id: string) => void }) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<Situacao>('ativos');

  // Espera a pessoa parar de digitar para não chamar a API a cada letra.
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <Stack gap="md">
      <Button h={48} leftSection={<IconPlus aria-hidden />} onClick={props.aoNovo}>
        Novo cliente
      </Button>
      {props.dono && (
        <SegmentedControl
          fullWidth
          size="lg"
          value={situacao}
          onChange={(v) => setSituacao(v as Situacao)}
          data={[
            { label: 'Ativos', value: 'ativos' },
            { label: 'Inativos', value: 'inativos' },
          ]}
          styles={{ label: { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } }}
        />
      )}
      <TextInput
        size="lg"
        aria-label="Buscar cliente"
        placeholder="Nome ou celular"
        leftSection={<IconSearch aria-hidden />}
        autoComplete="off"
        maxLength={80}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      <ListaClientes
        key={`${busca}|${situacao}`}
        api={props.api}
        busca={busca}
        situacao={situacao}
        aoNovo={props.aoNovo}
        aoAbrir={props.aoAbrir}
      />
    </Stack>
  );
}

function ListaClientes(props: { api: Api; busca: string; situacao: Situacao; aoNovo: () => void; aoAbrir: (id: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.clientes(props.busca, props.situacao));
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { clientes, truncado } = carga.dados;

  if (clientes.length === 0) {
    if (props.situacao === 'inativos') {
      return (
        <EstadoVazio
          titulo={props.busca !== '' ? 'Nenhum inativo encontrado' : 'Nenhum cliente inativo'}
          texto="Quando você inativar um cliente, ele aparece aqui e dá para reativar."
        />
      );
    }
    if (props.busca !== '') {
      return (
        <EstadoVazio
          titulo="Nenhum cliente encontrado"
          texto="Tente outro pedaço do nome ou os últimos números do celular."
          acao="Novo cliente"
          onAcao={props.aoNovo}
        />
      );
    }
    return (
      <EstadoVazio
        titulo="Nenhum cliente ainda"
        texto="Cadastre o primeiro cliente com nome e celular. Depois é só buscar por aqui."
        acao="Novo cliente"
        onAcao={props.aoNovo}
      />
    );
  }

  return (
    <Stack gap="sm">
      {clientes.map((c) => (
        <CartaoCliente key={c.id} cliente={c} aoAbrir={props.aoAbrir} />
      ))}
      {truncado && (
        <Text size="sm" c="dimmed">
          Mostrando os primeiros 200. Digite mais letras do nome ou mais números do celular para achar o resto.
        </Text>
      )}
    </Stack>
  );
}

function CartaoCliente(props: { cliente: Cliente; aoAbrir: (id: string) => void }) {
  const { cliente: c } = props;
  return (
    <UnstyledButton className="ailow-bloco" mih={56} p="sm" w="100%" onClick={() => props.aoAbrir(c.id)}>
      <Stack gap={2}>
        <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
          {c.nome}
        </Text>
        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mascararCelular(c.celular)}
        </Text>
      </Stack>
    </UnstyledButton>
  );
}
