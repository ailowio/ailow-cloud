import { useEffect, useState } from 'react';
import { Button, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
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

/**
 * Clientes (S09, RF-CLI-01…04). Dono e Vendedor cadastram, buscam por nome ou celular e abrem a ficha;
 * só o Dono apaga os dados de um cliente.
 */
export function Clientes(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const [vista, setVista] = useState<Vista>('lista');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  // Muda quando algo muda na ficha: a lista busca de novo.
  const [rodada, setRodada] = useState(0);

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
      <Lista key={rodada} api={props.api} aoNovo={() => setVista('novo')} aoAbrir={setAbertoId} />
      {abertoId && (
        <FichaCliente
          api={props.api}
          dono={props.perfil === 'dono'}
          id={abertoId}
          aoFechar={() => setAbertoId(null)}
          aoMudar={() => setRodada((r) => r + 1)}
        />
      )}
    </Moldura>
  );
}

function Lista(props: { api: Api; aoNovo: () => void; aoAbrir: (id: string) => void }) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');

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
      <ListaClientes key={busca} api={props.api} busca={busca} aoNovo={props.aoNovo} aoAbrir={props.aoAbrir} />
    </Stack>
  );
}

function ListaClientes(props: { api: Api; busca: string; aoNovo: () => void; aoAbrir: (id: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.clientes(props.busca));
  if (carga.fase === 'carregando') return <Carregando />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  const { clientes, truncado } = carga.dados;

  if (clientes.length === 0) {
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
        {c.celular !== null && (
          <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {mascararCelular(c.celular)}
          </Text>
        )}
      </Stack>
    </UnstyledButton>
  );
}
