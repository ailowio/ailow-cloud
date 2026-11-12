import { useState } from 'react';
import { Alert, Badge, Button, Modal, Stack, Text } from '@mantine/core';
import { IconAlertCircle, IconBrandWhatsapp } from '@tabler/icons-react';
import type { Cliente } from '@ailow/shared';
import { linkWhatsApp, mascararCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { fecharModal, useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { FormCliente } from './FormCliente';
import { linhaDoAviso, mensagemClientes } from './rotulos';

/**
 * Ficha do cliente (RF-CLI-02…05), em tela cheia no celular: contato com o botão do WhatsApp, correção de nome e
 * celular, o aviso de finalidade, o histórico de compras e, só para o Dono, inativar/reativar e excluir.
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
  // Algo mudou nesta ficha: ela se recarrega e a lista, ao fechar, também.
  function aoMudarAqui() {
    setMudou(true);
    void recarregar();
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
            aoMudar={aoMudarAqui}
            aoExcluir={() => {
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

function Conteudo(props: { api: Api; dono: boolean; cliente: Cliente; aoMudar: () => void; aoExcluir: () => void }) {
  const { cliente: c } = props;
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <Stack gap="md">
        <Text fw={700} fz="xl">
          Corrigir dados
        </Text>
        <FormCliente
          inicial={{ nome: c.nome, celular: c.celular }}
          rotuloSalvar="Salvar correção"
          sucesso="Dados corrigidos"
          salvar={(d) => props.api.editarCliente(c.id, { nome: d.nome, celular: d.celular })}
          aoSalvo={() => {
            setEditando(false);
            props.aoMudar();
          }}
          aoCancelar={() => setEditando(false)}
        />
      </Stack>
    );
  }

  return (
    <>
      <Stack gap={2}>
        {!c.ativo && (
          <Badge color="gray" size="lg" w="fit-content">
            Inativo
          </Badge>
        )}
        <Text fw={700} fz="xl" style={{ overflowWrap: 'anywhere' }}>
          {c.nome}
        </Text>
        <Text c="dimmed" fz="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mascararCelular(c.celular)}
        </Text>
      </Stack>

      <Stack gap="xs">
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
        <Button h={48} variant="default" onClick={() => setEditando(true)}>
          Corrigir nome ou celular
        </Button>
      </Stack>

      <Aviso api={props.api} cliente={c} aoAvisar={props.aoMudar} />

      <Stack gap="xs" className="ailow-cartao" p="md">
        <Text fw={650} fz="lg">
          Compras
        </Text>
        <Text c="dimmed" size="sm">
          Nenhuma compra registrada ainda. Quando as vendas começarem, o que este cliente comprar aparece aqui.
        </Text>
      </Stack>

      {props.dono && <AcoesDoDono api={props.api} cliente={c} aoMudar={props.aoMudar} aoExcluir={props.aoExcluir} />}
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

/**
 * RF-CLI-04, só o Dono. Inativar é leve e reversível (some da lista, o número continua reservado). Excluir apaga
 * a linha do banco, não dá para desfazer e por isso pede confirmação.
 */
function AcoesDoDono(props: { api: Api; cliente: Cliente; aoMudar: () => void; aoExcluir: () => void }) {
  const { cliente: c } = props;
  const [confirmando, setConfirmando] = useState(false);
  const situacao = useAcao(mensagemClientes);
  const exclusao = useAcao(mensagemClientes);

  async function mudarSituacao() {
    const ok = await situacao.rodar(
      () => (c.ativo ? props.api.inativarCliente(c.id) : props.api.reativarCliente(c.id)),
      c.ativo ? 'Cliente inativado' : 'Cliente reativado',
    );
    if (ok) props.aoMudar();
  }

  async function excluir() {
    if (await exclusao.rodar(() => props.api.excluirCliente(c.id), 'Cliente excluído')) props.aoExcluir();
  }

  return (
    <Stack gap="sm">
      <Stack gap="xs">
        <Button h={48} variant={c.ativo ? 'default' : 'filled'} onClick={() => void mudarSituacao()} loading={situacao.pendente}>
          {c.ativo ? 'Inativar cliente' : 'Reativar cliente'}
        </Button>
        <Text c="dimmed" size="sm">
          {c.ativo
            ? 'Some da lista, mas o número continua reservado. Dá para reativar depois.'
            : 'Este cliente não aparece na lista de ativos. Reative para voltar a usá-lo.'}
        </Text>
        {situacao.erro && (
          <Alert color="red" icon={<IconAlertCircle />} role="alert">
            {situacao.erro}
          </Alert>
        )}
      </Stack>

      {!confirmando ? (
        <Button h={48} variant="outline" color="red" onClick={() => setConfirmando(true)}>
          Excluir cliente
        </Button>
      ) : (
        <Stack gap="sm" className="ailow-cartao" p="md" role="group" aria-label="Confirmar a exclusão do cliente">
          <Text fw={650}>Excluir este cliente de vez?</Text>
          <Text size="sm">
            O nome e o celular são apagados do sistema e não dá para desfazer. Se é só para tirar da lista, use “Inativar”.
          </Text>
          {exclusao.erro && (
            <Alert color="red" icon={<IconAlertCircle />} role="alert">
              {exclusao.erro}
            </Alert>
          )}
          <Button h={48} color="red" onClick={() => void excluir()} loading={exclusao.pendente}>
            Sim, excluir de vez
          </Button>
          <Button h={48} variant="default" onClick={() => setConfirmando(false)} disabled={exclusao.pendente}>
            Não, manter
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
