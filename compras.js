// compras.js — StockFlow Pro v9.9.41
// v9.9.41: FIX empty state via createElement/textContent (convenção do projeto)
// ══════════════════════════════════════════════════════════════════
// v9.7.4 — textContent em vez de innerText (sem reflow)
// v9.9.5 — atualizarPainelCompras() e gerarTextoCompras() lêem
//   appStore.estoqueItens em vez de varrer o DOM por checkboxes.
//   Elimina querySelectorAll('#lista-itens-container tr…') nestas
//   funções — o store já contém o estado `c: boolean` atualizado
//   via salvarDados() a cada alternarCheck/alternarTodos.
// ══════════════════════════════════════════════════════════════════

import { obterDataAmanha } from './utils.js';
import appStore from './store.js';

export function atualizarPainelCompras() {
    const ulCompras   = document.getElementById('lista-compras-visual');
    const areaCompras = document.getElementById('area-compras');
    if (!ulCompras || !areaCompras) return;

    // v9.9.5: lê do store — sem querySelectorAll no DOM
    const itens  = appStore.get('estoqueItens') || [];
    const nomes  = itens
        .filter(d => d.c)
        .map(d => d.n)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    ulCompras.innerHTML = '';

    // #16 — Empty state: nenhum item marcado
    let emptyEl = areaCompras.parentElement?.querySelector('#compras-empty-state');

    if (nomes.length === 0) {
        areaCompras.style.display = 'none';
        if (!emptyEl) {
            // FIX SUGESTÃO: construir empty state com createElement/textContent
            // em vez de innerHTML — segue a convenção do projeto.
            emptyEl = document.createElement('div');
            emptyEl.id = 'compras-empty-state';
            emptyEl.className = 'compras-empty-state';

            const ico = document.createElement('span');
            ico.className = 'empty-state-icon';
            ico.setAttribute('aria-hidden', 'true');
            ico.textContent = '🛒';

            const msg = document.createElement('span');
            msg.className = 'empty-state-msg';
            msg.textContent = 'Nenhum item marcado.';

            const hint = document.createElement('span');
            hint.className = 'empty-state-hint';
            hint.textContent = 'Marque itens na aba ';
            const strong = document.createElement('strong');
            strong.textContent = 'Estoque';
            hint.appendChild(strong);
            hint.appendChild(document.createTextNode(' para montar sua lista de compras.'));

            emptyEl.append(ico, msg, hint);
            areaCompras.parentElement.appendChild(emptyEl);
        }
        emptyEl.style.display = '';
        return;
    }

    // Tem itens: oculta empty state e exibe a lista
    if (emptyEl) emptyEl.style.display = 'none';
    areaCompras.style.display = 'block';

    nomes.forEach(nome => {
        const li = document.createElement('li');
        li.textContent = nome;
        ulCompras.appendChild(li);
    });
}

export function gerarTextoCompras() {
    // v9.9.5: lê do store — sem querySelectorAll no DOM
    const itens = appStore.get('estoqueItens') || [];
    const nomes = itens
        .filter(d => d.c)
        .map(d => d.n)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    return `*LISTA DE COMPRAS ${obterDataAmanha()}*\n\n` + nomes.join('\n') + '\n';
}