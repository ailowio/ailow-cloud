import { useEffect, useState } from 'react';
import { Alert, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Empresa as DadosEmpresa } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { Logo } from '../../componentes/Logo';
import { bpsParaPercentual, exemploPrecoCentavos, formatarTelefone, percentualParaBps } from '../../lib/formatos';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { useAcao } from './comum';

interface Props {
  api: Api;
  // Avisa o app quando a trava por inatividade muda, para valer já na sessão atual.
  aoMudarInatividade: (minutos: number) => void;
}

// As duas telas editam o mesmo recurso (PUT /empresa recebe o conjunto inteiro): cada uma carrega o estado
// mais recente do servidor e troca só os campos dela, para uma não desfazer o que a outra salvou.
function useEmpresa(api: Api) {
  const { carga, tentarDeNovo, recarregar } = useCarregar(() => api.empresa());
  return { carga, tentarDeNovo, recarregar };
}

/** RF-CFG-02 (dados da empresa) e RF-ACE-04 (trava por inatividade). */
export function DadosDaEmpresa({ api, aoMudarInatividade }: Props) {
  const { carga, tentarDeNovo, recarregar } = useEmpresa(api);
  if (carga.fase === 'carregando') return <Carregando linhas={4} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <FormDados atual={carga.dados} api={api} aoSalvar={recarregar} aoMudarInatividade={aoMudarInatividade} />;
}

function FormDados(props: { atual: DadosEmpresa; api: Api; aoSalvar: () => Promise<void>; aoMudarInatividade: (m: number) => void }) {
  const { atual } = props;
  const [nome, setNome] = useState(atual.nome);
  const [telefone, setTelefone] = useState(formatarTelefone(atual.telefone));
  const [endereco, setEndereco] = useState(atual.endereco ?? '');
  const [minutos, setMinutos] = useState<number | string>(atual.inatividade_minutos);
  const { pendente, erro, rodar } = useAcao();

  async function salvar() {
    const corpo: DadosEmpresa = {
      ...atual,
      nome: nome.trim(),
      // Vazio = remover (null); o servidor valida e guarda só os dígitos.
      telefone: telefone.trim() === '' ? null : telefone.trim(),
      endereco: endereco.trim() === '' ? null : endereco.trim(),
      inatividade_minutos: typeof minutos === 'number' ? minutos : Number(minutos),
    };
    const ok = await rodar(() => props.api.salvarEmpresa(corpo), 'Dados salvos');
    if (!ok) return;
    props.aoMudarInatividade(corpo.inatividade_minutos);
    await props.aoSalvar();
  }

  return (
    <Stack gap="md">
      {/* RF-CFG-02: o envio da logo da empresa ainda não existe; este espaço mostra o placeholder. */}
      <Group gap="md" wrap="nowrap" align="center">
        <Logo altura={64} alt="Logo da empresa (placeholder)" />
        <Text size="sm" c="dimmed">
          Logo da empresa: o envio chega em breve.
        </Text>
      </Group>
      <TextInput label="Nome da empresa" required size="lg" maxLength={120} value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
      <TextInput
        label="Telefone"
        description="Com DDD."
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(11) 98765-4321"
        size="lg"
        value={telefone}
        onChange={(e) => setTelefone(e.currentTarget.value)}
      />
      <TextInput label="Endereço" size="lg" maxLength={200} value={endereco} onChange={(e) => setEndereco(e.currentTarget.value)} />
      <NumberInput
        label="Travar o app após"
        description="Minutos sem usar. Depois disso, volta para “Quem está usando?”."
        size="lg"
        min={1}
        max={120}
        allowDecimal={false}
        allowNegative={false}
        suffix=" min"
        inputMode="numeric"
        value={minutos}
        onChange={setMinutos}
      />
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button onClick={() => void salvar()} loading={pendente} disabled={!nome.trim() || minutos === ''}>
        Salvar
      </Button>
    </Stack>
  );
}

/** RF-CFG-03: markup padrão (%), usado para sugerir o preço de venda a partir do custo (RN-05). */
export function Markup({ api }: Pick<Props, 'api'>) {
  const { carga, tentarDeNovo, recarregar } = useEmpresa(api);
  if (carga.fase === 'carregando') return <Carregando linhas={2} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <FormMarkup atual={carga.dados} api={api} aoSalvar={recarregar} />;
}

function FormMarkup(props: { atual: DadosEmpresa; api: Api; aoSalvar: () => Promise<void> }) {
  const { atual } = props;
  const [percentual, setPercentual] = useState<number | string>(bpsParaPercentual(atual.markup_bps));
  const { pendente, erro, rodar } = useAcao();
  const bps = percentualParaBps(percentual);

  // Se o servidor devolver outro valor (ex.: outra aba salvou), o campo acompanha.
  useEffect(() => setPercentual(bpsParaPercentual(atual.markup_bps)), [atual.markup_bps]);

  async function salvar() {
    const ok = await rodar(() => props.api.salvarEmpresa({ ...atual, markup_bps: bps }), 'Markup salvo');
    if (ok) await props.aoSalvar();
  }

  return (
    <Stack gap="md">
      <NumberInput
        label="Markup padrão"
        description="Quanto somar ao custo para sugerir o preço de venda. O preço continua editável."
        size="lg"
        min={0}
        max={1000}
        decimalScale={2}
        decimalSeparator=","
        thousandSeparator="."
        allowNegative={false}
        suffix=" %"
        inputMode="decimal"
        value={percentual}
        onChange={setPercentual}
      />
      <Text size="sm" aria-live="polite">
        Exemplo: uma peça que custa <Valor centavos={10_000} /> sai sugerida por <Valor centavos={exemploPrecoCentavos(bps)} destaque />.
      </Text>
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button onClick={() => void salvar()} loading={pendente} disabled={percentual === ''}>
        Salvar markup
      </Button>
    </Stack>
  );
}
