// utils.js — StockFlow Pro v9.9.20
// Dependências: apenas toast.js (sem circulares)
// copiarFallback comunica com confirm.js via evento DOM desacoplado.
// v9.9.14 — #20: window.audioCtx → variável de módulo privada (_audioCtx)
// v9.9.20 — #12: darFeedback(intensity) — 3 intensidades haptic

import { mostrarToast } from './toast.js';

// ── Contexto de áudio — privado ao módulo, não polui window ──────
let _audioCtx = null;

// ── Tabela de intensidades ────────────────────────────────────────
// intensity : 'light' | 'medium' | 'heavy'   (padrão: 'light')
// Retro-compatível: darFeedback() sem argumento → 'light'
const _HAPTIC = {
    //            vibração (ms)    freq início  freq fim   gain   duração osc
    light:  { vib: 10,            freqA: 900,  freqB: 200, gain: 0.10, dur: 0.025 },
    medium: { vib: 20,            freqA: 650,  freqB: 120, gain: 0.20, dur: 0.035 },
    heavy:  { vib: [30, 10, 30],  freqA: 420,  freqB:  60, gain: 0.30, dur: 0.055 },
};

export function darFeedback(intensity = 'light') {
    const cfg = _HAPTIC[intensity] ?? _HAPTIC.light;

    // Vibração (Android + Safari iOS 13+ com permissão)
    if (navigator.vibrate) { navigator.vibrate(cfg.vib); }

    // Tom sonoro via Web Audio API
    try {
        if (!_audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            _audioCtx = new AudioContext();
        }
        if (_audioCtx.state === 'suspended') { _audioCtx.resume(); }
        const t    = _audioCtx.currentTime;
        const osc  = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(cfg.freqA, t);
        osc.frequency.exponentialRampToValueAtTime(cfg.freqB, t + cfg.dur);
        gain.gain.setValueAtTime(cfg.gain, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.start(t);
        osc.stop(t + cfg.dur + 0.005);
    } catch (e) {}
}

export function obterDataAtual()  { return new Date().toLocaleDateString('pt-BR'); }

export function obterDataAmanha() {
    const hoje   = new Date();
    const amanha = new Date(hoje);
    amanha.setDate(hoje.getDate() + 1);
    return amanha.toLocaleDateString('pt-BR');
}

export function copiarParaClipboard(texto) {
    darFeedback();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto)
            .then(() => mostrarToast('Copiado com sucesso!', 'sucesso'))
            .catch(() => copiarFallback(texto));
    } else {
        copiarFallback(texto);
    }
}

// Fallback para contextos sem Clipboard API (ex: Safari legado).
// Usa evento DOM para sinalizar confirm.js sem criar dependência direta (evita circular).
function copiarFallback(texto) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
        document.execCommand('copy');
        mostrarToast('Copiado com sucesso!', 'sucesso');
    } catch (err) {
        // Abre modal de alerta via evento desacoplado (confirm.js ouve 'modal:alert')
        document.dispatchEvent(new CustomEvent('modal:alert', {
            detail: { msg: 'Erro ao copiar. Selecione o texto manualmente.' }
        }));
    }
    document.body.removeChild(ta);
}
/**
 * Escapa entidades HTML para uso seguro em template literals.
 * Centralizado aqui para eliminar esc() duplicada em massa.js e listafacil.js.
 */
export function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── #13 — Botões assíncronos: disabled + spinner inline ──────────
//
// comSpinner(btn, fn, minMs = 400)
//   • Salva conteúdo original do botão
//   • Injeta SVG spinner + "aguarde..." (acessível via aria-label)
//   • Desabilita o botão e chama fn() (sync ou async)
//   • Restaura após conclusão (mínimo minMs ms para feedback visual)
//
// Uso:
//   btn.addEventListener('click', () =>
//     comSpinner(btn, () => exportarJSON(VERSAO_ATUAL))
//   );

const _SPINNER_SVG = `<svg class="btn-spinner" width="16" height="16" viewBox="0 0 16 16"
  fill="none" aria-hidden="true">
  <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"
    stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/>
</svg>`;

export async function comSpinner(btn, fn, minMs = 400) {
    if (btn.disabled) return;               // evita duplo clique
    const labelOriginal = btn.getAttribute('aria-label') || btn.textContent.trim();
    const htmlOriginal  = btn.innerHTML;

    // Injeta spinner — mantém texto curto para não quebrar layout
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Aguarde…');
    btn.innerHTML = `${_SPINNER_SVG}<span class="btn-spinner-label">Aguarde…</span>`;

    const t0 = Date.now();
    try {
        await fn();
    } finally {
        // Garante mínimo de minMs para feedback visual percebido
        const elapsed = Date.now() - t0;
        if (elapsed < minMs) {
            await new Promise(r => setTimeout(r, minMs - elapsed));
        }
        btn.innerHTML = htmlOriginal;
        btn.disabled  = false;
        btn.setAttribute('aria-label', labelOriginal);
    }
}
