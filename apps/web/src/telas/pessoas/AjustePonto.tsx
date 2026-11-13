import { useState } from 'react';
import { Alert, Button, NativeSelect, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { Modal } from '../../componentes/navegacao';
import type { Marca } from '@ailow/shared';
import { MOTIVO_AJUSTE_MAX, diaDoPonto } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { ErroApi } from '../../api/cliente';
import { formatarData, hojeEmSaoPaulo, horaEmSaoPaulo } from '../../lib/datas';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';

const ROTULO_TIPO = { entrada: 'Entrada', saida: 'Saída' } as const;

export function mensagemAjuste(e: ErroApi): string {
  switch (e.codigo) {
    case 'comecar_com_entrada':
      return 'O primeiro registro da pessoa precisa ser uma entrada.';
    case 'nao_alterna':
      return 'Entradas e saídas precisam se alternar. Confira se não falta ou sobra um registro.';
    case 'horario_repetido':
      return 'Já existe um registro dessa pessoa neste horário.';
    case 'no_futuro':
      return 'Não dá para registrar um horário que ainda não chegou.';
    case 'nao_encontrado':
      return 'Esse registro não existe mais. Atualize a tela.';
    default:
      return 'Não foi possível salvar. Tente de novo.';
  }
}

/** Adicionar ponto esquecido (RF-PES-03): escolhe a pessoa, o tipo, o dia, a hora e o motivo. */
export function AdicionarPonto(props: { api: Api; aoFechar: () => void; aoMudou: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(() => props.api.usuarios());
  return (
    <Modal opened onClose={props.aoFechar} title="Adicionar ponto" fullScreen closeButtonProps={fecharModal}>
      {carga.fase === 'carregando' && <Carregando linhas={3} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && (
        <FormNovo
          api={props.api}
          pessoas={carga.dados.usuarios.filter((u) => u.ativo).map((u) => ({ id: u.id, nome: u.nome }))}
          aoFechar={props.aoFechar}
          aoMudou={props.aoMudou}
        />
      )}
    </Modal>
  );
}

function FormNovo(props: {
  api: Api;
  pessoas: { id: string; nome: string }[];
  aoFechar: () => void;
  aoMudou: () => void;
}) {
  const hoje = hojeEmSaoPaulo();
  const [pessoa, setPessoa] = useState(props.pessoas[0]?.id ?? '');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada');
  const [data, setData] = useState(hoje);
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const { pendente, erro, rodar } = useAcao(mensagemAjuste);
  const pronto = pessoa !== '' && data !== '' && hora !== '' && motivo.trim() !== '';

  async function salvar() {
    const ok = await rodar(
      () => props.api.adicionarPonto({ usuario_id: pessoa, tipo, data, hora, motivo: motivo.trim() }),
      'Ponto adicionado.',
    );
    if (ok) {
      props.aoMudou();
      props.aoFechar();
    }
  }

  return (
    <Stack gap="md">
      <NativeSelect
        label="Pessoa"
        size="lg"
        data={props.pessoas.map((p) => ({ value: p.id, label: p.nome }))}
        value={pessoa}
        onChange={(e) => setPessoa(e.currentTarget.value)}
      />
      <SegmentedControl
        fullWidth
        size="lg"
        data={[
          { value: 'entrada', label: 'Entrada' },
          { value: 'saida', label: 'Saída' },
        ]}
        value={tipo}
        onChange={(v) => setTipo(v as 'entrada' | 'saida')}
      />
      <Campos data={data} hora={hora} motivo={motivo} hoje={hoje} aoData={setData} aoHora={setHora} aoMotivo={setMotivo} />
      {erro && (
        <Alert color="red" role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} loading={pendente} disabled={!pronto} onClick={() => void salvar()}>
        Salvar
      </Button>
      <Button h={48} variant="default" onClick={props.aoFechar}>
        Cancelar
      </Button>
    </Stack>
  );
}

function Campos(props: {
  data: string;
  hora: string;
  motivo: string;
  hoje: string;
  aoData: (v: string) => void;
  aoHora: (v: string) => void;
  aoMotivo: (v: string) => void;
}) {
  return (
    <>
      <TextInput label="Dia" type="date" size="lg" max={props.hoje} value={props.data} onChange={(e) => props.aoData(e.currentTarget.value)} />
      <TextInput label="Hora (de São Paulo)" type="time" size="lg" value={props.hora} onChange={(e) => props.aoHora(e.currentTarget.value)} />
      <TextInput
        label="Motivo (fica guardado no histórico)"
        size="lg"
        maxLength={MOTIVO_AJUSTE_MAX}
        value={props.motivo}
        onChange={(e) => props.aoMotivo(e.currentTarget.value)}
      />
    </>
  );
}

/** Editar o horário ou excluir um ponto existente (RF-PES-03). Excluir pede confirmação. */
export function AjustarMarca(props: { api: Api; marca: Marca; nome: string; aoFechar: () => void; aoMudou: () => void }) {
  const { marca } = props;
  const hoje = hojeEmSaoPaulo();
  const [data, setData] = useState(diaDoPonto(marca.registrado_em));
  const [hora, setHora] = useState(horaEmSaoPaulo(marca.registrado_em));
  const [motivo, setMotivo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const { pendente, erro, rodar } = useAcao(mensagemAjuste);
  const pronto = data !== '' && hora !== '' && motivo.trim() !== '';

  async function aplicar(acao: () => Promise<unknown>, sucesso: string) {
    const ok = await rodar(acao, sucesso);
    if (ok) {
      props.aoMudou();
      props.aoFechar();
    }
  }

  return (
    <Modal opened onClose={props.aoFechar} title="Ajustar ponto" fullScreen closeButtonProps={fecharModal}>
      <Stack gap="md">
        <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
          {props.nome} · {ROTULO_TIPO[marca.tipo]} de {formatarData(diaDoPonto(marca.registrado_em))}, {horaEmSaoPaulo(marca.registrado_em)}
        </Text>
        <Campos data={data} hora={hora} motivo={motivo} hoje={hoje} aoData={setData} aoHora={setHora} aoMotivo={setMotivo} />
        {erro && (
          <Alert color="red" role="alert">
            {erro}
          </Alert>
        )}
        {!confirmando && (
          <>
            <Button
              h={48}
              loading={pendente}
              disabled={!pronto}
              onClick={() => void aplicar(() => props.api.editarPonto(marca.id, { data, hora, motivo: motivo.trim() }), 'Horário atualizado.')}
            >
              Salvar horário
            </Button>
            <Button h={48} variant="outline" color="red" disabled={motivo.trim() === ''} onClick={() => setConfirmando(true)}>
              Excluir este ponto
            </Button>
          </>
        )}
        {confirmando && (
          <Alert color="red" title="Excluir este ponto?">
            <Stack gap="sm">
              <Text size="sm">O registro sai do espelho e das horas, mas fica guardado no histórico de ajustes com o motivo.</Text>
              <Button
                h={48}
                color="red"
                loading={pendente}
                onClick={() => void aplicar(() => props.api.excluirPonto(marca.id, { motivo: motivo.trim() }), 'Ponto excluído.')}
              >
                Sim, excluir
              </Button>
              <Button h={48} variant="default" onClick={() => setConfirmando(false)}>
                Voltar
              </Button>
            </Stack>
          </Alert>
        )}
        {!confirmando && (
          <Button h={48} variant="default" onClick={props.aoFechar}>
            Cancelar
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
