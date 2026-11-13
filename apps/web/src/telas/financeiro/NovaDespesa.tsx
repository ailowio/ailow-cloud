import { useState } from 'react';
import { Group, Stack, Switch, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import type { FormaPagamento } from '@ailow/shared';
import { ErroApi } from '../../api/cliente';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { ProgressoDoPasso, RodapeDoAssistente, usePassoNoHistorico } from '../../componentes/Assistente';
import { CampoData } from '../../componentes/CampoData';
import { formatarData, hojeEmSaoPaulo } from '../../lib/datas';
import { formatarReais } from '../../lib/dinheiro';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { CampoDinheiro } from '../produtos/CampoDinheiro';
import { PASSOS_DESPESA, type PassoDespesa, type RascunhoDespesa, despesaParaApi, validarPasso } from './despesa-passos';
import { EscolhaForma } from './Modais';
import { mensagemFinanceiro, rotuloForma } from './rotulos';

const TITULOS: Record<PassoDespesa, string> = {
  categoria: 'Que tipo de despesa é?',
  valor: 'Quanto é?',
  quando: 'Quando vence?',
  confirmar: 'Confira e salve',
};

const avisoErro = (message: string) => notifications.show({ message, color: 'red', autoClose: 4500, withCloseButton: false });

/** RF-FIN-02: nova despesa em passos curtos (tipo → valor → vencimento → confirmar); pode já nascer paga. */
export function NovaDespesa(props: { api: Api; aoSalvar: (paga: boolean) => void; aoCancelar: () => void }) {
  // A categoria é uma das categorias FINANCEIRAS ativas da empresa (Configurações › Categorias).
  const { carga, tentarDeNovo } = useCarregar(() =>
    props.api.categorias('financeira').then((r) => r.categorias.filter((c) => c.ativa).map((c) => c.nome)),
  );
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma categoria financeira"
        texto="Para lançar uma despesa, cadastre antes uma categoria em Configurações › Categorias › Financeiras."
      />
    );
  }
  return <Assistente api={props.api} categorias={carga.dados} aoSalvar={props.aoSalvar} aoCancelar={props.aoCancelar} />;
}

function Assistente(props: { api: Api; categorias: string[]; aoSalvar: (paga: boolean) => void; aoCancelar: () => void }) {
  const [r, setR] = useState<RascunhoDespesa>(() => ({
    categoria: '',
    descricao: '',
    valor: null,
    vencimento: hojeEmSaoPaulo(),
    paga: false,
    forma: null,
  }));
  const [pendente, setPendente] = useState(false);
  const { atual, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_DESPESA);
  const mudar = (parcial: Partial<RascunhoDespesa>) => setR((x) => ({ ...x, ...parcial }));

  async function salvar() {
    const corpo = despesaParaApi(r);
    if (!corpo) return;
    setPendente(true);
    try {
      await props.api.novaDespesa(corpo);
      notifications.show({
        message: r.paga ? 'Despesa salva e paga' : 'Despesa salva em contas a pagar',
        color: 'teal',
        autoClose: 3500,
        withCloseButton: false,
      });
      props.aoSalvar(r.paga);
    } catch (e) {
      avisoErro(mensagemFinanceiro(e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno')));
      setPendente(false);
    }
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPasso(atual, r);
    if (problema) {
      avisoErro(problema);
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  return (
    <Stack gap="md" className="ailow-cartao" p="md" data-assistente={atual}>
      <Title order={2} fz="lg" style={{ overflowWrap: 'anywhere' }}>
        {TITULOS[atual]}
      </Title>
      <ProgressoDoPasso indice={indice} total={PASSOS_DESPESA.length} />

      {atual === 'categoria' && (
        <Stack gap="xs" role="group" aria-label="Tipo de despesa">
          {props.categorias.map((nome) => {
            const marcada = r.categoria === nome;
            return (
              <UnstyledButton
                key={nome}
                className="ailow-bloco"
                mih={56}
                p="sm"
                w="100%"
                aria-pressed={marcada}
                data-destaque={marcada ? 'true' : 'false'}
                onClick={() => mudar({ categoria: nome })}
              >
                <Group wrap="nowrap" gap="xs">
                  {marcada && <IconCheck size={20} aria-hidden />}
                  <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                    {nome}
                  </Text>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      )}

      {atual === 'valor' && (
        <Stack gap="lg">
          <CampoDinheiro label="Valor" valor={r.valor} aoMudar={(valor) => mudar({ valor })} descricao="Até R$ 20 milhões." />
          <TextInput
            label="O que é?"
            required
            size="lg"
            maxLength={120}
            placeholder="Ex.: Condomínio de novembro"
            value={r.descricao}
            onChange={(e) => mudar({ descricao: e.currentTarget.value })}
          />
        </Stack>
      )}

      {atual === 'quando' && (
        <Stack gap="lg">
          <CampoData label="Vence em" required value={r.vencimento} onChange={(vencimento) => mudar({ vencimento })} />
          <Switch
            size="lg"
            label="Já foi paga"
            description="Se ligar, o dinheiro sai hoje e a conta não vai para “A pagar”."
            checked={r.paga}
            onChange={(e) => mudar({ paga: e.currentTarget.checked, forma: e.currentTarget.checked ? r.forma : null })}
          />
          {r.paga && <EscolhaForma rotulo="Como foi pago?" valor={r.forma} aoMudar={(forma: FormaPagamento) => mudar({ forma })} />}
        </Stack>
      )}

      {atual === 'confirmar' && (
        <Stack gap={4} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {r.descricao.trim()}
          </Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {r.categoria}
          </Text>
          <Text fz={28} fw={700}>
            {formatarReais(r.valor ?? 0)}
          </Text>
          <Text>Vence em {formatarData(r.vencimento)}</Text>
          <Text>{r.paga && r.forma ? `Já paga (${rotuloForma(r.forma)})` : 'Fica em contas a pagar'}</Text>
        </Stack>
      )}

      <RodapeDoAssistente
        rotuloSecundario={indice === 0 ? 'Cancelar' : 'Voltar'}
        rotuloPrincipal={ultimo ? 'Salvar despesa' : 'Continuar'}
        aoSecundario={indice === 0 ? props.aoCancelar : recuar}
        aoPrincipal={principal}
        ocupado={pendente}
      />
    </Stack>
  );
}
