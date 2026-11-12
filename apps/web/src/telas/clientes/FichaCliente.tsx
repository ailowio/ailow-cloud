import { useState } from 'react';
import { Alert, Button, Modal, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconBrandWhatsapp } from '@tabler/icons-react';
import type { Cliente } from '@ailow/shared';
import { linkWhatsApp, mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { dataDoDia, linhaDoAviso, mensagemClientes } from './rotulos';

/**
 * Ficha do cliente (RF-CLI-02/03/04), em tela cheia no celular: contato com o botão do WhatsApp, o aviso de
 * finalidade, o histórico de compras e, só para o Dono, apagar os dados a pedido do cliente.
 */
export function FichaCliente(props: {
  api: Api;
  dono: boolean;
  id: string;
  aoFechar: () => void;
  // Avisa a lista que algo mudou (ela busca de novo ao fechar a ficha).
  aoMudar: () => void;
}) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => props.api.cliente(props.id));
  const [mudou, setMudou] = useState(false);

  function fechar() {
    if (mudou) props.aoMudar();
    props.aoFechar();
  }

  return (
    <Modal opened onClose={fechar} title="Cliente" fullScreen closeButtonProps={fecharModal}>
      <Stack gap="lg">
        {carga.fase === 'carregando' && <Carregando linhas={3} />}
        {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
        {carga.fase === 'pronto' && (
          <Conteudo
            api={props.api}
            dono={props.dono}
            cliente={carga.dados}
            aoAvisar={() => {
              setMudou(true);
              void recarregar();
            }}
            aoApagar={() => {
              props.aoMudar();
              props.aoFechar();
            }}
          />
        )}
        <Button h={48} variant="default" onClick={fechar}>
          Fechar
        </Button>
      </Stack>
    </Modal>
  );
}

function Conteudo(props: { api: Api; dono: boolean; cliente: Cliente; aoAvisar: () => void; aoApagar: () => void }) {
  const { cliente: c } = props;

  // Depois de apagar os dados só resta a data; não há contato nem aviso a registrar.
  if (c.anonimizado_em !== null) {
    return (
      <Stack gap="xs" className="ailow-cartao" p="md">
        <Text fw={700} fz="xl">
          {c.nome}
        </Text>
        <Text c="dimmed">Os dados deste cliente foram apagados em {dataDoDia(c.anonimizado_em)}.</Text>
      </Stack>
    );
  }

  return (
    <>
      <Stack gap={2}>
        <Text fw={700} fz="xl" style={{ overflowWrap: 'anywhere' }}>
          {c.nome}
        </Text>
        {c.celular !== null && (
          <Text c="dimmed" fz="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {mascararCelular(c.celular)}
          </Text>
        )}
      </Stack>

      {c.celular !== null && (
        <Button
          component="a"
          href={linkWhatsApp(c.celular)}
          target="_blank"
          rel="noopener noreferrer"
          h={48}
          leftSection={<IconBrandWhatsapp aria-hidden />}
        >
          Chamar no WhatsApp
        </Button>
      )}

      <Aviso api={props.api} cliente={c} aoAvisar={props.aoAvisar} />

      <Stack gap="xs" className="ailow-cartao" p="md">
        <Text fw={650} fz="lg">
          Compras
        </Text>
        <Text c="dimmed" size="sm">
          Nenhuma compra registrada ainda. Quando as vendas começarem, o que este cliente comprar aparece aqui.
        </Text>
      </Stack>

      {props.dono && <ApagarDados api={props.api} id={c.id} aoApagar={props.aoApagar} />}
    </>
  );
}

function Aviso(props: { api: Api; cliente: Cliente; aoAvisar: () => void }) {
  const { pendente, erro, rodar } = useAcao(mensagemClientes);
  const avisado = props.cliente.aviso_lgpd_em !== null;

  async function registrar() {
    if (await rodar(() => props.api.avisarCliente(props.cliente.id), 'Aviso registrado')) props.aoAvisar();
  }

  return (
    <Stack gap="xs" className="ailow-cartao" p="md">
      <Text fw={650} fz="lg">
        Aviso sobre o celular
      </Text>
      <Text style={{ overflowWrap: 'anywhere' }}>{linhaDoAviso(props.cliente.aviso_lgpd_em)}</Text>
      {!avisado && (
        <Text c="dimmed" size="sm">
          Avise o cliente que o número serve para falar da compra e das novidades da loja e toque no botão abaixo.
        </Text>
      )}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      {!avisado && (
        <Button h={48} variant="default" onClick={() => void registrar()} loading={pendente}>
          Registrar que avisei
        </Button>
      )}
    </Stack>
  );
}

/** RF-CLI-04: "excluir" é apagar nome e celular; as vendas continuam, sem os dados pessoais. Pede confirmação. */
function ApagarDados(props: { api: Api; id: string; aoApagar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const { pendente, erro, rodar } = useAcao(mensagemClientes);

  async function apagar() {
    if (await rodar(() => props.api.anonimizarCliente(props.id), 'Dados do cliente apagados')) props.aoApagar();
  }

  if (!confirmando) {
    return (
      <Button h={48} variant="outline" color="red" onClick={() => setConfirmando(true)}>
        Apagar dados do cliente
      </Button>
    );
  }
  return (
    <Stack gap="sm" className="ailow-cartao" p="md" role="group" aria-label="Confirmar a exclusão dos dados">
      <Text fw={650}>Apagar o nome e o celular deste cliente?</Text>
      <Text size="sm">
        Isso não pode ser desfeito. As vendas já feitas continuam registradas, mas sem os dados do cliente.
      </Text>
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} color="red" onClick={() => void apagar()} loading={pendente}>
        Sim, apagar os dados
      </Button>
      <Button h={48} variant="default" onClick={() => setConfirmando(false)} disabled={pendente}>
        Não, manter
      </Button>
    </Stack>
  );
}
