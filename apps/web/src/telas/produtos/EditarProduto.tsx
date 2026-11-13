import { useState } from 'react';
import { Button, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import type { Categoria, Produto } from '@ailow/shared';
import { ErroApi } from '../../api/cliente';
import type { Api } from '../../api/endpoints';
import { Modal } from '../../componentes/navegacao';
import { fecharModal } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { type CampoComErro, type FormularioProduto, NOME_MAXIMO, corpoDaEdicao, formularioDoProduto } from './edicao-produto';
import { PORTES_DISPONIVEIS, mensagemProdutos, rotuloPorte } from './rotulos';

/**
 * S09: formulário simples, em pop-up, para editar o produto (o passo a passo completo é o de "Novo produto").
 * Erros viram aviso (toast) e a borda vermelha do campo: nada de bloco novo que empurre o layout (UXM-04).
 */
export function EditarProduto(props: { api: Api; produto: Produto; aoFechar: () => void; aoSalvo: () => void }) {
  const inicial = formularioDoProduto(props.produto);
  return (
    <Modal opened onClose={props.aoFechar} title="Editar produto" closeButtonProps={fecharModal}>
      {inicial ? (
        <Carregado api={props.api} produtoId={props.produto.id} inicial={inicial} aoFechar={props.aoFechar} aoSalvo={props.aoSalvo} />
      ) : (
        <Text>Só o Dono edita produtos.</Text>
      )}
    </Modal>
  );
}

function Carregado(props: { api: Api; produtoId: string; inicial: FormularioProduto; aoFechar: () => void; aoSalvo: () => void }) {
  const { carga, tentarDeNovo } = useCarregar(async () => (await props.api.categorias('produto')).categorias.filter((c) => c.ativa));
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  return <Formulario {...props} categorias={carga.dados} />;
}

function Formulario(props: {
  api: Api;
  produtoId: string;
  inicial: FormularioProduto;
  categorias: Categoria[];
  aoFechar: () => void;
  aoSalvo: () => void;
}) {
  const [f, setF] = useState<FormularioProduto>(props.inicial);
  const [marcados, setMarcados] = useState<Partial<Record<CampoComErro, true>>>({});
  const [salvando, setSalvando] = useState(false);
  const categoria = props.categorias.find((c) => c.id === f.categoria_id);

  function mudar(parte: Partial<FormularioProduto>) {
    setF((atual) => ({ ...atual, ...parte }));
    setMarcados({});
  }

  function escolherCategoria(c: Categoria) {
    // Atributos que a nova categoria também tem continuam ligados; os demais saem.
    const validos = new Map(c.atributos.map((a) => [a.toLowerCase(), a]));
    const mantidos = f.atributos.map((a) => validos.get(a.toLowerCase())).filter((a): a is string => a !== undefined);
    mudar({ categoria_id: c.id, atributos: mantidos });
  }

  async function salvar() {
    const r = corpoDaEdicao(f);
    if (!r.ok) {
      setMarcados(r.erros);
      notifications.show({ message: r.mensagem, color: 'red', autoClose: 5000, withCloseButton: false });
      return;
    }
    setSalvando(true);
    try {
      await props.api.editarProduto(props.produtoId, r.corpo);
      notifications.show({ message: 'Produto salvo', color: 'teal', autoClose: 3500, withCloseButton: false });
      props.aoSalvo();
    } catch (e) {
      const erro = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      notifications.show({ message: mensagemProdutos(erro), color: 'red', autoClose: 6000, withCloseButton: false });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Stack gap="md" data-editar-produto="">
      <TextInput
        label="Nome"
        size="lg"
        maxLength={NOME_MAXIMO}
        autoComplete="off"
        value={f.nome}
        error={marcados.nome === true}
        onChange={(e) => mudar({ nome: e.currentTarget.value })}
      />

      <Stack gap={6} role="group" aria-label="Categoria">
        <Text fw={500}>Categoria</Text>
        {props.categorias.map((c) => {
          const marcada = c.id === f.categoria_id;
          return (
            <Button
              key={c.id}
              h={48}
              variant={marcada ? 'filled' : 'default'}
              aria-pressed={marcada}
              leftSection={marcada ? <IconCheck size={16} aria-hidden /> : undefined}
              onClick={() => escolherCategoria(c)}
            >
              {c.nome}
            </Button>
          );
        })}
      </Stack>

      {categoria && categoria.atributos.length > 0 && (
        <Stack gap="xs" role="group" aria-label="O que ela tem?">
          <Text fw={500}>O que ela tem?</Text>
          {categoria.atributos.map((a) => (
            <Switch
              key={a}
              size="md"
              label={a}
              checked={f.atributos.some((x) => x.toLowerCase() === a.toLowerCase())}
              onChange={(e) =>
                mudar({
                  atributos: e.currentTarget.checked ? [...f.atributos, a] : f.atributos.filter((x) => x.toLowerCase() !== a.toLowerCase()),
                })
              }
            />
          ))}
        </Stack>
      )}

      <Stack gap={6} role="group" aria-label="Porte">
        <Text fw={500}>Porte</Text>
        <Group grow gap="xs">
          {PORTES_DISPONIVEIS.map((p) => (
            <Button key={p} h={48} variant={f.porte === p ? 'filled' : 'default'} aria-pressed={f.porte === p} onClick={() => mudar({ porte: p })}>
              {rotuloPorte(p)}
            </Button>
          ))}
        </Group>
      </Stack>

      <TextInput
        label="Preço de venda"
        size="lg"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ex.: 89,90"
        value={f.precoTexto}
        error={marcados.preco === true}
        onChange={(e) => mudar({ precoTexto: e.currentTarget.value })}
      />
      <TextInput
        label="Custo"
        size="lg"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ex.: 45,00"
        value={f.custoTexto}
        error={marcados.custo === true}
        onChange={(e) => mudar({ custoTexto: e.currentTarget.value })}
      />
      <TextInput
        label="Fornecedor"
        size="lg"
        maxLength={80}
        autoComplete="off"
        placeholder="Opcional"
        value={f.fornecedor}
        onChange={(e) => mudar({ fornecedor: e.currentTarget.value })}
      />

      <Text size="sm" c="dimmed">
        Tamanhos, cores e códigos não mudam aqui. O estoque muda só com “Chegou mercadoria” ou “Ajustar estoque”.
      </Text>

      <Group grow gap="xs" wrap="nowrap">
        <Button h={48} variant="default" onClick={props.aoFechar}>
          Cancelar
        </Button>
        <Button h={48} onClick={() => void salvar()} loading={salvando}>
          Salvar
        </Button>
      </Group>
    </Stack>
  );
}
