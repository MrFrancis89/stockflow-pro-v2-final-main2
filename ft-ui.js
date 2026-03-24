// ft-ui.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// CAMADA DE UI — Ficha Técnica
// REGRA: abrirModal() é SÍNCRONO na injeção. NUNCA use "await abrirModal()".
// ──────────────────────────────────────────────────────────────────
// v10.0 — TAREFA 5: loading states premium.
//   + renderSkeleton()  — placeholder shimmer durante carregamento
//   + setButtonLoading() — botão com spinner inline (sem layout shift)
//   + toast() aprimorado — tipos: 'sucesso' | 'erro' | 'aviso' | 'info'
//   + animação de entrada suave nos toasts (slide + fade)
// v3.1 — Correções de segurança (auditoria): XSS fixes #1–#4.
// ══════════════════════════════════════════════════════════════════
import { ico } from './ft-icons.js';

export function toast(msg, tipo = 'info') {
    const wrap = document.getElementById('ft-toast');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `ft-toast-item ft-toast-${tipo}`;
    const imap = { sucesso: ico.check, erro: ico.warn, aviso: ico.tip, info: ico.info };
    // FIX #1: slot vazio — msg nunca passa por innerHTML.
    el.innerHTML = `<span class="ft-t-ico">${imap[tipo] || ico.info}</span><span></span>`;
    el.querySelector('span:last-child').textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 350); }, 3400);
}

