import { mensagemGenerica } from '../../acesso/mensagens';
import type { ErroApi } from '../../api/cliente';

// Textos de Clientes para quem não é da tecnologia: dizem o que aconteceu e o que fazer, sem código de erro.

const DIA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Dia/mês/ano no fuso do negócio (ADR 005): 23h em São Paulo ainda é o mesmo dia, mesmo já sendo "amanhã" em UTC. */
export const dataDoDia = (iso: string): string => DIA.format(new Date(iso));

/** RF-CLI-04: a data em que a loja avisou o cliente para que usa o celular dele. */
export const linhaDoAviso = (avisoEm: string | null): string =>
  avisoEm === null ? 'Ainda não avisado da finalidade do celular' : `Avisado da finalidade em ${dataDoDia(avisoEm)}`;

export function mensagemClientes(e: ErroApi): string {
  if (e.status === 409 && e.codigo === 'celular_ja_cadastrado') {
    return 'Já existe um cliente com este celular. Busque pelo número para abrir a ficha.';
  }
  if (e.status === 409 && e.codigo === 'cliente_anonimizado') return 'Os dados deste cliente já foram apagados.';
  if (e.status === 404) return 'Não encontramos este cliente. Atualize a tela.';
  if (e.status === 403) return 'Só o Dono pode apagar os dados de um cliente.';
  return mensagemGenerica(e);
}
