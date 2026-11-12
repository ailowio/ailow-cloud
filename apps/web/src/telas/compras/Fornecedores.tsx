import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconAlertCircle, IconPlus, IconSearch } from '@tabler/icons-react';
import type { Fornecedor } from '@ailow/shared';
import { mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { mensagemCompras } from './rotulos';

type Vista = 'lista' | 'novo' | 'editar';

/** RF-COM-01: lista, cadastro e edição de fornecedores. */
export function Fornecedores(props: { api: Api }) {
  const [vista, setVista] = useState<Vista>('lista');
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [rodada, setRodada] = useState(0);

  if (vista === 'novo' || (vista === 'editar' && editando)) {
    return (
      <FormFornecedor
        api={props.api}
        inicial={vista === 'editar' ? editando : null}
        aoCancelar={() => {
          setVista('lista');
          setEditando(null);
        }}
        aoSalvar={() => {
          setRodada((r) => r + 1);
          setVista('lista');
          setEditando(null);
        }}
      />
    );
  }

  return (
    <Lista
      key={rodada}
      api={props.api}
      aoNovo={() => setVista('novo')}
      aoEditar={(f) => {
        setEditando(f);
        setVista('editar');
      }}
    />
  );
}

function Lista(props: { api: Api; aoNovo: () => void; aoEditar: (f: Fornecedor) => void }) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <Stack gap="md">
      <Button h={48} leftSection={<IconPlus aria-hidden />} onClick={props.aoNovo}>
        Novo fornecedor
      </Button>
      <TextInput
        size="lg"
        aria-label="Buscar fornecedor"
        placeholder="Nome ou WhatsApp"
        leftSection={<IconSearch aria-hidden />}
        autoComplete="off"
        maxLength={80}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      <Resultados key={busca} api={props.api} busca={busca} aoEditar={props.aoEditar} />
    </Stack>
  );
}

function Resultados(props: { api: Api; busca: string; aoEditar: (f: Fornecedor) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.fornecedores(props.busca || undefined));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.fornecedores.length === 0) {
    return <EstadoVazio titulo="Nenhum fornecedor" texto="Cadastre quem manda as peças para montar o pedido." />;
  }
  return (
    <Stack gap="sm">
      {carga.dados.fornecedores.map((f) => (
        <UnstyledButton key={f.id} className="ailow-bloco" mih={64} p="md" w="100%" onClick={() => props.aoEditar(f)}>
          <Text fw={650}>{f.nome}</Text>
          <Text size="sm" c="dimmed">
            {mascararCelular(f.whatsapp)}
            {f.cnpj ? ` · ${f.cnpj}` : ''}
          </Text>
        </UnstyledButton>
      ))}
      {carga.dados.truncado && (
        <Text size="sm" c="dimmed">
          Mostrando os primeiros resultados. Refine a busca.
        </Text>
      )}
    </Stack>
  );
}

function FormFornecedor(props: {
  api: Api;
  inicial: Fornecedor | null;
  aoCancelar: () => void;
  aoSalvar: () => void;
}) {
  const [nome, setNome] = useState(props.inicial?.nome ?? '');
  const [whatsapp, setWhatsapp] = useState(props.inicial?.whatsapp ?? '');
  const [cnpj, setCnpj] = useState(props.inicial?.cnpj ?? '');
  const { pendente, erro, rodar } = useAcao(mensagemCompras);
  const pronto = nome.trim() !== '' && whatsapp.trim() !== '';

  async function salvar() {
    if (!pronto) return;
    const corpo = { nome: nome.trim(), whatsapp: whatsapp.trim(), cnpj: cnpj.trim() === '' ? null : cnpj.trim() };
    const ok = await rodar(
      () =>
        props.inicial
          ? props.api.editarFornecedor(props.inicial.id, corpo)
          : props.api.criarFornecedor(corpo),
      props.inicial ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
    );
    if (ok) props.aoSalvar();
  }

  return (
    <Stack gap="md">
      <TextInput label="Nome" required size="lg" maxLength={80} value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
      <TextInput
        label="WhatsApp"
        required
        size="lg"
        placeholder="(11) 91234-5678"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.currentTarget.value)}
      />
      <TextInput
        label="CNPJ (opcional)"
        size="lg"
        placeholder="12.345.678/0001-95"
        value={cnpj}
        onChange={(e) => setCnpj(e.currentTarget.value)}
      />
      {erro && (
        <Alert color="red" icon={<IconAlertCircle aria-hidden />}>
          {erro}
        </Alert>
      )}
      <Button h={48} loading={pendente} disabled={!pronto || pendente} onClick={() => void salvar()}>
        Salvar
      </Button>
      <Button h={48} variant="default" disabled={pendente} onClick={props.aoCancelar}>
        Cancelar
      </Button>
    </Stack>
  );
}
