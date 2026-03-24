// reload.js — StockFlow Pro v9.9.42
// ══════════════════════════════════════════════════════════════════
// v9.9.5  — recarregarDados() sem location.reload()
// v9.9.39 — Usa carregarDados() que já é escopo-consciente
// v9.9.41 — [BUG 5] recarregarDados: reconstrói Map de estoques no store
//            (lê do estoque ativo via storage.js multi-estoque).
//            Sem alteração na assinatura pública — todos os callers
//            continuam funcionando sem modificação.
// ══════════════════════════════════════════════════════════════════

import { carregarDados, carregarEstoquesMeta,
         carregarEstoqueAtivoId, carregarItensEstoque } from './storage.js';
import { renderizarListaCompleta } from './ui.js';
import { atualizarDropdown }      from './dropdown.js';
import { atualizarPainelCompras } from './compras.js';
import { verificarAlertas }       from './alerta.js';
import { initSwipe }              from './swipe.js';
import { mostrarToast }           from './toast.js';
import appStore                   from './store.js';

/**
 * Atualiza a UI com os dados mais recentes do localStorage,
 * sem recarregar a página.
 *
 * @param {object} [opcoes]
 * @param {string|null} [opcoes.toast]         - Mensagem via mostrarToast (opcional).
 * @param {'info'|'sucesso'|'erro'|'aviso'} [opcoes.toastTipo='info'] - Tipo do toast.
 * @param {boolean}     [opcoes.scrollTopo=true] - Se true, faz scroll para o topo.
 */
export function recarregarDados({ toast = null, toastTipo = 'info', scrollTopo = true } = {}) {
    // 1. Resolve o ID ativo direto do localStorage — fonte mais confiável,
    //    evita depender de appStore que pode estar em transição
    const ativoId = carregarEstoqueAtivoId();

    // 2. Lê os itens pelo ID explícito — carregarDados() usa appStore e pode
    //    sofrer race condition se chamado durante uma troca de estoque
    const dados = carregarItensEstoque(ativoId) || [];

    // 3. Reconstrói o Map completo de estoques (FIX BUG 5 + race condition)
    const meta = carregarEstoquesMeta();
    const estoques = new Map();
    meta.forEach(({ id, nome }) => {
        const itens = id === ativoId ? dados : carregarItensEstoque(id);
        estoques.set(id, { id, nome, itens });
    });
    appStore.set({ estoques, estoqueAtivoId: ativoId, estoqueItens: dados });

    // 3. Re-renderiza
    renderizarListaCompleta(dados);
    atualizarDropdown();
    atualizarPainelCompras();
    verificarAlertas();
    initSwipe();

    // 4. Notifica módulos secundários
    document.dispatchEvent(new CustomEvent('sf:dados-recarregados'));

    // 5. Feedback
    if (toast) mostrarToast(toast, toastTipo);
    if (scrollTopo) window.scrollTo({ top: 0, behavior: 'instant' });
}
