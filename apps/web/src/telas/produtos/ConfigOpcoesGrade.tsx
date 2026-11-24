import { useState } from 'react';
import { Badge, Box, Button, ColorInput, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { CORES_PADRAO } from '@ailow/shared/puro';
import type { OpcaoGrade, TipoOpcaoGrade } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Modal } from '../../componentes/navegacao';
import { EstadoVazio } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { fecharModal, useAcao } from '../config/comum';

// ADR 017: tamanhos e cores da grade, configurados pelo Dono na engrenagem do "Novo produto".
// Nada é apagado: desativar tira a opção da escolha, mas os produtos que já usam o nome continuam iguais.

const TEXTOS: Record<TipoOpcaoGrade, { nova: string; vazio: string; editar: string; ativaDescricao: string; repetida: string }> = {
  tamanho: {
    nova: 'Novo tamanho',
    vazio: 'Nenhum tamanho. Crie os tamanhos que a loja usa (ex.: P, M, 44).',
    editar: 'Editar tamanho',
    ativaDescricao: 'Desativado, deixa de aparecer ao cadastrar produtos novos. As peças que já têm este tamanho não mudam.',
    repetida: 'Esse tamanho já existe.',
  },
  cor: {
    nova: 'Nova cor',
    vazio: 'Nenhuma cor. Crie as cores que a loja usa (ex.: Preto, Nude).',
    editar: 'Editar cor',
    ativaDescricao: 'Desativada, deixa de aparecer ao cadastrar produtos novos. As peças que já têm esta cor não mudam.',
    repetida: 'Essa cor já existe (maiúsculas e acentos não contam).',
  },
};

// Amostras rápidas para tocar (as das cores padrão); o seletor aceita qualquer outra.
const AMOSTRAS = [...new Set(CORES_PADRAO.map((c) => c.amostra))];

function Bolinha({ amostra }: { amostra: string | null }) {
  return (
    <Box
      aria-hidden
      w={20}
      h={20}
      style={{
        flex: 'none',
        borderRadius: '50%',
        background: amostra ?? 'transparent',
        border: amostra ? '1px solid var(--ailow-borda)' : '1px dashed var(--ailow-apagado)',
      }}
    />
  );
}

/** Lista de tamanhos ou de cores da empresa, com criar, renomear, trocar a amostra (cor) e (des)ativar. */
export function ListaOpcoesGrade({ api, tipo }: { api: Api; tipo: TipoOpcaoGrade }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() =>
    api.opcoesGrade().then((o) => (tipo === 'tamanho' ? o.tamanhos : o.cores)),
  );
  // undefined = fechado; null = nova; objeto = editando.
  const [editando, setEditando] = useState<OpcaoGrade | null | undefined>(undefined);
  const t = TEXTOS[tipo];

  return (
    <Stack gap="md">
      <Button leftSection={<IconPlus aria-hidden />} onClick={() => setEditando(null)}>
        {t.nova}
      </Button>
      {carga.fase === 'carregando' && <Carregando />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.length === 0 && <EstadoVazio titulo={t.nova} texto={t.vazio} />}
      {carga.fase === 'pronto' &&
        carga.dados.map((o) => (
          <Group
            key={o.id}
            justify="space-between"
            wrap="nowrap"
            gap="xs"
            p="sm"
            className="ailow-cartao"
            data-opcao-grade={o.nome}
            style={o.ativa ? undefined : { opacity: 0.7 }}
          >
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              {tipo === 'cor' && <Bolinha amostra={o.amostra} />}
              <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
                {o.nome}
              </Text>
              {/* Estado dito por texto, não só por cor. */}
              {!o.ativa && <Badge color="gray">{tipo === 'cor' ? 'Desativada' : 'Desativado'}</Badge>}
            </Group>
            <Button h={48} variant="default" onClick={() => setEditando(o)} aria-label={`Editar ${o.nome}`}>
              Editar
            </Button>
          </Group>
        ))}

      {editando !== undefined && (
        <FormOpcao
          key={editando?.id ?? 'nova'}
          api={api}
          tipo={tipo}
          opcao={editando}
          aoFechar={() => setEditando(undefined)}
          aoSalvar={() => {
            setEditando(undefined);
            void recarregar();
          }}
        />
      )}
    </Stack>
  );
}

function FormOpcao(props: { api: Api; tipo: TipoOpcaoGrade; opcao: OpcaoGrade | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { opcao, tipo } = props;
  const t = TEXTOS[tipo];
  const [nome, setNome] = useState(opcao?.nome ?? '');
  const [amostra, setAmostra] = useState<string>(opcao?.amostra ?? '');
  const [ativa, setAtiva] = useState(opcao?.ativa ?? true);
  const { pendente, rodar } = useAcao(t.repetida);
  const amostraValida = /^#[0-9a-f]{6}$/i.test(amostra) ? amostra.toLowerCase() : null;

  async function salvar() {
    const n = nome.trim();
    const ok = await rodar(
      () =>
        opcao
          ? props.api.alterarOpcaoGrade(opcao.id, { nome: n, amostra: tipo === 'cor' ? amostraValida : null, ativa })
          : props.api.criarOpcaoGrade(tipo === 'cor' ? { tipo, nome: n, amostra: amostraValida } : { tipo, nome: n }),
      opcao ? 'Salvo' : tipo === 'cor' ? 'Cor criada' : 'Tamanho criado',
    );
    if (ok) props.aoSalvar();
  }

  return (
    <Modal opened onClose={props.aoFechar} title={opcao ? t.editar : t.nova} centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        {tipo === 'tamanho' ? (
          <TextInput
            label="Tamanho"
            description="1 a 3 letras ou números, como na etiqueta (ex.: P, GG, 46, G1)."
            required
            size="lg"
            maxLength={3}
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.currentTarget.value.toUpperCase())}
          />
        ) : (
          <>
            <TextInput label="Cor" required size="lg" maxLength={30} autoComplete="off" value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
            <ColorInput
              label="Amostra (opcional)"
              description="A bolinha que aparece no botão da cor."
              size="lg"
              format="hex"
              swatches={AMOSTRAS}
              swatchesPerRow={8}
              withEyeDropper={false}
              autoComplete="off"
              value={amostra}
              onChange={setAmostra}
            />
          </>
        )}
        {opcao && (
          <Switch
            size="lg"
            label={tipo === 'cor' ? 'Cor ativa' : 'Tamanho ativo'}
            description={t.ativaDescricao}
            checked={ativa}
            onChange={(e) => setAtiva(e.currentTarget.checked)}
          />
        )}
        <Button onClick={() => void salvar()} loading={pendente} disabled={!nome.trim()}>
          Salvar
        </Button>
      </Stack>
    </Modal>
  );
}
