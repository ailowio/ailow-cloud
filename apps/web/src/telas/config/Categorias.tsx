import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, Stack, Switch, TagsInput, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import type { Categoria } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { fecharModal, useAcao } from './comum';

/** RF-CFG-04: categorias de produto e os atributos que cada uma usa (ex.: sutiã → bojo, aro, renda). */
export function Categorias({ api }: { api: Api }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.categorias().then((r) => r.categorias));
  // undefined = fechado; null = nova categoria; objeto = editando.
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);

  return (
    <Stack gap="md">
      <Button leftSection={<IconPlus aria-hidden />} onClick={() => setEditando(null)}>
        Nova categoria
      </Button>

      {carga.fase === 'carregando' && <Carregando />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && carga.dados.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma categoria"
          texto="Crie categorias como Sutiã ou Calcinha e diga quais atributos cada uma usa."
          acao="Nova categoria"
          onAcao={() => setEditando(null)}
        />
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
            {c.atributos.length > 0 ? (
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
            )}
            <Button variant="default" onClick={() => setEditando(c)} aria-label={`Editar ${c.nome}`}>
              Editar
            </Button>
          </Stack>
        ))}

      {editando !== undefined && (
        <FormCategoria
          key={editando?.id ?? 'nova'}
          api={api}
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

function FormCategoria(props: { api: Api; categoria: Categoria | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { categoria } = props;
  const [nome, setNome] = useState(categoria?.nome ?? '');
  const [atributos, setAtributos] = useState<string[]>(categoria?.atributos ?? []);
  const [ativa, setAtiva] = useState(categoria?.ativa ?? true);
  const { pendente, erro, rodar } = useAcao('Já existe uma categoria com esse nome.');

  async function salvar() {
    const corpo = { nome: nome.trim(), atributos };
    const ok = await rodar(
      () => (categoria ? props.api.alterarCategoria(categoria.id, { ...corpo, ativa }) : props.api.criarCategoria(corpo)),
      categoria ? 'Categoria salva' : 'Categoria criada',
    );
    if (ok) props.aoSalvar();
  }

  return (
    <Modal opened onClose={props.aoFechar} title={categoria ? 'Editar categoria' : 'Nova categoria'} centered closeButtonProps={fecharModal}>
      <Stack gap="md">
        <TextInput label="Nome" required size="lg" maxLength={60} value={nome} onChange={(e) => setNome(e.currentTarget.value)} />
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
        {/* Categoria em uso não se apaga (produtos vão referenciá-la): desativa-se. */}
        {categoria && (
          <Switch
            size="lg"
            label="Categoria ativa"
            description="Desativada, deixa de aparecer ao cadastrar produtos novos."
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
