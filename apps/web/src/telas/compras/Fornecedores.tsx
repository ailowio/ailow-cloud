import { useEffect, useState } from 'react';
import { Button, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import type { Fornecedor } from '@ailow/shared';
import { mascararCelular, normalizarCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { QuadroDoAssistente, avisoDoPasso, usePassoNoHistorico } from '../../componentes/Assistente';
import { useSalvarComToast } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import {
  PASSOS_FORNECEDOR,
  type PassoFornecedor,
  type RascunhoFornecedor,
  fornecedorParaApi,
  validarPassoFornecedor,
} from './fornecedor-passos';
import { mensagemCompras } from './rotulos';

type Vista = 'lista' | 'novo' | 'editar';

const TITULOS: Record<PassoFornecedor, string> = {
  nome: 'Qual é o nome do fornecedor?',
  contato: 'Como falar com ele?',
  confirmar: 'Confira e salve',
};

/** RF-COM-01: lista, cadastro e edição de fornecedores (cadastro e edição em passos, S13). */
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
  const [r, setR] = useState<RascunhoFornecedor>(() => ({
    nome: props.inicial?.nome ?? '',
    whatsapp: props.inicial ? mascararCelular(props.inicial.whatsapp) : '',
    cnpj: props.inicial?.cnpj ?? '',
  }));
  const { atual, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_FORNECEDOR);
  const { pendente, rodar } = useSalvarComToast(mensagemCompras);
  const mudar = (parcial: Partial<RascunhoFornecedor>) => setR((x) => ({ ...x, ...parcial }));
  const numero = normalizarCelular(r.whatsapp);

  async function salvar() {
    const corpo = fornecedorParaApi(r);
    if (!corpo) return;
    const ok = await rodar(
      () => (props.inicial ? props.api.editarFornecedor(props.inicial.id, corpo) : props.api.criarFornecedor(corpo)),
      props.inicial ? 'Fornecedor atualizado' : 'Fornecedor cadastrado',
    );
    if (ok) props.aoSalvar();
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPassoFornecedor(atual, r);
    if (problema) {
      avisoDoPasso(problema);
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  return (
    <QuadroDoAssistente
      passo={atual}
      titulo={TITULOS[atual]}
      indice={indice}
      total={PASSOS_FORNECEDOR.length}
      rotuloPrincipal={ultimo ? 'Salvar fornecedor' : 'Continuar'}
      aoPrincipal={principal}
      aoCancelar={props.aoCancelar}
      aoVoltar={recuar}
      ocupado={pendente}
    >
      {atual === 'nome' && (
        <TextInput
          label="Nome"
          required
          size="lg"
          maxLength={80}
          autoComplete="off"
          placeholder="Ex.: Malhas Sul"
          value={r.nome}
          onChange={(e) => mudar({ nome: e.currentTarget.value })}
        />
      )}

      {atual === 'contato' && (
        <Stack gap="lg">
          <TextInput
            label="WhatsApp com DDD"
            required
            size="lg"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={40}
            placeholder="(11) 91234-5678"
            value={r.whatsapp}
            onChange={(e) => mudar({ whatsapp: e.currentTarget.value })}
            description={numero !== null ? `Fica ${mascararCelular(numero)}` : 'O pedido é enviado por este número.'}
          />
          <TextInput
            label="CNPJ (opcional)"
            size="lg"
            inputMode="numeric"
            autoComplete="off"
            maxLength={22}
            placeholder="12.345.678/0001-95"
            value={r.cnpj}
            onChange={(e) => mudar({ cnpj: e.currentTarget.value })}
          />
        </Stack>
      )}

      {atual === 'confirmar' && (
        <Stack gap={4} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {r.nome.trim()}
          </Text>
          <Text c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {numero !== null ? mascararCelular(numero) : r.whatsapp}
          </Text>
          <Text>{r.cnpj.trim() === '' ? 'Sem CNPJ' : `CNPJ ${r.cnpj.trim()}`}</Text>
        </Stack>
      )}
    </QuadroDoAssistente>
  );
}