export function setLoading(show) {
    const el = document.getElementById('ft-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
}

/**
 * Aplica animação de entrada (section-enter) a um elemento de seção.
 * Chame após substituir o innerHTML do wrap para um feedback visual suave.
 * @param {HTMLElement|null} el
 */
export function animateSection(el) {
    if (!el) return;
    el.classList.remove('section-enter');
    void el.offsetWidth; // força reflow para reiniciar a animação
    el.classList.add('section-enter');
}

let _r1 = null;
export function abrirModal(html, { largo = false } = {}) {
    const ov = document.getElementById('ft-modal');
    const bx = document.getElementById('ft-modal-box');
    if (!ov || !bx) return Promise.resolve(null);
    // Drag handle pill — iOS HIG obrigatório em bottom sheets
    bx.innerHTML = '<div class="ft-modal-handle" aria-hidden="true"></div>' + html;
    bx.classList.toggle('largo', largo);
    ov.classList.add('open');
    requestAnimationFrame(() =>
        bx.querySelector('input:not([type=hidden]),select,textarea')?.focus()
    );
    return new Promise(r => { _r1 = r; });
}
export function fecharModal(v = null) {
    document.getElementById('ft-modal')?.classList.remove('open');
    if (_r1) { _r1(v); _r1 = null; }
}

let _r2 = null;
export function abrirModal2(html) {
    const ov = document.getElementById('ft-modal-2');
    const bx = document.getElementById('ft-modal-2-box');
    if (!ov || !bx) return Promise.resolve(null);
    bx.innerHTML = '<div class="ft-modal-handle" aria-hidden="true"></div>' + html;
    ov.classList.add('open');
    requestAnimationFrame(() =>
        bx.querySelector('input:not([type=hidden]),select,textarea')?.focus()
    );
    return new Promise(r => { _r2 = r; });
}
export function fecharModal2(v = null) {
    document.getElementById('ft-modal-2')?.classList.remove('open');
    if (_r2) { _r2(v); _r2 = null; }
}

export function confirmar(msg, { labelOK = 'Confirmar', perigo = true } = {}) {
    // FIX #2: slots vazios no HTML — msg e labelOK via textContent.
    const html = `
        <div class="ft-mhd">
            <span class="ft-mhd-title">Confirmar ação</span>
        </div>
        <div class="ft-mbody ft-confirm-body">
            <div class="ft-cfm-ico ${perigo ? 'danger' : 'info'}">${perigo ? ico.warn : ico.info}</div>
            <p class="ft-cfm-msg"></p>
        </div>
        <div class="ft-mft">
            <button class="ft-btn ft-btn-ghost" id="_cfmN">Cancelar</button>
            <button class="ft-btn ${perigo ? 'ft-btn-danger' : 'ft-btn-primary'}" id="_cfmY"></button>
        </div>`;
    const p = abrirModal(html);
    // Textos do usuário atribuídos via textContent — sem risco de XSS.
    // Usa getElementById (IDs únicos no modal) em vez de querySelector global,
    // que poderia selecionar um elemento em outro modal aberto simultaneamente.
    const bx = document.getElementById('ft-modal-box');
    if (bx) bx.querySelector('.ft-cfm-msg').textContent = msg;
    const btnY = document.getElementById('_cfmY');
    if (btnY) btnY.textContent = labelOK;
    document.getElementById('_cfmY')?.addEventListener('click', () => fecharModal(true),  { once: true });
    document.getElementById('_cfmN')?.addEventListener('click', () => fecharModal(false), { once: true });
    return p;
}

export function renderEmpty(el, icoSvg, titulo, sub = '', acao = null) {
    if (!el) return;
    // FIX #3: titulo, sub e acao.label via textContent — sem interpolação em innerHTML.
    el.innerHTML = `
        <div class="ft-empty">
            <div class="ft-empty-ico">${icoSvg}</div>
            <div class="ft-empty-title"></div>
            ${sub ? '<p class="ft-empty-sub"></p>' : ''}
            ${acao ? `<button class="ft-btn ft-btn-primary" id="_emptyBtn">
                <span class="ft-bico">${ico.plus}</span><span></span>
            </button>` : ''}
        </div>`;
    el.querySelector('.ft-empty-title').textContent = titulo;
    if (sub) el.querySelector('.ft-empty-sub').textContent = sub;
    if (acao) {
        // FIX: el.querySelector garante escopo no contêiner correto.
        // document.getElementById global retornaria o primeiro #_emptyBtn
        // no DOM se duas seções renderizarem empty state simultaneamente.
        const emptyBtn = el.querySelector('#_emptyBtn');
        if (emptyBtn) {
            const btnSpan = emptyBtn.querySelector('span:last-child');
            if (btnSpan) btnSpan.textContent = acao.label;
            emptyBtn.addEventListener('click', acao.fn, { once: true });
        }
    }
}

export function renderTutorial(secId, chave, icoSvg, titulo, passos) {
    if (localStorage.getItem('ft_tut_' + chave)) return;
    const sec = document.getElementById(secId);
    if (!sec) return;
    const tid = `_tut_${chave}`;
    if (document.getElementById(tid)) return;
    const el = document.createElement('div');
    el.id = tid; el.className = 'ft-tutorial';
    // FIX #4: titulo via textContent; passos via createElement — sem interpolação.
    el.innerHTML = `
        <div class="ft-tut-hd">
            <span class="ft-tut-ico">${icoSvg}</span>
            <span class="ft-tut-title"></span>
            <button class="ft-tut-close" id="_tc_${chave}" aria-label="Fechar">${ico.close}</button>
        </div>
        <ol class="ft-tut-list"></ol>`;
    el.querySelector('.ft-tut-title').textContent = titulo;
    const ol = el.querySelector('.ft-tut-list');
    passos.forEach(passo => {
        const li = document.createElement('li');
        li.textContent = passo;
        ol.appendChild(li);
    });
    sec.insertBefore(el, sec.firstChild);
    document.getElementById(`_tc_${chave}`)?.addEventListener('click', () => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 300);
        localStorage.setItem('ft_tut_' + chave, '1');
    }, { once: true });
}

export function debounce(fn, ms = 260) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function initModalOverlay() {
    document.getElementById('ft-modal')?.addEventListener('click', e => {
        if (e.target.id === 'ft-modal') fecharModal(null);
    });
    document.getElementById('ft-modal-2')?.addEventListener('click', e => {
        if (e.target.id === 'ft-modal-2') fecharModal2(null);
    });
}

// ══════════════════════════════════════════════════════════════════
// TAREFA 5 — Loading States Premium (v10.0)
// ══════════════════════════════════════════════════════════════════

/**
 * Renderiza cards skeleton (shimmer) no container enquanto dados carregam.
 * Remove automaticamente ao chamar renderSkeleton(el, 0).
 *
 * @param {HTMLElement} el        - Container alvo
 * @param {number}      [count=3] - Número de cards skeleton. 0 = limpar.
 * @param {'card'|'row'|'list'} [tipo='card'] - Layout do skeleton
 */
