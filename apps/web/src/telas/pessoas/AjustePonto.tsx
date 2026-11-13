import { useState } from 'react';
import { Alert, Button, Stack, Text, TextInput } from '@mantine/core';
import { CampoData } from '../../componentes/CampoData';
import { Modal } from '../../componentes/navegacao';
import type { Marca } from '@ailow/shared';
import { MOTIVO_AJUSTE_MAX, diaDoPonto } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { ErroApi } from '../../api/cliente';
import { formatarData, hojeEmSaoPaulo, horaEmSaoPaulo } from '../../lib/datas';
import { fecharModal, useAcao } from '../config/comum';

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
      <CampoData label="Dia" max={props.hoje} value={props.data} onChange={props.aoData} />
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
  const { pendente, rodar } = useAcao(mensagemAjuste);
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
