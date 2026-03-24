// ui.js — StockFlow Pro v9.9.14
// ══════════════════════════════════════════════════════════════════
// v9.8.4 — BUG fixes: lazy getter, spread sort, for..of, null-guard
// v9.9.6 — salvarEAtualizar() cirúrgico:
//
//   PROBLEMA (pré-v9.9.6):
//     salvarEAtualizar() era chamado no blur do .nome-prod e apagava/
//     reconstruía toda a tabela via innerHTML=''. Para listas com
//     50+ itens isso gerava ~100ms de reflow a cada renomeação.
//
//   SOLUÇÃO — atualização em 3 camadas:
//     1. Atualização in-place (_atualizarLinhaDOM): se o item
//        permanece na mesma categoria e mesma posição alfabética,
//        apenas os atributos do <tr> existente são atualizados.
//        Zero reflow de layout.
//     2. Reconstrução diferida (requestIdleCallback): se a categoria
//        ou posição mudou, a tabela é reconstruída no próximo frame
//        ocioso — a UI não trava durante a digitação.
//     3. renderizarListaCompleta() preservado para boot, restore e
//        reload — casos onde reconstrução total é necessária e
//        esperada.
// ══════════════════════════════════════════════════════════════════

import { identificarCategoria, nomesCategorias } from './categorias.js';
import { salvarDados } from './storage.js';
import { atualizarPainelCompras } from './compras.js';
import { coletarDadosDaTabela } from './tabela.js';
import { atualizarDropdown } from './dropdown.js';

// ── Segurança: escape HTML ─────────────────────────────────────────
/**
 * Escapa caracteres especiais HTML antes de interpolar em innerHTML.
 * Previne XSS: nomes de produto inseridos pelo usuário (ou vindos do
 * Firebase/localStorage) nunca são tratados como marcação HTML.
 * Aplicado em inserirLinhaNoDOM() para os campos variáveis n e q.
 */
function _esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// BUG FIX #1: lazy getter — nunca capture elementos DOM no top-level de módulos ES.
function getContainer() {
    const el = document.getElementById('lista-itens-container');
    if (!el) console.warn('[ui.js] #lista-itens-container não encontrado no DOM.');
    return el;
}

// ── Helpers internos ──────────────────────────────────────────────

/**
 * Retorna o <tr> correspondente a um nome de item, ou null.
 * Usa a mesma normalização de coletarDadosDaTabela() para garantir match.
 */
function _trPorNome(nome) {
    const container = getContainer();
    if (!container) return null;
    for (const tr of container.querySelectorAll('tr:not(.categoria-header-row)')) {
        const el = tr.querySelector('.nome-prod');
        if (!el) continue;
        if (el.textContent.replace(/\r\n|\n|\r/g, ' ').trim() === nome) return tr;
    }
    return null;
}

/**
 * Atualiza os atributos de um <tr> existente sem recriar o nó.
 * Só toca no que realmente mudou — sem reflow de layout.
 */
function _atualizarLinhaDOM(tr, item) {
    // dataset de alertas
    tr.dataset.min     = (item.min     != null) ? item.min     : '';
    tr.dataset.max     = (item.max     != null) ? item.max     : '';
    tr.dataset.minUnit = (item.minUnit != null) ? item.minUnit : '';
    tr.dataset.maxUnit = (item.maxUnit != null) ? item.maxUnit : '';

    // checkbox
    const chk = tr.querySelector('input[type="checkbox"]');
    if (chk && chk.checked !== item.c) {
        chk.checked = item.c;
        tr.classList.toggle('linha-marcada', item.c);
    }

    // quantidade (só se não estiver em foco — evita sobreposição com digitação)
    const inp = tr.querySelector('.input-qtd-tabela');
    if (inp && document.activeElement !== inp && inp.value !== item.q) {
        inp.value = item.q;
    }

    // unidade
    const sel = tr.querySelector('.select-tabela');
    if (sel && sel.value !== item.u) {
        sel.value = item.u;
    }
}

/**
 * Retorna o nome da categoria que o <tr> pertence,
 * lendo o header imediatamente anterior.
 */
function _categoriaDoTr(tr) {
    let prev = tr.previousElementSibling;
    while (prev) {
        if (prev.classList.contains('categoria-header-row')) {
            // #8: lê data-cat adicionado ao <td> (não depende mais de cor inline)
            return prev.querySelector('.categoria-header')?.dataset.cat || null;
        }
        prev = prev.previousElementSibling;
    }
    return null;
}

/**
 * Verifica se o item ainda ocupa a posição alfabética correta dentro
 * da sua categoria (predecessor e sucessor com o mesmo locale).
 */
