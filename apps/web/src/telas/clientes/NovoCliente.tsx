import type { Api } from '../../api/endpoints';
import { FormCliente } from './FormCliente';

/** RF-CLI-01: cadastro mínimo, só nome e celular (D8). O aviso de finalidade (RF-CLI-04) já pode ser registrado aqui. */
export function NovoCliente(props: { api: Api; aoCriar: (id: string) => void }) {
  return (
    <FormCliente
      comAviso
      rotuloSalvar="Cadastrar cliente"
      sucesso="Cliente cadastrado"
      salvar={async (d) => (await props.api.criarCliente({ nome: d.nome, celular: d.celular, aviso_lgpd: d.aviso })).id}
      aoSalvo={props.aoCriar}
    />
  );
}
