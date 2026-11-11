import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, SegmentedControl, Stack, Switch, TagsInput, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import type { Categoria, TipoCategoria } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { TIPOS_DE_CATEGORIA, rotuloTipoCategoria } from '../financeiro/rotulos';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { fecharModal, useAcao } from './comum';

// Textos por tipo: a de produto tem atributos; a financeira (despesas e relatório do Financeiro) não.
const TEXTOS: Record<TipoCategoria, { vazioTitulo: string; vazioTexto: string; nova: string; ativaDescricao: string }> = {
  produto: {
    vazioTitulo: 'Nenhuma categoria de produto',
    vazioTexto: 'Crie categorias como Sutiã ou Calcinha e diga quais atributos cada uma usa.',
    nova: 'Nova categoria de produto',
    ativaDescricao: 'Desativada, deixa de aparecer ao cadastrar produtos novos.',
  },
  financeira: {
    vazioTitulo: 'Nenhuma categoria financeira',
    vazioTexto: 'Crie categorias como Aluguel ou Luz para classificar as despesas e ver quanto vai em cada uma.',
    nova: 'Nova categoria financeira',
    ativaDescricao: 'Desativada, deixa de aparecer ao lançar despesas novas. As despesas antigas continuam como estavam.',
  },
};

/** RF-CFG-04: duas listas de categorias — de produto (com atributos) e financeiras (despesas e relatório). */
export function Categorias({ api }: { api: Api }) {
  const [tipo, setTipo] = useState<TipoCategoria>('produto');
  return (
    <Stack gap="md">
      <SegmentedControl
        fullWidth
        size="lg"
        value={tipo}
        onChange={(v) => setTipo(v as TipoCategoria)}
        data={TIPOS_DE_CATEGORIA.map((t) => ({ label: rotuloTipoCategoria(t), value: t }))}
        styles={{ label: { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
      />
      {/* key: ao trocar de aba a lista é remontada e busca de novo (com esqueleto). */}
      <ListaCategorias key={tipo} api={api} tipo={tipo} />
    </Stack>
  );
}

function ListaCategorias({ api, tipo }: { api: Api; tipo: TipoCategoria }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.categorias(tipo).then((r) => r.categorias));
  // undefined = fechado; null = nova categoria; objeto = editando.
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);
  const textos = TEXTOS[tipo];

  return (
    <Stack gap="md">
      <Button leftSection={<IconPlus aria-hidden />} onClick={() => setEditando(null)}>
        {textos.nova}
      </Button>

      {carga.fase === 'carregando' && <Carregando />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.length === 0 && (
        <EstadoVazio titulo={textos.vazioTitulo} texto={textos.vazioTexto} acao={textos.nova} onAcao={() => setEditando(null)} />
      )}
      {carga.fase === 'pronto' &&
        carga.dados.map((c) => (
          <Stack key={c.id} gap="xs" p="md" className="ailow-cartao" style={c.ativa ? undefined : { opacity: 0.7 }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
                {c.nome}
              </Text>
              {/* Estado dito por texto, não só por cor. */}
              {!c.ativa && <Badge color="gray">Desativada</Badge>}
            </Group>
            {tipo === 'produto' &&
              (c.atributos.length > 0 ? (
                <Group gap={6}>
                  {c.atributos.map((a) => (
                    <Badge key={a} variant="light" color="gray" tt="none">
                      {a}
                    </Badge>
                  ))}
                </Group>
              ) : (
                <Text size="sm" c="dimmed">
                  Sem atributos
                </Text>
              ))}
            <Button variant="default" onClick={() => setEditando(c)} aria-label={`Editar ${c.nome}`}>
              Editar
            </Button>
          </Stack>
        ))}

      {editando !== undefined && (
        <FormCategoria
          key={editando?.id ?? 'nova'}
          api={api}
          tipo={tipo}
          categoria={editando}
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

function FormCategoria(props: {
  api: Api;
  tipo: TipoCategoria;
  categoria: Categoria | null;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const { categoria, tipo } = props;
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [atributos, setAtributos] = useState<string[]>(categoria?.atributos ?? []);
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);
  const { pendente, erro, rodar } = useAcao('Já existe uma categoria com esse nome.');

  async function salvar() {
    // Só categoria de produto tem atributos; o tipo é definido na criação e não muda depois.
    const corpo = { nome: nome.trim(), atributos: tipo === 'produto' ? atributos : [] };
    const ok = await rodar(
      () =>
        categoria
          ? props.api.alterarCategoria(categoria.id, { ...corpo, ativa })
          : props.api.criarCategoria({ ...corpo, tipo }),
      categoria ? 'Categoria salva' : 'Categoria criada',
    );
    if (ok) props.aoSalvar();
  }

  return (
    <Modal opened onClose={props.aoFechar} title={categoria ? 'Editar categoria' : TEXTOS[tipo].nova} centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        <TextInput label="Nome" required size="lg" maxLength={60} value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
        {tipo === 'produto' && (
          <TagsInput
            label="Atributos"
            description="Escreva um atributo e toque em Enter (ou vírgula) para adicionar."
            placeholder="bojo, aro, renda…"
            size="lg"
            maxTags={20}
            splitChars={[',']}
            value={atributos}
            onChange={setAtributos}
          />
        )}
        {/* Categoria em uso não se apaga (produtos e lançamentos vão referenciá-la): desativa-se. */}
        {categoria && (
          <Switch
            size="lg"
            label="Categoria ativa"
            description={TEXTOS[tipo].ativaDescricao}
            checked={ativa}
            onChange={(e) => setAtiva(e.currentTarget.checked)}
          />
        )}
        {erro && (
          <Alert color="red" icon={<IconAlertCircle />} role="alert">
            {erro}
          </Alert>
        )}
        <Button onClick={() => void salvar()} loading={pendente} disabled={!nome.trim()}>
          Salvar
        </Button>
      </Stack>
    </Modal>
  );
}