function _posicaoCorreta(tr, nomeNovo) {
    const cat = _categoriaDoTr(tr);
    if (!cat) return false;

    const prevTr   = tr.previousElementSibling;
    const nextTr   = tr.nextElementSibling;

    const prevNome = prevTr && !prevTr.classList.contains('categoria-header-row')
        ? prevTr.querySelector('.nome-prod')?.textContent.trim() : null;
    const nextNome = nextTr && !nextTr.classList.contains('categoria-header-row')
        ? nextTr.querySelector('.nome-prod')?.textContent.trim() : null;

    const aposAnterior  = !prevNome || prevNome.localeCompare(nomeNovo, 'pt-BR') <= 0;
    const antesSeguinte = !nextNome || nomeNovo.localeCompare(nextNome, 'pt-BR') <= 0;

    return aposAnterior && antesSeguinte;
}

// ── Timer para reconstrução diferida ─────────────────────────────
let _idleCallbackId = null;

function _agendarReconstrucao() {
    if (_idleCallbackId) return; // já agendado
    const fn = () => {
        _idleCallbackId = null;
        const dados = coletarDadosDaTabela();
        salvarDados(dados);
        renderizarListaCompleta(dados);
        atualizarDropdown();
        atualizarPainelCompras();
    };
    // requestIdleCallback: executa no próximo frame ocioso (sem travar UI)
    // Fallback para setTimeout em navegadores sem suporte (iOS < 18)
    if (typeof requestIdleCallback === 'function') {
        _idleCallbackId = requestIdleCallback(fn, { timeout: 500 });
    } else {
        _idleCallbackId = setTimeout(() => { _idleCallbackId = null; fn(); }, 100);
    }
}

// ── API pública ───────────────────────────────────────────────────

export function renderizarListaCompleta(dados) {
    const containerItens = getContainer();
    if (!containerItens) return;

    containerItens.innerHTML = '';

    // Empty state — lista sem nenhum item
    if (!dados || dados.length === 0) {
        const tr = document.createElement('tr');
        tr.id = 'empty-state-lista';
        tr.innerHTML = `<td colspan="4" class="empty-state">
            <span class="empty-state-icon" aria-hidden="true">📦</span>
            <span class="empty-state-msg">Sua lista está vazia.</span>
            <span class="empty-state-hint">Adicione um produto na aba <strong>Adicionar</strong>.</span>
        </td>`;
        containerItens.appendChild(tr);
        return;
    }

    // BUG FIX #2: spread cria cópia rasa — o array original não é mutado.
    const sorted = [...dados].sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));

    const grupos = {
        carnes: [], laticinios: [], hortifruti: [], mercearia: [],
        temperos: [], limpeza: [], bebidas: [], embalagens: [], outros: []
    };
    sorted.forEach(item => grupos[identificarCategoria(item.n)].push(item));

    // BUG FIX #3: for...of Object.entries() — seguro contra protótipos poluídos.
    for (const [cat, itens] of Object.entries(grupos)) {
        if (itens.length === 0) continue;

        const trHeader = document.createElement('tr');
        trHeader.classList.add('categoria-header-row');
        trHeader.innerHTML = `<td colspan="4" class="categoria-header" data-cat="${cat}">${nomesCategorias[cat]}</td>`;
        containerItens.appendChild(trHeader);

        itens.forEach(item => inserirLinhaNoDOM(
            item.n, item.q, item.u, item.c,
            item.min, item.max, item.minUnit, item.maxUnit
        ));
    }
}

export function inserirLinhaNoDOM(n, q, u, chk, min, max, minUnit, maxUnit) {
    const containerItens = getContainer();
    if (!containerItens) return;

    const tr = document.createElement('tr');
    if (chk) tr.classList.add('linha-marcada');
    tr.dataset.min     = (min     != null) ? min     : '';
    tr.dataset.max     = (max     != null) ? max     : '';
    tr.dataset.minUnit = (minUnit != null) ? minUnit : '';
    tr.dataset.maxUnit = (maxUnit != null) ? maxUnit : '';

    tr.innerHTML = `
        <td class="col-check"><input type="checkbox" ${chk ? 'checked' : ''}></td>
        <td class="col-desc">
            <span contenteditable="true" class="nome-prod">${_esc(n)}</span>
        </td>
        <td class="col-qtd">
            <div class="qtd-cell-wrap">
                <input type="text" class="input-qtd-tabela" value="${_esc(q)}" readonly>
            </div>
        </td>
        <td class="col-unid"><select class="select-tabela">
            <option value="kg"  ${u === 'kg'  ? 'selected' : ''}>kg</option>
            <option value="g"   ${u === 'g'   ? 'selected' : ''}>g</option>
            <option value="ml"  ${u === 'ml'  ? 'selected' : ''}>ml</option>
            <option value="L"   ${u === 'L'   ? 'selected' : ''}>L</option>
            <option value="uni" ${u === 'uni' ? 'selected' : ''}>uni</option>
            <option value="pct" ${u === 'pct' ? 'selected' : ''}>pct</option>
            <option value="cx"  ${u === 'cx'  ? 'selected' : ''}>cx</option>
            <option value="bld" ${u === 'bld' ? 'selected' : ''}>bld</option>
            <option value="crt" ${u === 'crt' ? 'selected' : ''}>crt</option>
            <option value="frd" ${u === 'frd' ? 'selected' : ''}>frd</option>
            <option value="rl"  ${u === 'rl'  ? 'selected' : ''}>rl</option>
        </select></td>
    `;
    containerItens.appendChild(tr);
}

