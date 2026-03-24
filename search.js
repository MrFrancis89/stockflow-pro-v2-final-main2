// search.js — StockFlow Pro v9.9.14
// ══════════════════════════════════════════════════════════════════
// v9.9.5 — módulo extraído de main.js
// v9.9.8 — highlight do termo buscado nos resultados
// v9.9.12 — #17 empty state de busca sem resultado
//   • Ao filtrar, envolve o trecho correspondente em <mark>
//   • Remove o <mark> ao limpar/fechar a busca
//   • Usa nós de texto + createElement — sem innerHTML com dados
//     externos (o nome do produto vem do DOM, não do usuário direto)
//   • contenteditable preservado: o <mark> não quebra a edição
//     porque é removido antes do blur e replicado após o input
// ══════════════════════════════════════════════════════════════════

import { darFeedback } from './utils.js';
import { carregarPosicaoLupa, salvarPosicaoLupa } from './storage.js';

// ── Highlight helpers ─────────────────────────────────────────────

/**
 * Aplica <mark> ao trecho `termo` dentro do elemento `el`.
 * Preserva o texto completo como propriedade data-nome-original
 * para que o DOM não perca a informação ao remover o mark depois.
 * Usa nós de texto + createElement — seguro para contenteditable.
 */
function _aplicarHighlight(el, termo) {
    const textoOriginal = el.dataset.nomeOriginal ?? el.textContent;
    el.dataset.nomeOriginal = textoOriginal;

    const lower = textoOriginal.toLowerCase();
    const idx   = lower.indexOf(termo);
    if (idx === -1) return; // termo não encontrado — nada a fazer

    // Limpa o conteúdo atual
    el.textContent = '';

    // Antes do match
    if (idx > 0) {
        el.appendChild(document.createTextNode(textoOriginal.slice(0, idx)));
    }

    // Trecho com highlight
    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    mark.textContent = textoOriginal.slice(idx, idx + termo.length);
    el.appendChild(mark);

    // Depois do match
    if (idx + termo.length < textoOriginal.length) {
        el.appendChild(document.createTextNode(textoOriginal.slice(idx + termo.length)));
    }
}

/**
 * Remove todos os <mark> inseridos, restaurando o texto puro.
 * Chamado ao limpar a busca ou fechar o overlay.
 */
function _removerHighlights() {
    document.querySelectorAll('.nome-prod').forEach(el => {
        if (el.dataset.nomeOriginal !== undefined) {
            el.textContent = el.dataset.nomeOriginal;
            delete el.dataset.nomeOriginal;
        }
    });
}

function _mostrarEmptyStateBusca(termo) {
    const container = document.getElementById('lista-itens-container');
    if (!container) return;
    const tr = document.createElement('tr');
    tr.id = 'empty-state-busca';
    const tdMsg = document.createElement('td');
    tdMsg.colSpan = 4;
    tdMsg.className = 'empty-state';
    const icon = document.createElement('span');
    icon.className = 'empty-state-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🔍';
    const msg = document.createElement('span');
    msg.className = 'empty-state-msg';
    msg.textContent = `Nenhum item para "${termo}"`;
    const hint = document.createElement('span');
    hint.className = 'empty-state-hint';
    hint.textContent = 'Tente outro termo ou limpe a busca.';
    tdMsg.append(icon, msg, hint);
    tr.appendChild(tdMsg);
    container.appendChild(tr);
}

function _removerEmptyStateBusca() {
    document.getElementById('empty-state-busca')?.remove();
}

// ── API pública ───────────────────────────────────────────────────

/**
 * Filtra as linhas da tabela de estoque e aplica highlight no termo.
 * Oculta headers de categoria que ficaram sem itens visíveis.
 */
