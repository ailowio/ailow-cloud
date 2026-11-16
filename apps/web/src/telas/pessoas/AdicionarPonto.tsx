import { useState } from 'react';
import { Group, SegmentedControl, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCircleCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { MOTIVO_AJUSTE_MAX } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { ErroApi } from '../../api/cliente';
import { EstadoVazio } from '../../componentes';
import { ProgressoDoPasso, RodapeDoAssistente, usePassoNoHistorico } from '../../componentes/Assistente';
import { CampoData } from '../../componentes/CampoData';
import { formatarData, hojeEmSaoPaulo, horaEmSaoPaulo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { mensagemAjuste } from './AjustePonto';
import { ROTULO_TIPO_PONTO } from './historico-ponto';
import { PASSOS_PONTO, type PassoPonto, type RascunhoPonto, pontoParaApi, validarPassoPonto } from './ponto-passos';

const TITULOS: Record<PassoPonto, string> = {
  pessoa: 'Para quem é o ponto?',
  quando: 'Quando foi?',
  motivo: 'Qual o motivo?',
  confirmar: 'Confira e salve',
};

const aviso = (message: string, color: 'red' | 'teal') =>
  notifications.show({ message, color, autoClose: color === 'red' ? 4500 : 3500, withCloseButton: false });

const agoraSP = () => ({ hoje: hojeEmSaoPaulo(), hora: horaEmSaoPaulo(new Date().toISOString()) });
const rascunhoVazio = (): RascunhoPonto => ({ pessoa: '', tipo: 'entrada', data: hojeEmSaoPaulo(), hora: '', motivo: '' });

interface Salvo {
  nome: string;
  tipo: 'entrada' | 'saida';
  data: string;
  hora: string;
}

/** RF-PES-03: o Dono adiciona um ponto esquecido em passos curtos (pessoa → quando → motivo → confirmar). */
export function AdicionarPonto(props: { api: Api; aoCancelar: () => void; aoVerHistorico: (mes: string) => void }) {
  const { carga, tentarDeNovo } = useCarregar(() =>
    props.api.usuarios().then((r) => r.usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome }))),
  );
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.length === 0) {
    return <EstadoVazio titulo="Nenhuma pessoa ativa" texto="Cadastre alguém em Gerenciar pessoas para adicionar ponto." />;
  }
  return <Assistente {...props} pessoas={carga.dados} />;
}

function Assistente(props: {
  api: Api;
  pessoas: { id: string; nome: string }[];
  aoCancelar: () => void;
  aoVerHistorico: (mes: string) => void;
}) {
  const navigate = useNavigate();
  const [r, setR] = useState<RascunhoPonto>(rascunhoVazio);
  const [pendente, setPendente] = useState(false);
  const [salvo, setSalvo] = useState<Salvo | null>(null);
  const { atual, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_PONTO);
  const mudar = (parcial: Partial<RascunhoPonto>) => setR((x) => ({ ...x, ...parcial }));
  const nomeDe = (id: string) => props.pessoas.find((p) => p.id === id)?.nome ?? '';

  async function salvar() {
    const corpo = pontoParaApi(r, agoraSP());
    if (!corpo) return;
    setPendente(true);
    try {
      await props.api.adicionarPonto(corpo);
      aviso('Ponto adicionado.', 'teal');
      setSalvo({ nome: nomeDe(r.pessoa), tipo: r.tipo, data: r.data, hora: r.hora });
      // Os passos empurrados no histórico saem: o Voltar do sistema não reabre um assistente já concluído.
      if (indice > 0) navigate(-indice);
    } catch (e) {
      aviso(mensagemAjuste(e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno')), 'red');
    } finally {
      setPendente(false);
    }
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPassoPonto(atual, r, agoraSP());
    if (problema) {
      aviso(problema, 'red');
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  if (salvo) {
    return (
      <Stack gap="md" className="ailow-cartao" p="md" data-resultado-ponto>
        <Group gap="xs" wrap="nowrap">
          <IconCircleCheck size={32} color="var(--mantine-color-teal-6)" aria-hidden />
          <Title order={2} fz="lg">
            Ponto salvo
          </Title>
        </Group>
        <Stack gap={2}>
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {salvo.nome}
          </Text>
          <Text>
            {ROTULO_TIPO_PONTO[salvo.tipo]} em {formatarData(salvo.data)}, {salvo.hora}
          </Text>
        </Stack>
        <RodapeDoAssistente
          rotuloSecundario="Adicionar outro"
          rotuloPrincipal="Ver no histórico"
          aoSecundario={() => {
            setSalvo(null);
            setR(rascunhoVazio());
          }}
          aoPrincipal={() => props.aoVerHistorico(`${salvo.data.slice(0, 7)}-01`)}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md" className="ailow-cartao" p="md" data-assistente={atual}>
      <Title order={2} fz="lg" style={{ overflowWrap: 'anywhere' }}>
        {TITULOS[atual]}
      </Title>
      <ProgressoDoPasso indice={indice} total={PASSOS_PONTO.length} />

      {atual === 'pessoa' && (
        <Stack gap="xs" role="group" aria-label="Pessoa">
          {props.pessoas.map((p) => {
            const marcada = r.pessoa === p.id;
            return (
              <UnstyledButton
                key={p.id}
                className="ailow-bloco"
                mih={56}
                p="sm"
                w="100%"
                aria-pressed={marcada}
                data-destaque={marcada ? 'true' : 'false'}
                onClick={() => mudar({ pessoa: p.id })}
              >
                <Group wrap="nowrap" gap="xs">
                  {marcada && <IconCheck size={20} aria-hidden />}
                  <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                    {p.nome}
                  </Text>
                </Group>
              </UnstyledButton>
            );
          })}
        </Stack>
      )}

      {atual === 'quando' && (
        <Stack gap="lg">
          <SegmentedControl
            fullWidth
            size="lg"
            aria-label="Tipo do ponto"
            data={[
              { value: 'entrada', label: 'Entrada' },
              { value: 'saida', label: 'Saída' },
            ]}
            value={r.tipo}
            onChange={(v) => mudar({ tipo: v as 'entrada' | 'saida' })}
          />
          <CampoData label="Dia" required max={hojeEmSaoPaulo()} value={r.data} onChange={(data) => mudar({ data })} />
          <TextInput label="Hora (de São Paulo)" required type="time" size="lg" value={r.hora} onChange={(e) => mudar({ hora: e.currentTarget.value })} />
        </Stack>
      )}

      {atual === 'motivo' && (
        <TextInput
          label="Motivo (fica guardado no histórico)"
          required
          size="lg"
          maxLength={MOTIVO_AJUSTE_MAX}
          placeholder="Ex.: Esqueceu de bater a entrada"
          value={r.motivo}
          onChange={(e) => mudar({ motivo: e.currentTarget.value })}
        />
      )}

      {atual === 'confirmar' && (
        <Stack gap={4} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {nomeDe(r.pessoa)}
          </Text>
          <Text fz={24} fw={700}>
            {ROTULO_TIPO_PONTO[r.tipo]} às {r.hora}
          </Text>
          <Text>Dia {formatarData(r.data)}</Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            Motivo: {r.motivo.trim()}
          </Text>
        </Stack>
      )}

      <RodapeDoAssistente
        rotuloSecundario={indice === 0 ? 'Cancelar' : 'Voltar'}
        rotuloPrincipal={ultimo ? 'Salvar ponto' : 'Continuar'}
        aoSecundario={indice === 0 ? props.aoCancelar : recuar}
        aoPrincipal={principal}
        ocupado={pendente}
      />
    </Stack>
  );
}
