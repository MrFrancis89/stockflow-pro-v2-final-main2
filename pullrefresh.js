// pullrefresh.js — StockFlow Pro v9.9.40
// ══════════════════════════════════════════════════════════════════
// Melhoria #17 — Pull-to-refresh no .table-wrapper
//
// Comportamento:
//   • Detecta swipe para baixo quando scroll do topo == 0
//   • Pull ≥ TRIGGER_PX (70px) → executa fbPullPrincipal() +
//     recarregarDados({ toast: 'Atualizado!' })
//   • Indicador visual: pill com spinner acima do table-wrapper
//   • Não conflita com swipe.js (direção Y vs X)
//   • Cancela se o dedo se move para os lados (|deltaX| > |deltaY|)
// ══════════════════════════════════════════════════════════════════

import { fbPullPrincipal } from './storage.js';
import { recarregarDados }  from './reload.js';

const TRIGGER_PX  = 70;   // distância mínima para disparar refresh
const MAX_PULL_PX = 100;  // distância máxima de deslocamento visual

let _startY      = 0;
let _startX      = 0;      // referência inicial para calcular deltaX corretamente
let _validStart  = false;  // true somente se touchstart ocorreu dentro do wrapper
let _pulling     = false;
let _running   = false;
let _indicator = null;
let _abortCtrl = null;

function _getIndicator() {
    if (!_indicator) {
        _indicator = document.createElement('div');
        _indicator.id = 'ptr-indicator';
        _indicator.className = 'ptr-indicator';
        _indicator.setAttribute('aria-hidden', 'true');
        _indicator.innerHTML = `
            <svg class="ptr-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2.2"
                    stroke-dasharray="32" stroke-dashoffset="10" stroke-linecap="round"/>
            </svg>
            <span class="ptr-label">Solte para atualizar</span>
        `;
        document.body.appendChild(_indicator);
    }
    return _indicator;
}

function _setIndicatorState(pullPx, triggered) {
    const ind = _getIndicator();
    // Posição: segue o pull até MAX_PULL_PX
    const offset = Math.min(pullPx, MAX_PULL_PX);
    ind.style.transform = `translateX(-50%) translateY(${offset - 40}px)`;
    ind.style.opacity   = Math.min(pullPx / TRIGGER_PX, 1).toFixed(2);
    ind.querySelector('.ptr-label').textContent = triggered
        ? 'Atualizando…'
        : pullPx >= TRIGGER_PX ? 'Solte para atualizar' : 'Puxe para atualizar';
    ind.classList.toggle('ptr-triggered', triggered);
}

function _hideIndicator() {
    if (!_indicator) return;
    _indicator.style.opacity   = '0';
    _indicator.style.transform = 'translateX(-50%) translateY(-40px)';
}

async function _doRefresh() {
    if (_running) return;
    _running = true;

    const ind = _getIndicator();
    ind.querySelector('.ptr-label').textContent = 'Atualizando…';
    ind.classList.add('ptr-triggered');
    // Spinner ativo
    ind.querySelector('.ptr-spinner').classList.add('ptr-spin-active');

    try {
        await fbPullPrincipal();
        recarregarDados({ toast: '✓ Lista atualizada!', toastTipo: 'sucesso' });
    } catch (e) {
        recarregarDados({ toast: 'Atualizado localmente.', toastTipo: 'info' });
    } finally {
        _running = false;
        _hideIndicator();
    }
}

export function initPullRefresh() {
    const wrapper = document.querySelector('.table-wrapper');
    if (!wrapper) return;

    if (_abortCtrl) _abortCtrl.abort();
    _abortCtrl = new AbortController();
    const { signal } = _abortCtrl;

    // O scroll acontece no body/window — detectamos nível de documento
    document.addEventListener('touchstart', e => {
        _validStart = false;                          // reseta a cada novo toque
        // Só inicia quando está no topo E o toque começa dentro do wrapper
        if (window.scrollY > 10) return;
        if (!wrapper.contains(e.target)) return;
        _startY      = e.touches[0].clientY;
        _startX      = e.touches[0].clientX;         // salva X inicial
        _pulling     = false;
        _validStart  = true;                          // toque válido dentro do wrapper
    }, { passive: true, signal });

    document.addEventListener('touchmove', e => {
        if (!_validStart || _running) return;          // ignora se não iniciou dentro do wrapper
        const deltaY = e.touches[0].clientY - _startY;
        const deltaX = e.touches[0].clientX - _startX; // deltaX real usando _startX
        if (deltaY < 5) return;                        // ainda não está puxando
        if (Math.abs(deltaX) > Math.abs(deltaY)) return; // arrasto horizontal — cancela
        if (window.scrollY > 10) return;               // não está no topo

        _pulling = true;
        _setIndicatorState(deltaY, false);
    }, { passive: true, signal });

    document.addEventListener('touchend', e => {
        _validStart = false;                           // reseta flag de toque válido
        if (!_pulling || _running) { _hideIndicator(); _pulling = false; return; }
        const deltaY = e.changedTouches[0].clientY - _startY;
        _pulling = false;

        if (deltaY >= TRIGGER_PX) {
            _doRefresh();
        } else {
            _hideIndicator();
        }
    }, { signal });
}
