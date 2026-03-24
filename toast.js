// toast.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// v10.0 — UX Premium:
//   • mostrarToast(msg, tipo?) — tipos: 'info' | 'sucesso' | 'erro' | 'aviso'
//   • Ícones SVG inline por tipo
//   • Animação de entrada (slide-up) + saída (fade)
//   • mostrarToastUndo(msg, onUndo, duracaoMs?) — inalterado (já premium)
//   • Retrocompatível: mostrarToast(msg) funciona igual à v9.x
//
// v9.9.6 — mostrarToastUndo: toast com botão "Desfazer" e barra de progresso.
// v9.7.4 — mostrarAlertaElegante removido; innerText → textContent
// ══════════════════════════════════════════════════════════════════

// ─── Ícones SVG por tipo ──────────────────────────────────────────
const _S = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">${d}</svg>`;
const _ICO = {
    info:    _S('<circle cx="10" cy="10" r="8"/><line x1="10" y1="7" x2="10" y2="10"/><line x1="10" y1="13" x2="10.01" y2="13"/>'),
    sucesso: _S('<circle cx="10" cy="10" r="8"/><polyline points="7 10 9.5 12.5 13.5 8"/>'),
    erro:    _S('<circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/>'),
    aviso:   _S('<path d="M9.13 3.36L1.64 16.5a1 1 0 00.87 1.5h15.78a1 1 0 00.87-1.5L10.87 3.36a1 1 0 00-1.74 0z"/><line x1="10" y1="9" x2="10" y2="13"/><line x1="10" y1="16" x2="10.01" y2="16"/>'),
};

function _getContainer() {
    return document.getElementById('toast-container');
}

/**
 * Exibe um toast simples.
 * @param {string} msg  Mensagem para exibir
 * @param {'info'|'sucesso'|'erro'|'aviso'} [tipo='info']
 * @param {number} [duracaoMs=3000]
 */
export function mostrarToast(msg, tipo = 'info', duracaoMs = 3000) {
    const container = _getContainer();
    if (!container) { console.warn('[toast] #toast-container não encontrado.'); return; }

    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    // Ícone + mensagem — msg via textContent (seguro contra XSS)
    toast.innerHTML = `<span class="toast-ico" aria-hidden="true">${_ICO[tipo] || _ICO.info}</span><span class="toast-msg"></span>`;
    toast.querySelector('.toast-msg').textContent = msg;

    container.appendChild(toast);

    // Entrada: força reflow antes de adicionar classe de animação
    toast.getBoundingClientRect();
    toast.classList.add('toast--in');

    setTimeout(() => {
        toast.classList.remove('toast--in');
        toast.classList.add('toast--out');
        setTimeout(() => toast.remove(), 320);
    }, duracaoMs);
}

/**
 * Exibe um toast com botão "Desfazer" e barra de progresso.
 * A ação destrutiva JÁ FOI executada antes de chamar esta função.
 *
 * @param {string}   msg         Mensagem (ex: "Quantidades zeradas")
 * @param {Function} onUndo      Callback executado ao clicar "Desfazer"
 * @param {number}   [duracaoMs=8000] Janela para desfazer em ms
 * @returns {Function} cancel() — remove o toast sem executar onUndo
 */
export function mostrarToastUndo(msg, onUndo, duracaoMs = 8000) {
    const container = _getContainer();
    if (!container) { console.warn('[toast] #toast-container não encontrado.'); return () => {}; }

    const toast = document.createElement('div');
    toast.className = 'toast toast--undo';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.pointerEvents = 'all';

    toast.innerHTML = `
        <span class="toast-ico" aria-hidden="true">${_ICO.aviso}</span>
        <span class="toast-undo-msg"></span>
        <button class="toast-undo-btn" type="button" aria-label="Desfazer ação">Desfazer</button>
        <div class="toast-undo-bar" role="progressbar"
             aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
            <div class="toast-undo-bar-fill"></div>
        </div>
    `;

    toast.querySelector('.toast-undo-msg').textContent = msg;
    container.appendChild(toast);

    // Entrada
    toast.getBoundingClientRect();
    toast.classList.add('toast--in');

    // Barra de progresso regressiva
    const fill = toast.querySelector('.toast-undo-bar-fill');
    fill.style.transition = `width ${duracaoMs}ms linear`;
    fill.getBoundingClientRect();
    fill.style.width = '0%';

    let _resolvido = false;

    function _remover() {
        toast.classList.remove('toast--in');
        toast.classList.add('toast--out');
        setTimeout(() => toast.remove(), 320);
    }

    const timer = setTimeout(() => {
        if (_resolvido) return;
        _resolvido = true;
        _remover();
    }, duracaoMs);

    toast.querySelector('.toast-undo-btn').addEventListener('click', () => {
        if (_resolvido) return;
        _resolvido = true;
        clearTimeout(timer);
        _remover();
        onUndo();
    });

    return function cancel() {
        if (_resolvido) return;
        _resolvido = true;
        clearTimeout(timer);
        _remover();
    };
}