export function aplicarFiltro() {
    const busca = (document.getElementById('filtroBusca')?.value || '').toLowerCase().trim();
    const sel   = document.getElementById('filtroSelect')?.value || '';

    // Remove highlights e empty state anteriores antes de reaplicar
    _removerHighlights();
    _removerEmptyStateBusca();

    document.querySelectorAll('#lista-itens-container tr').forEach(tr => {
        if (tr.classList.contains('categoria-header-row')) { tr.style.display = ''; return; }

        const nomeEl = tr.querySelector('.nome-prod');
        const nome   = nomeEl?.textContent.toLowerCase() || '';
        const visivel = (!busca || nome.includes(busca)) &&
                        (!sel   || nome.trim() === sel.toLowerCase().trim());

        tr.style.display = visivel ? '' : 'none';

        // Aplica highlight apenas em linhas visíveis com busca ativa
        if (visivel && busca && nomeEl) {
            _aplicarHighlight(nomeEl, busca);
        }
    });

    // Oculta header de categoria se todos os seus itens estão filtrados
    document.querySelectorAll('.categoria-header-row').forEach(hdr => {
        let next = hdr.nextElementSibling;
        let temVisivel = false;
        while (next && !next.classList.contains('categoria-header-row')) {
            if (next.style.display !== 'none') { temVisivel = true; break; }
            next = next.nextElementSibling;
        }
        hdr.style.display = temVisivel ? '' : 'none';
    });

    // Empty state de busca — exibe se nenhum item de dados ficou visível
    if (busca || sel) {
        const container = document.getElementById('lista-itens-container');
        const algumVisivel = container
            ? Array.from(container.querySelectorAll('tr:not(.categoria-header-row)')).some(
                  tr => tr.style.display !== 'none'
              )
            : true;
        if (!algumVisivel) _mostrarEmptyStateBusca(busca);
    }
}

/**
 * Inicializa a lupa flutuante (#assistive-touch).
 * Remove highlights ao fechar a busca.
 */
export function iniciarLupa() {
    const lupa    = document.getElementById('assistive-touch');
    const cluster = document.getElementById('float-cluster');
    const overlay = document.getElementById('search-overlay');
    const input   = document.getElementById('filtroBusca');
    if (!lupa || !cluster || !overlay) return;

    // Restaura posição salva
    const pos = carregarPosicaoLupa();
    if (pos) {
        cluster.style.bottom = 'auto';
        cluster.style.right  = 'auto';
        cluster.style.left   = pos.x + 'px';
        cluster.style.top    = pos.y + 'px';
    }

    function abrirBusca() {
        darFeedback();
        overlay.classList.add('search-open');
        if (input) {
            setTimeout(() => input.focus(), 80);
            aplicarFiltro();
        }
    }
    function fecharBusca() {
        overlay.classList.remove('search-open');
        if (input) input.blur();
        // Remove highlights e empty state ao fechar — tabela volta ao estado limpo
        _removerHighlights();
        _removerEmptyStateBusca();
        // Garante que todas as linhas voltem a ser visíveis
        document.querySelectorAll('#lista-itens-container tr').forEach(tr => {
            tr.style.display = '';
        });
        document.querySelectorAll('.categoria-header-row').forEach(hdr => {
            hdr.style.display = '';
        });
    }
    function toggleBusca() {
        overlay.classList.contains('search-open') ? fecharBusca() : abrirBusca();
    }

    // ── Drag por touch ────────────────────────────────────────────
    let isDragging = false, startX, startY, elX, elY, touchMoved = false;

    lupa.addEventListener('touchstart', e => {
        isDragging = false; touchMoved = false;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        const rect = cluster.getBoundingClientRect(); elX = rect.left; elY = rect.top;
    }, { passive: true });

    lupa.addEventListener('touchmove', e => {
        const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
        if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isDragging = true; touchMoved = true;
        }
        if (isDragging) {
            cluster.style.bottom = 'auto';
            cluster.style.right  = 'auto';
            cluster.style.left   = Math.max(0, Math.min(window.innerWidth  - 56, elX + dx)) + 'px';
            cluster.style.top    = Math.max(0, Math.min(window.innerHeight - 56, elY + dy)) + 'px';
        }
    }, { passive: true });

    lupa.addEventListener('touchend', e => {
        e.preventDefault();
        if (!touchMoved) {
            toggleBusca();
        } else {
            const rect = cluster.getBoundingClientRect();
            salvarPosicaoLupa({ x: rect.left, y: rect.top });
        }
        isDragging = false;
    });

    lupa.addEventListener('click', toggleBusca);

    // Fecha ao tocar fora do overlay
    document.addEventListener('pointerdown', e => {
        if (overlay.classList.contains('search-open') &&
            !overlay.contains(e.target) && !lupa.contains(e.target)) {
            fecharBusca();
        }
    }, true);
}