export function renderSkeleton(el, count = 3, tipo = 'card') {
    if (!el) return;
    if (count === 0) {
        el.querySelectorAll('.ft-skeleton').forEach(s => s.remove());
        return;
    }
    const templates = {
        card: `<div class="ft-skeleton ft-skeleton-card">
                 <div class="ft-sk-line ft-sk-title"></div>
                 <div class="ft-sk-line ft-sk-sub"></div>
                 <div class="ft-sk-line ft-sk-sub ft-sk-short"></div>
               </div>`,
        row:  `<div class="ft-skeleton ft-skeleton-row">
                 <div class="ft-sk-avatar"></div>
                 <div class="ft-sk-lines">
                   <div class="ft-sk-line ft-sk-title"></div>
                   <div class="ft-sk-line ft-sk-sub"></div>
                 </div>
               </div>`,
        list: `<div class="ft-skeleton ft-skeleton-list">
                 <div class="ft-sk-line ft-sk-title"></div>
               </div>`,
    };
    const html = templates[tipo] || templates.card;
    el.insertAdjacentHTML('afterbegin', html.repeat(count));
}

/**
 * Coloca um botão em estado de loading (spinner inline).
 * Retorna função para restaurar o botão ao estado original.
 *
 * Uso:
 *   const restore = setButtonLoading(btn, 'Salvando…');
 *   await save();
 *   restore();
 *
 * @param {HTMLButtonElement} btn
 * @param {string} [label='Aguarde…']
 * @returns {Function} restore
 */
export function setButtonLoading(btn, label = 'Aguarde…') {
    if (!btn) return () => {};
    const original = btn.innerHTML;
    const originalDisabled = btn.disabled;
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="ft-btn-spinner" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                     M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>${label}</span>`;
    return function restore() {
        btn.innerHTML = original;
        btn.disabled = originalDisabled;
    };
}

/**
 * Toast com suporte a ação inline (callback opcional).
 * Sobrescreve o export padrão — tipos: sucesso | erro | aviso | info.
 * Compatível com chamadas existentes toast(msg, tipo).
 *
 * @param {string}   msg
 * @param {'sucesso'|'erro'|'aviso'|'info'} [tipo='info']
 * @param {{label?: string, fn?: Function, duracao?: number}} [opcoes]
 */
export function toastAction(msg, tipo = 'info', opcoes = {}) {
    const wrap = document.getElementById('ft-toast');
    if (!wrap) return;
    const { label, fn, duracao = 4000 } = opcoes;
    const imap = { sucesso: ico.check, erro: ico.warn, aviso: ico.tip, info: ico.info };
    const el = document.createElement('div');
    el.className = `ft-toast-item ft-toast-${tipo}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
        <span class="ft-t-ico">${imap[tipo] || ico.info}</span>
        <span class="ft-t-msg"></span>
        ${label && fn ? `<button class="ft-t-action" type="button"></button>` : ''}`;
    el.querySelector('.ft-t-msg').textContent = msg;
    if (label && fn) el.querySelector('.ft-t-action').textContent = label;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const _dismiss = () => {
        el.classList.remove('on');
        setTimeout(() => el.remove(), 350);
    };
    if (label && fn) {
        el.querySelector('.ft-t-action').addEventListener('click', () => {
            _dismiss();
            fn();
        }, { once: true });
    }
    setTimeout(_dismiss, duracao);
}

// ── Ripple effect em botões (Tarefa 5 — UX Premium) ──────────────
// Inicializado uma vez via initRipple(); event delegation no documento.
let _rippleInit = false;
export function initRipple() {
    if (_rippleInit) return;
    _rippleInit = true;
    document.addEventListener('pointerdown', e => {
        const btn = e.target.closest('.ft-btn');
        if (!btn) return;
        // Remove ripples anteriores para evitar acúmulo
        btn.querySelectorAll('.ft-ripple').forEach(r => r.remove());
        const rect = btn.getBoundingClientRect();
        const r = document.createElement('span');
        r.className = 'ft-ripple';
        r.style.left = (e.clientX - rect.left) + 'px';
        r.style.top  = (e.clientY - rect.top)  + 'px';
        btn.appendChild(r);
        r.addEventListener('animationend', () => r.remove(), { once: true });
    }, { passive: true });
}

// ── Skeleton helpers ──────────────────────────────────────────────


