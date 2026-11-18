import { useState } from 'react';
import { ActionIcon, SegmentedControl, Stack } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Modal } from '../../componentes/navegacao';
import { ListaCategorias } from '../config/Categorias';
import { fecharModal } from '../config/comum';
import { ListaEixosGrade } from './ConfigEixosGrade';
import { ListaOpcoesGrade } from './ConfigOpcoesGrade';

type Aba = 'categorias' | 'tamanhos' | 'cores' | 'eixos';
const TITULOS: Record<Aba, string> = {
  categorias: 'Categorias',
  tamanhos: 'Tamanhos',
  cores: 'Cores',
  eixos: 'Eixos',
};
const ROTULO_BOTAO: Record<Aba, string> = {
  categorias: 'Configurar categorias',
  tamanhos: 'Configurar tamanhos',
  cores: 'Configurar cores',
  eixos: 'Configurar eixos',
};

/**
 * Engrenagem de configuração do "Novo produto" (S10; ADR 017): abre, em pop-up, as categorias de produto (a mesma
 * gestão de Configurações › Categorias) e também os tamanhos e as cores da grade, em abas. Abre na aba do passo em que
 * a pessoa está. Ao fechar, `aoFechar` avisa para a tela buscar de novo (o assistente não perde o que já foi preenchido).
 */
export function BotaoConfigCategorias(props: { api: Api; aoFechar: () => void; aba?: Aba }) {
  const inicial = props.aba ?? 'categorias';
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Aba>(inicial);
  return (
    <>
      <ActionIcon
        variant="default"
        size={48}
        aria-label={ROTULO_BOTAO[inicial]}
        onClick={() => {
          setAba(inicial);
          setAberto(true);
        }}
      >
        <IconSettings aria-hidden />
      </ActionIcon>
      {aberto && (
        <Modal
          opened
          title={TITULOS[aba]}
          closeButtonProps={fecharModal}
          onClose={() => {
            setAberto(false);
            props.aoFechar();
          }}
        >
          <Stack gap="md">
            <SegmentedControl
              fullWidth
              value={aba}
              onChange={(v) => setAba(v as Aba)}
              data={(Object.keys(TITULOS) as Aba[]).map((a) => ({ value: a, label: TITULOS[a] }))}
              styles={{ label: { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
            />
            {/* key: trocar de aba remonta a lista (busca de novo, com esqueleto). */}
            {aba === 'categorias' && <ListaCategorias key="categorias" api={props.api} tipo="produto" />}
            {aba === 'tamanhos' && <ListaOpcoesGrade key="tamanhos" api={props.api} tipo="tamanho" />}
            {aba === 'cores' && <ListaOpcoesGrade key="cores" api={props.api} tipo="cor" />}
            {aba === 'eixos' && <ListaEixosGrade key="eixos" api={props.api} />}
          </Stack>
        </Modal>
      )}
    </>
  );
}
