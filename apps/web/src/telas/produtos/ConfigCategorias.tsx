import { useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Modal } from '../../componentes/navegacao';
import { ListaCategorias } from '../config/Categorias';
import { fecharModal } from '../config/comum';

/**
 * Engrenagem de configuração (S10): abre, em pop-up, a mesma gestão de categorias de produto de
 * Configurações › Categorias (criar, editar, desativar). Ao fechar, `aoFechar` avisa para a tela buscar de novo.
 * Tamanhos e cores ainda não têm gestão aqui: são listas fixas no código (decisão pendente do Dono).
 */
export function BotaoConfigCategorias(props: { api: Api; aoFechar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <ActionIcon variant="default" size={48} aria-label="Configurar categorias" onClick={() => setAberto(true)}>
        <IconSettings aria-hidden />
      </ActionIcon>
      {aberto && (
        <Modal
          opened
          title="Categorias"
          closeButtonProps={fecharModal}
          onClose={() => {
            setAberto(false);
            props.aoFechar();
          }}
        >
          <ListaCategorias api={props.api} tipo="produto" />
        </Modal>
      )}
    </>
  );
}