export function atualizarStatusSave() {
    // BUG FIX #4: null-guard
    const s = document.getElementById('status-save');
    if (!s) return;
    s.style.opacity = '1';
    setTimeout(() => { s.style.opacity = '0'; }, 1500);
}

/**
 * Sincroniza o span .qtd-unit-suffix com a unidade do select da mesma linha.
 * Chamado ao inserir a linha, ao trocar unidade e em _atualizarLinhaDOM.
 * @param {HTMLElement} tr  — o <tr> da linha de estoque
 */
export function atualizarSufixoUnidade(tr) {
    const sel    = tr?.querySelector('.select-tabela');
    const sufixo = tr?.querySelector('.qtd-unit-suffix');
    if (sel && sufixo) sufixo.textContent = sel.value;
}

/**
 * Chamado no blur do .nome-prod (renomeação de item).
 *
 * Camada 1 — atualização in-place:
 *   Se categoria e posição alfabética não mudaram, atualiza só os
 *   atributos do <tr> existente. Zero reflow, imperceptível ao usuário.
 *
 * Camada 2 — reconstrução diferida:
 *   Se categoria ou posição mudou, agenda reconstrução via
 *   requestIdleCallback para o próximo frame ocioso (máx 500ms).
 *   A UI não trava — o usuário continua interagindo normalmente.
 */
export function salvarEAtualizar() {
    const dados  = coletarDadosDaTabela();
    salvarDados(dados);

    // Tenta atualização in-place para cada item
    let precisaReconstruir = false;

    for (const item of dados) {
        const tr = _trPorNome(item.n);
        if (!tr) {
            // Item não encontrado no DOM (foi adicionado ou renomeado para nome não existente)
            precisaReconstruir = true;
            break;
        }

        const catAtual  = _categoriaDoTr(tr);
        const catNova   = identificarCategoria(item.n);

        if (catAtual !== catNova || !_posicaoCorreta(tr, item.n)) {
            precisaReconstruir = true;
            break;
        }

        // Posição e categoria corretas — atualiza só os atributos
        _atualizarLinhaDOM(tr, item);
    }

    if (precisaReconstruir) {
        // Reconstrução diferida — não bloqueia o frame atual
        _agendarReconstrucao();
    } else {
        // Atualização in-place completa — atualiza dropdown e painel imediatamente
        atualizarDropdown();
        atualizarPainelCompras();
    }
}

// ── Melhoria #6 — Coluna Unid oculta por padrão ──────────────────
// Chave de storage: 'sf_unid_visivel' → '1' (visível) | ausente/outro (oculta)
// Acionamento: long-press (400ms) em qualquer .qtd-unit-suffix da tabela
// ou em qualquer .col-qtd (área maior).
// Em desktop: click simples no .qtd-unit-suffix.

const _UNID_KEY = 'sf_unid_visivel';

function _setUnidVisivel(tabela, visivel) {
    tabela.classList.toggle('unid-visivel', visivel);
    if (visivel) {
        localStorage.setItem(_UNID_KEY, '1');
    } else {
        localStorage.removeItem(_UNID_KEY);
    }
}

export function initUnidToggle() {
    const tabela = document.getElementById('tabela-estoque');
    if (!tabela) return;

    // Aplica estado salvo
    const salvo = localStorage.getItem(_UNID_KEY) === '1';
    _setUnidVisivel(tabela, salvo);

    let _lpTimer = null;
    let _lpTarget = null;
    const LONG_PRESS_MS = 400;

    function _cancelLP() {
        clearTimeout(_lpTimer);
        _lpTimer = null;
        _lpTarget = null;
    }

    function _toggle() {
        const agora = tabela.classList.contains('unid-visivel');
        _setUnidVisivel(tabela, !agora);
    }

    // ── Touch: long-press em col-qtd (inclui sufixo) ──────────────
    tabela.addEventListener('touchstart', e => {
        const alvo = e.target.closest('.col-qtd');
        if (!alvo) return;
        _lpTarget = alvo;
        _lpTimer = setTimeout(() => {
            _toggle();
            // Feedback haptic se disponível
            if (navigator.vibrate) navigator.vibrate(30);
            _lpTarget = null;
            _lpTimer = null;
        }, LONG_PRESS_MS);
    }, { passive: true });

    tabela.addEventListener('touchend',    _cancelLP, { passive: true });
    tabela.addEventListener('touchcancel', _cancelLP, { passive: true });
    tabela.addEventListener('touchmove',   _cancelLP, { passive: true });

    // ── Desktop: click no sufixo quando col-unid está oculta ──────
    tabela.addEventListener('click', e => {
        if (tabela.classList.contains('unid-visivel')) return;
        if (!e.target.closest('.qtd-unit-suffix')) return;
        _toggle();
    });
}
