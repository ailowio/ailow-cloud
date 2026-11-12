import { useState } from 'react';
import type { Perfil } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { Moldura } from '../Moldura';
import type { ItemVenda } from './carrinho';
import { Comprovante } from './Comprovante';
import { Fechamento } from './Fechamento';
import { MontarVenda } from './MontarVenda';
import { RelatorioVendas } from './RelatorioVendas';

type Passo = 'montar' | 'fechar' | 'comprovante' | 'relatorio';

/** RF-VEN-01: a venda é o primeiro módulo da home. Cada passo é uma tela. */
export function Vendas(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const [passo, setPasso] = useState<Passo>('montar');
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [vendaId, setVendaId] = useState<string | null>(null);

  if (passo === 'relatorio') {
    return (
      <Moldura titulo="Relatório" voltar={{ rotulo: 'Venda', aoVoltar: () => setPasso('montar') }}>
        <RelatorioVendas api={props.api} perfil={props.perfil} />
      </Moldura>
    );
  }
  if (passo === 'comprovante' && vendaId) {
    return (
      <Moldura titulo="Comprovante" voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
        <Comprovante
          api={props.api}
          id={vendaId}
          aoNova={() => {
            setItens([]);
            setVendaId(null);
            setPasso('montar');
          }}
        />
      </Moldura>
    );
  }
  if (passo === 'fechar') {
    return (
      <Moldura titulo="Fechar venda" voltar={{ rotulo: 'Carrinho', aoVoltar: () => setPasso('montar') }}>
        <Fechamento
          api={props.api}
          itens={itens}
          aoVoltar={() => setPasso('montar')}
          aoFinalizar={(id) => {
            setVendaId(id);
            setPasso('comprovante');
          }}
        />
      </Moldura>
    );
  }
  return (
    <Moldura titulo="Nova venda" subtitulo="Escaneie a etiqueta ou busque a peça." voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <MontarVenda api={props.api} itens={itens} aoMudar={setItens} aoFechar={() => setPasso('fechar')} aoRelatorio={() => setPasso('relatorio')} />
    </Moldura>
  );
}
