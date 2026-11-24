import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Perfil } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { useVoltar } from '../../componentes/navegacao';
import { avisarErro } from '../../lib/avisos';
import { Moldura } from '../Moldura';
import { NovoProduto } from '../produtos/NovoProduto';
import type { ItemVenda } from './carrinho';
import { Comprovante } from './Comprovante';
import { Fechamento } from './Fechamento';
import { MontarVenda } from './MontarVenda';
import { RelatorioVendas } from './RelatorioVendas';
import { TelaCarrinho } from './TelaCarrinho';

type Passo = 'montar' | 'carrinho' | 'fechar' | 'comprovante' | 'relatorio';

/** Cada passo é uma rota (/vendas, /vendas/carrinho, /vendas/fechar, …): o Voltar do sistema anda entre eles. */
function passoDaRota(caminho: string): Passo {
  const sub = caminho.replace(/^\/vendas\/?/, '');
  if (sub === 'carrinho' || sub === 'fechar' || sub === 'comprovante' || sub === 'relatorio') return sub;
  return 'montar';
}

/** RF-VEN-01: a venda é o primeiro módulo da home. Cada passo é uma tela. */
export function Vendas(props: { api: Api; perfil: Perfil; aoVoltar: () => void }) {
  const navigate = useNavigate();
  const passo = passoDaRota(useLocation().pathname);
  const voltarParaMontar = useVoltar('/vendas');
  const voltarParaCarrinho = useVoltar('/vendas/carrinho');
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [vendaId, setVendaId] = useState<string | null>(null);
  // "Refazer venda" (ADR 014): o cliente da venda cancelada já vem preenchido no fechamento da nova.
  const [celularInicial, setCelularInicial] = useState<string | null>(null);
  // V03: assistente embutido — o carrinho (`itens`) fica neste estado; não navega para /produtos.
  const [criandoProduto, setCriandoProduto] = useState(false);
  const [buscaAposNovo, setBuscaAposNovo] = useState<string | undefined>(undefined);

  if (criandoProduto && props.perfil === 'dono') {
    return (
      <Moldura titulo="Novo produto" voltar={{ rotulo: 'Venda', aoVoltar: () => setCriandoProduto(false) }}>
        <NovoProduto
          api={props.api}
          aoCancelar={() => setCriandoProduto(false)}
          aoTerminar={(codigo) => {
            setCriandoProduto(false);
            setBuscaAposNovo(codigo ?? '');
          }}
        />
      </Moldura>
    );
  }

  if (passo === 'relatorio') {
    return (
      <Moldura titulo="Relatório" voltar={{ rotulo: 'Venda', aoVoltar: voltarParaMontar }}>
        <RelatorioVendas
          api={props.api}
          perfil={props.perfil}
          // ADR 014: "Refazer venda" já cancelou a venda; o carrinho novo recebe as peças e a tela do carrinho abre.
          aoRefazer={(r) => {
            setItens(r.itens);
            setCelularInicial(r.celular);
            if (r.faltando.length > 0) avisarErro(`Ficaram de fora (sem estoque ou arquivadas): ${r.faltando.join(', ')}.`);
            navigate('/vendas/carrinho', { replace: true });
          }}
        />
      </Moldura>
    );
  }
  if (passo === 'comprovante' && vendaId) {
    return (
      <Moldura titulo="Comprovante" voltar={{ rotulo: 'Venda', aoVoltar: voltarParaMontar }}>
        <Comprovante
          api={props.api}
          id={vendaId}
          aoNova={() => {
            setItens([]);
            setVendaId(null);
            navigate('/vendas', { replace: true });
          }}
        />
      </Moldura>
    );
  }
  if (passo === 'fechar') {
    return (
      <Moldura titulo="Fechar venda" voltar={{ rotulo: 'Carrinho', aoVoltar: voltarParaCarrinho }}>
        <Fechamento
          api={props.api}
          itens={itens}
          celularInicial={celularInicial}
          aoVoltar={voltarParaCarrinho}
          aoFinalizar={(id) => {
            // A venda já foi gravada: o carrinho esvazia e o comprovante substitui o fechamento no histórico,
            // para o Voltar não reabrir uma venda fechada.
            setVendaId(id);
            setItens([]);
            setCelularInicial(null);
            navigate('/vendas/comprovante', { replace: true });
          }}
        />
      </Moldura>
    );
  }
  if (passo === 'carrinho') {
    return (
      <Moldura titulo="Carrinho" voltar={{ rotulo: 'Venda', aoVoltar: voltarParaMontar }}>
        <TelaCarrinho
          itens={itens}
          aoMudar={setItens}
          aoFechar={() => navigate('/vendas/fechar')}
          aoContinuar={() => navigate('/vendas', { replace: true })}
        />
      </Moldura>
    );
  }
  return (
    <Moldura titulo="Nova venda" subtitulo="Escaneie a etiqueta ou busque a peça." voltar={{ rotulo: 'Início', aoVoltar: props.aoVoltar }}>
      <MontarVenda
        api={props.api}
        perfil={props.perfil}
        itens={itens}
        aoMudar={setItens}
        aoFechar={() => navigate('/vendas/fechar')}
        aoCarrinho={() => navigate('/vendas/carrinho')}
        aoRelatorio={() => navigate('/vendas/relatorio')}
        aoNovoProduto={() => setCriandoProduto(true)}
        buscaInicial={buscaAposNovo}
      />
    </Moldura>
  );
}
