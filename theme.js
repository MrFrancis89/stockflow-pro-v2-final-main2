// theme.js — StockFlow Pro v9.9.20
// ══════════════════════════════════════════════════════════════════
// Módulo extraído de main.js (v9.9.5 — decomposição do God Object).
// Responsabilidade única: gerenciamento de temas visuais.
// Exporta: aplicarTema, ciclarTema, aplicarTemaInicial
// v9.9.20 — #18: botão mostra próximo tema (ícone atual → próximo)
// ══════════════════════════════════════════════════════════════════

import { carregarTema, salvarTema } from './storage.js';
import { darFeedback } from './utils.js';
import appStore from './store.js';

const TEMAS    = ['escuro', 'midnight', 'arctic', 'forest'];
const TEMA_CSS = { midnight: 'theme-midnight', arctic: 'theme-arctic', forest: 'theme-forest' };

// Ícone e rótulo de cada tema (usados para mostrar o próximo)
const TEMA_META = {
    escuro:   { icon: '🌑', label: 'dark'  },
    midnight: { icon: '🌃', label: 'oled'  },
    arctic:   { icon: '☀️',  label: 'light' },
    forest:   { icon: '🌿', label: 'verde' },
};

/**
 * Envia o tema atual para o iframe da Ficha Técnica via postMessage.
 * Usa targetOrigin window.location.origin — same-origin garantido
 * pela arquitetura do app. Falha silenciosa: a FT lerá do localStorage
 * no próximo carregamento.
 */
function _sincronizarTemaFT(tema) {
    const iframe = document.getElementById('ft-iframe');
    if (!iframe || !iframe.contentWindow) return;
    const origin = window.location.origin;
    // Não enviar se origin for null/opaco (ex: file://). '*' como targetOrigin
    // é inseguro — enviaria o payload para qualquer origem.
    // A FT lerá o tema do localStorage no próximo carregamento como fallback.
    if (!origin || origin === 'null') return;
    try {
        iframe.contentWindow.postMessage({ type: 'SF_TEMA', tema }, origin);
    } catch (e) {
        // Falha silenciosa intencional
    }
}

/**
 * Aplica um tema ao documento e persiste a escolha.
 * @param {string} tema - 'escuro' | 'midnight' | 'arctic' | 'forest'
 */
export function aplicarTema(tema) {
    const body = document.body;
    const html = document.documentElement;

    ['theme-midnight', 'theme-arctic', 'theme-forest', 'light-mode'].forEach(c => {
        body.classList.remove(c);
        html.classList.remove(c);
    });

    if (TEMA_CSS[tema]) {
        body.classList.add(TEMA_CSS[tema]);
        html.classList.add(TEMA_CSS[tema]);          // FIX: html.theme-* para background-color
        if (tema === 'arctic') {
            body.classList.add('light-mode');
            html.classList.add('light-mode');
        }
    }
    // Remove apenas as classes de tema antigas do html — preserva outras classes
    // (ex: classes adicionadas por outros módulos). A linha anterior já adicionou
    // a classe correta; aqui limpamos apenas o resíduo do FOUC pré-boot.
    // Nota: não zeramos html.className inteiro para não remover classes não-tema.
    html.className = html.className
        .replace(/theme-midnight|theme-arctic|theme-forest|light-mode/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (TEMA_CSS[tema]) html.classList.add(TEMA_CSS[tema]);
    if (tema === 'arctic') html.classList.add('light-mode');

    salvarTema(tema);
    appStore.set({ tema });

    // #18 — Botão mostra o PRÓXIMO tema: ícone atual + "→ próximo"
    const btn = document.getElementById('btn-tema');
    if (btn) {
        const proximo  = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
        const metaAtual = TEMA_META[tema]    || TEMA_META.escuro;
        const metaProx  = TEMA_META[proximo] || TEMA_META.escuro;

        const iconEl  = btn.querySelector('.btn-theme-icon');
        const labelEl = btn.querySelector('.btn-theme-label');

        if (iconEl)  iconEl.textContent  = metaAtual.icon;
        if (labelEl) labelEl.textContent = `→ ${metaProx.label}`;

        btn.setAttribute('aria-label', `Tema atual: ${metaAtual.label}. Mudar para ${metaProx.label}`);
        btn.title = `→ ${metaProx.label}`;
    }

    _sincronizarTemaFT(tema);
}

/**
 * Lê o tema salvo e aplica. Chamado uma única vez no boot (DOMContentLoaded).
 * Sem tema salvo, respeita prefers-color-scheme do sistema (#18):
 *   light → arctic  |  dark/sem preferência → escuro
 */
export function aplicarTemaInicial() {
    const salvo = carregarTema();
    if (salvo) {
        aplicarTema(salvo);
        return;
    }
    const prefereClaro = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    aplicarTema(prefereClaro ? 'arctic' : 'escuro');
}

/**
 * Avança para o próximo tema no ciclo de 4 temas.
 * Disparado pelo botão #btn-tema.
 */
export function ciclarTema() {
    darFeedback();
    const atual = appStore.get('tema') || carregarTema() || 'escuro';
    aplicarTema(TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length]);
}
