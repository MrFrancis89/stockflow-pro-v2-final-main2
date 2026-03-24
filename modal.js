// modal.js — StockFlow Pro v9.9.10
// ══════════════════════════════════════════════════════════════════
// #15 — Focus trap genérico para todos os modais
//
// API:
//   abrirComFoco(modalEl)  — chame DEPOIS de display='flex' (ou visible)
//   fecharComFoco(modalEl) — chame ANTES de display='none'
//
// Comportamento:
//   • Move foco para o primeiro elemento focalizável dentro do modal
//   • Tab/Shift+Tab circulam dentro do modal (nunca saem)
//   • Ao fechar, restaura foco no elemento que estava ativo antes
//   • Usa WeakMap → sem risco de vazamento de memória
//   • Usa AbortController → sem acúmulo de listeners
// ══════════════════════════════════════════════════════════════════

const FOCUSABLE_SEL = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Estado por modal aberto.
 * @type {WeakMap<Element, { previouslyFocused: Element|null, ac: AbortController }>}
 */
const _state = new WeakMap();

/**
 * Retorna os elementos focalizáveis visíveis dentro de `root`.
 * @param {Element} root
 * @returns {Element[]}
 */
function _getFocusable(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE_SEL)).filter(el => {
        if (el.offsetParent === null) return false;          // display:none em ancestral
        if (el.closest('[hidden]')) return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

/**
 * Ativa o focus trap no modal.
 * Deve ser chamado DEPOIS de o modal estar visível no DOM.
 *
 * @param {Element} modalEl  — o elemento overlay/container do modal
 */
export function abrirComFoco(modalEl) {
    if (!modalEl) return;

    // Se já está aberto, não re-registra
    if (_state.has(modalEl)) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const ac = new AbortController();
    const { signal } = ac;

    _state.set(modalEl, { previouslyFocused, ac });

    // Move foco para o primeiro elemento focalizável (após o browser pintar)
    requestAnimationFrame(() => {
        const els = _getFocusable(modalEl);
        els[0]?.focus();
    });

    // Trap: Tab / Shift+Tab circulam dentro do modal
    modalEl.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;

        const els = _getFocusable(modalEl);
        if (els.length === 0) { e.preventDefault(); return; }

        const first = els[0];
        const last  = els[els.length - 1];

        if (e.shiftKey) {
            // Shift+Tab no primeiro → vai para o último
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            // Tab no último → vai para o primeiro
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, { signal });
}

/**
 * Desativa o focus trap e restaura o foco anterior.
 * Deve ser chamado ANTES de esconder o modal.
 *
 * @param {Element} modalEl  — o mesmo elemento passado a abrirComFoco()
 */
export function fecharComFoco(modalEl) {
    if (!modalEl) return;

    const entry = _state.get(modalEl);
    if (!entry) return;

    entry.ac.abort();
    _state.delete(modalEl);

    // Restaura foco no elemento que estava ativo antes da abertura
    requestAnimationFrame(() => {
        entry.previouslyFocused?.focus?.();
    });
}
