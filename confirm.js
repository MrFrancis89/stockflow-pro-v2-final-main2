// confirm.js — StockFlow Pro v9.9.10
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — configurarListenersConfirm() acumula event listeners a cada chamada
//   PROBLEMA : Se a função for chamada mais de uma vez (re-init, navegação SPA,
//              hot-reload), addEventListener em #modal-btn-confirm e
//              #modal-btn-cancel adiciona handlers duplicados. Resultado:
//              o callback de confirmação dispara N vezes e darFeedback() emite
//              N beeps/vibrações simultâneos.
//   CORREÇÃO : Guarda { once: false } com AbortController para cancelar todos
//              os listeners anteriores antes de re-registrar. Alternativa mais
//              simples: guard com flag _confirmListenersInit.
//
// BUG #2 — _abrirModal usa .innerText em vez de .textContent
//   PROBLEMA : .innerText força reflow de layout. Para texto simples sem HTML,
//              .textContent é mais eficiente e seguro (evita XSS se msg vier
//              de fonte externa).
//   CORREÇÃO : .textContent em todos os usos de texto simples.
// ══════════════════════════════════════════════════════════════════

import { darFeedback } from './utils.js';
import { abrirComFoco, fecharComFoco } from './modal.js';

let acaoConfirmacao = null;

// BUG FIX #1: AbortController garante que uma nova chamada a
// configurarListenersConfirm() remove todos os listeners anteriores
// antes de registrar os novos — sem acúmulo.
let _confirmAbortCtrl = null;

// ── Confirmação com callback ──────────────────────────────────────
export function mostrarConfirmacao(msg, callback, tipoBotao = 'perigo') {
    darFeedback();
    _abrirModal(msg, true, tipoBotao);
    acaoConfirmacao = callback;
}

// ── Alerta simples (sem callback) ─────────────────────────────────
export function mostrarAlertaElegante(msg) {
    _abrirModal(msg, false, 'alerta');
    acaoConfirmacao = null;
}

// ── API interna ───────────────────────────────────────────────────
function _abrirModal(msg, mostrarCancelar, tipoBotao) {
    // BUG FIX #2: textContent é mais rápido e seguro que innerText para texto simples.
    document.getElementById('modal-text').textContent = msg;

    const btnCancel  = document.getElementById('modal-btn-cancel');
    const btnConfirm = document.getElementById('modal-btn-confirm');

    btnCancel.style.display  = mostrarCancelar ? 'block' : 'none';
    btnCancel.textContent    = 'Cancelar';
    btnConfirm.style.display = 'block';
    btnConfirm.textContent   = mostrarCancelar ? 'Confirmar' : 'OK';
    btnConfirm.className     = 'modal-btn-confirmar ' + tipoBotao;

    document.getElementById('modal-confirm').style.display = 'flex';
    abrirComFoco(document.getElementById('modal-confirm'));
}

export function fecharModal() {
    const el = document.getElementById('modal-confirm');
    fecharComFoco(el);
    el.style.display = 'none';
    acaoConfirmacao = null;
}

export function configurarListenersConfirm() {
    // BUG FIX #1: cancela listeners da chamada anterior antes de reregistrar.
    if (_confirmAbortCtrl) _confirmAbortCtrl.abort();
    _confirmAbortCtrl = new AbortController();
    const signal = _confirmAbortCtrl.signal;

    document.getElementById('modal-btn-confirm').addEventListener('click', () => {
        darFeedback('heavy');
        if (typeof acaoConfirmacao === 'function') acaoConfirmacao();
        fecharModal();
    }, { signal });

    document.getElementById('modal-btn-cancel').addEventListener('click', () => {
        darFeedback('light');
        fecharModal();
    }, { signal });

    // Ouve evento de utils.js (copiarFallback) sem criar import circular.
    document.addEventListener('modal:alert', e => {
        mostrarAlertaElegante(e.detail?.msg || 'Erro.');
    }, { signal });
}