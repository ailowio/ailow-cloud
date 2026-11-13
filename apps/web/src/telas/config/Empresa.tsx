import { useEffect, useRef, useState } from 'react';
import { Button, FileButton, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import type { Empresa as DadosEmpresa } from '@ailow/shared';
import { LOGO_MAX_BYTES } from '@ailow/shared';
import { ErroApi } from '../../api/cliente';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { Logo } from '../../componentes/Logo';
import { bpsParaPercentual, exemploPrecoCentavos, formatarTelefone, percentualParaBps } from '../../lib/formatos';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { QuadroDoAssistente, avisoDoPasso, usePassoNoHistorico } from '../../componentes/Assistente';
import { useAcao, useSalvarComToast } from './comum';
import {
  PASSOS_EMPRESA,
  type PassoEmpresa,
  type RascunhoEmpresa,
  empresaParaApi,
  validarPassoEmpresa,
} from './empresa-passos';

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
export function DadosDaEmpresa({ api, aoMudarInatividade, aoConcluir }: Props & { aoConcluir: () => void }) {
  const { carga, tentarDeNovo, recarregar } = useEmpresa(api);
  if (carga.fase === 'carregando') return <Carregando linhas={4} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return (
    <FormDados atual={carga.dados} api={api} aoSalvar={recarregar} aoMudarInatividade={aoMudarInatividade} aoConcluir={aoConcluir} />
  );
}

const TITULOS: Record<PassoEmpresa, string> = {
  nome: 'Como se chama a empresa?',
  contato: 'Como falar com a empresa?',
  trava: 'Quando travar o app?',
  confirmar: 'Confira e salve',
};

/** Dados da empresa em passos curtos (nome e logo → contato → trava → confirmar, S13). */
function FormDados(props: {
  atual: DadosEmpresa;
  api: Api;
  aoSalvar: () => Promise<void>;
  aoMudarInatividade: (m: number) => void;
  aoConcluir: () => void;
}) {
  const { atual } = props;
  const [r, setR] = useState<RascunhoEmpresa>({
    nome: atual.nome,
    telefone: formatarTelefone(atual.telefone),
    endereco: atual.endereco ?? '',
    minutos: atual.inatividade_minutos,
  });
  const [logoVersao, setLogoVersao] = useState(0);
  const resetArquivo = useRef<() => void>(null);
  const { atual: passo, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_EMPRESA);
  const { pendente, rodar } = useSalvarComToast();
  const mudar = (parcial: Partial<RascunhoEmpresa>) => setR((x) => ({ ...x, ...parcial }));

  async function salvar() {
    const campos = empresaParaApi(r);
    if (!campos) return;
    const { tem_logo: _ignorado, ...resto } = atual;
    const corpo = { ...resto, ...campos };
    const ok = await rodar(() => props.api.salvarEmpresa(corpo), 'Dados salvos');
    if (!ok) return;
    props.aoMudarInatividade(corpo.inatividade_minutos);
    await props.aoSalvar();
    props.aoConcluir();
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPassoEmpresa(passo, r);
    if (problema) {
      avisoDoPasso(problema);
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  async function aoEscolherLogo(arquivo: File | null) {
    if (!arquivo) return;
    const ok = await rodar(async () => {
      if (arquivo.size > LOGO_MAX_BYTES) {
        throw new ErroApi(400, 'requisicao_invalida', `logo até ${LOGO_MAX_BYTES} bytes`);
      }
      return props.api.enviarLogo(arquivo);
    }, 'Logo atualizada');
    resetArquivo.current?.();
    if (!ok) return;
    setLogoVersao((v) => v + 1);
    await props.aoSalvar();
  }

  async function removerLogo() {
    const ok = await rodar(() => props.api.removerLogo(), 'Logo removida');
    if (!ok) return;
    setLogoVersao((v) => v + 1);
    await props.aoSalvar();
  }

  return (
    <QuadroDoAssistente
      passo={passo}
      titulo={TITULOS[passo]}
      indice={indice}
      total={PASSOS_EMPRESA.length}
      rotuloPrincipal={ultimo ? 'Salvar dados' : 'Continuar'}
      aoPrincipal={principal}
      aoCancelar={props.aoConcluir}
      aoVoltar={recuar}
      ocupado={pendente}
    >
      {passo === 'nome' && (
        <Stack gap="md">
      {/* RF-CFG-02: upload PNG/JPEG/WebP; sem SVG (XSS). */}
      <Stack gap="xs">
        <Group gap="md" wrap="nowrap" align="center">
          <Logo
            key={logoVersao}
            altura={64}
            alt={atual.tem_logo ? 'Logo da empresa' : 'Logo padrão do app'}
            empresa
            versao={logoVersao}
          />
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600}>
              Logo da empresa
            </Text>
            <Text size="sm" c="dimmed">
              PNG, JPEG ou WebP, até 512 KiB. Sem logo, o app usa o marcador padrão.
            </Text>
          </Stack>
        </Group>
        <Group gap="sm" wrap="wrap">
          <FileButton resetRef={resetArquivo} onChange={(f) => void aoEscolherLogo(f)} accept="image/png,image/jpeg,image/webp">
            {(props) => (
              <Button {...props} variant="default" size="md" h={48} loading={pendente}>
                {atual.tem_logo ? 'Trocar logo' : 'Enviar logo'}
              </Button>
            )}
          </FileButton>
          {atual.tem_logo && (
            <Button variant="subtle" color="red" size="md" h={48} onClick={() => void removerLogo()} loading={pendente}>
              Remover
            </Button>
          )}
        </Group>
      </Stack>
      <TextInput label="Nome da empresa" required size="lg" maxLength={120} value={r.nome} onChange={(e) => mudar({ nome: e.currentTarget.value })} />
        </Stack>
      )}

      {passo === 'contato' && (
        <Stack gap="lg">
          <TextInput
            label="Telefone"
            description="Com DDD. Pode deixar em branco."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            size="lg"
            value={r.telefone}
            onChange={(e) => mudar({ telefone: e.currentTarget.value })}
          />
          <TextInput label="Endereço" size="lg" maxLength={200} value={r.endereco} onChange={(e) => mudar({ endereco: e.currentTarget.value })} />
        </Stack>
      )}

      {passo === 'trava' && (
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
          value={r.minutos}
          onChange={(minutos) => mudar({ minutos })}
        />
      )}

      {passo === 'confirmar' && (
        <Stack gap={4} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {r.nome.trim()}
          </Text>
          <Text style={{ overflowWrap: 'anywhere' }}>{r.telefone.trim() === '' ? 'Sem telefone' : r.telefone.trim()}</Text>
          <Text style={{ overflowWrap: 'anywhere' }}>{r.endereco.trim() === '' ? 'Sem endereço' : r.endereco.trim()}</Text>
          <Text>Trava o app após {r.minutos} min sem usar</Text>
        </Stack>
      )}
    </QuadroDoAssistente>
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
  const { pendente, rodar } = useAcao();
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
      <Button onClick={() => void salvar()} loading={pendente} disabled={percentual === ''}>
        Salvar markup
      </Button>
    </Stack>
  );
}
