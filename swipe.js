// swipe.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — Race condition em closeSwipe() com setTimeout
//   PROBLEMA : O closure do setTimeout captura 'swipedRow' via referência
//              à variável do módulo. Se 'swipedRow' mudar durante os 300ms
//              (outro item deslizado), o guard '!swipedRow || swipedRow === tr'
//              produz resultado errado: o swipeBg some/fica na posição errada.
//   CORREÇÃO : Captura local 'const capturedSwipedRow = swipedRow' antes
//              do setTimeout, comparando contra o valor no momento do agendamento.
//
// BUG #2 — _swipeBgPronto guard não é resetado quando initSwipe() é chamada
//          após reconstrução do DOM
//   PROBLEMA : Se o elemento #swipe-bg for recriado (innerHTML do pai limpo),
//              _swipeBgPronto=true previne que os botões sejam reconstruídos,
//              deixando o swipeBg sem handlers.
//   CORREÇÃO : Detecta se os botões ainda existem dentro do swipeBg atual
//              antes de confiar no guard.
//
// BUG #3 — justSwiped: variável de módulo não exportada e nunca lida neste arquivo
//   PROBLEMA : 'justSwiped' é atribuída mas jamais lida dentro deste módulo.
//              Código morto que confunde leitores.
//   CORREÇÃO : Removida. Se main.js precisar desse estado, deve ser exportada.
//
// BUG #4 — Fallback 'e.clientX' em listener 'touchend' é código morto
//   PROBLEMA : O evento 'touchend' SEMPRE possui changedTouches — a condição
//              ternária 'e.changedTouches ? ... : e.clientX' nunca usa e.clientX.
//   CORREÇÃO : Acesso direto a e.changedTouches[0].clientX sem ternário.
//
// BUG #5 — swipedRow mantém referência a nó DOM removido após exclusão
//   PROBLEMA : Após removerLinhaSwipe(), closeSwipe() ainda usa swipedRow para
//              comparar, mas o nó já foi removido do DOM. Não causa crash mas
//              o guard condicional fica incorreto.
//   CORREÇÃO : swipedRow é explicitamente zerado antes de chamar closeSwipe
//              quando a linha foi removida.
// ══════════════════════════════════════════════════════════════════

import { salvarDados } from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';
import { abrirModalAlerta } from './alerta.js';
import { mostrarToastUndo } from './toast.js';
import { atualizarPainelCompras } from './compras.js';

let swipeStartX = 0, swipeStartY = 0, swipeCurrentX = 0;
let isSwiping = false, isScrolling = false, swipedRow = null;
const swipeWidth = 160;

const DIRECTION_THRESHOLD = 8;
const SWIPE_THRESHOLD     = 20;

let _swipeAbortCtrl = null;
let _swipeBgPronto  = false;

export function initSwipe() {
    const swipeBg   = document.getElementById('swipe-bg');
    const container = document.getElementById('lista-itens-container');
    if (!swipeBg || !container) return;

    if (_swipeAbortCtrl) _swipeAbortCtrl.abort();
    _swipeAbortCtrl = new AbortController();
    const signal = _swipeAbortCtrl.signal;

    const getClientX = e => e.touches ? e.touches[0].clientX : e.clientX;
    const getClientY = e => e.touches ? e.touches[0].clientY : e.clientY;

    // ── touchstart ────────────────────────────────────────────────
    container.addEventListener('touchstart', e => {
        const tr = e.target.closest('tr');
        if (!tr || tr.classList.contains('categoria-header-row')) return;
        if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') return;
        if (swipedRow && swipedRow !== tr) closeSwipe(swipedRow, swipeBg);

        swipeStartX   = getClientX(e);
        swipeStartY   = getClientY(e);
        isSwiping     = false;
        isScrolling   = false;
        swipeCurrentX = (swipedRow === tr) ? -swipeWidth : 0;
        tr.style.transition = 'none';
    }, { passive: true, signal });

    // ── touchmove ─────────────────────────────────────────────────
    container.addEventListener('touchmove', e => {
        const tr = e.target.closest('tr');
        if (!tr || tr.classList.contains('categoria-header-row')) return;
        const deltaX = getClientX(e) - swipeStartX;
        const deltaY = getClientY(e) - swipeStartY;
        const absDx  = Math.abs(deltaX);
        const absDy  = Math.abs(deltaY);

        if (!isSwiping && !isScrolling) {
            if (absDx < DIRECTION_THRESHOLD && absDy < DIRECTION_THRESHOLD) return;
            if (absDy >= absDx) { isScrolling = true; return; }
            if (absDx >= SWIPE_THRESHOLD) {
                isSwiping = true;
                // Blur uma única vez ao confirmar o gesto — evita forçar
                // recálculo de layout a cada frame do touchmove.
                if (document.activeElement) document.activeElement.blur();
            }
        }
        if (isScrolling) return;

        if (isSwiping) {
            if (e.cancelable) e.preventDefault();

            swipeBg.style.display = 'flex';
            swipeBg.style.top    = tr.offsetTop + 'px';
            swipeBg.style.height = tr.offsetHeight + 'px';

            let moveX = swipeCurrentX + deltaX;
            if (moveX > 0) moveX = 0;
            if (moveX < -swipeWidth) moveX = -swipeWidth;
            tr.style.transform = `translateX(${moveX}px)`;
        }
    }, { passive: false, signal });

    // ── touchend ──────────────────────────────────────────────────
    container.addEventListener('touchend', e => {
        const tr = e.target.closest('tr');
        if (!tr || tr.classList.contains('categoria-header-row')) return;
        if (!isSwiping) return;

        // BUG FIX #4: touchend sempre tem changedTouches — sem fallback morto.
        const endX   = e.changedTouches[0].clientX;
        const deltaX = endX - swipeStartX;
        const finalX = swipeCurrentX + deltaX;

        tr.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        if (finalX < -40) {
            tr.style.transform = `translateX(-${swipeWidth}px)`;
            swipedRow = tr;
        } else {
            closeSwipe(tr, swipeBg);
        }
    }, { signal });

    // ── Fechar ao tocar fora ──────────────────────────────────────
    document.addEventListener('touchstart', e => {
        if (
            swipedRow &&
            !swipedRow.contains(e.target) &&
            e.target.id !== 'swipe-bg' &&
            !e.target.closest('.swipe-btn')
        ) {
            closeSwipe(swipedRow, swipeBg);
        }
    }, { passive: true, signal });

    // ── Botões do swipeBg ─────────────────────────────────────────
    // BUG FIX #2: verifica se os botões ainda existem antes de confiar no guard.
    const btnJaExiste = swipeBg.querySelector('.swipe-btn-excluir');
    if (!_swipeBgPronto || !btnJaExiste) {
        swipeBg.innerHTML = `
            <button class="swipe-btn swipe-btn-excluir" aria-label="Apagar item">Apagar</button>
            <button class="swipe-btn swipe-btn-alerta" aria-label="Configurar alerta">Alerta</button>
        `;
        swipeBg.style.cssText = `width:${swipeWidth}px;display:none;flex-direction:row;align-items:stretch;padding:0;`;

        // Listeners nos botões não usam { signal } — devem sobreviver ao abort.
        swipeBg.querySelector('.swipe-btn-excluir').addEventListener('click', () => removerLinhaSwipe(swipeBg));
        swipeBg.querySelector('.swipe-btn-alerta').addEventListener('click', () => abrirModalAlertaSwipe(swipeBg));
        _swipeBgPronto = true;
    }
}

// ── Helpers ───────────────────────────────────────────────────────

function closeSwipe(tr, swipeBg) {
    if (tr) {
        tr.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
        tr.style.transform  = 'translateX(0px)';
    }

    // BUG FIX #1: captura os valores AGORA, antes do setTimeout.
    // O closure usa cópias locais, imune a mudanças subsequentes de swipedRow.
    const capturedSwipedRow = swipedRow;
    setTimeout(() => {
        if (!capturedSwipedRow || capturedSwipedRow === tr) {
            if (swipeBg) swipeBg.style.display = 'none';
            if (swipedRow === tr) swipedRow = null;
        }
    }, 300);
}

function removerLinhaSwipe(swipeBg) {
    if (!swipedRow) return;
    const linhaAlvo  = swipedRow;
    const nextSibling = linhaAlvo.nextElementSibling || null; // para undo: posição original
    const parent     = linhaAlvo.parentElement;

    // Fecha o swipeBg imediatamente
    swipedRow = null;
    closeSwipe(linhaAlvo, swipeBg);

    // ── Colapso inline: height → 0 em 300ms ─────────────────────
    const alturaOriginal = linhaAlvo.offsetHeight + 'px';
    linhaAlvo.style.overflow   = 'hidden';
    linhaAlvo.style.height     = alturaOriginal;
    linhaAlvo.style.transition = 'height 0.3s ease, opacity 0.3s ease, padding 0.3s ease';

    // Força reflow para transição funcionar
    linhaAlvo.getBoundingClientRect();

    linhaAlvo.style.height  = '0';
    linhaAlvo.style.opacity = '0';
    linhaAlvo.style.paddingTop    = '0';
    linhaAlvo.style.paddingBottom = '0';

    // Remove do DOM após animação
    const removeTimer = setTimeout(() => {
        if (linhaAlvo.parentElement) linhaAlvo.remove();
        const dados = coletarDadosDaTabela();
        salvarDados(dados);
        atualizarPainelCompras();
    }, 300);

    // ── Undo toast: 5s para desfazer ────────────────────────────
    const nomeItem = linhaAlvo.querySelector('.nome-prod')?.textContent?.trim() || 'Item';
    mostrarToastUndo(`"${nomeItem}" removido`, () => {
        // Undo: cancela remoção ou reinsere se já removido
        clearTimeout(removeTimer);

        if (!linhaAlvo.parentElement) {
            // Já foi removido — reinsere na posição original
            if (parent) {
                if (nextSibling && nextSibling.parentElement === parent) {
                    parent.insertBefore(linhaAlvo, nextSibling);
                } else {
                    parent.appendChild(linhaAlvo);
                }
            }
        }

        // Restaura estilos de colapso
        linhaAlvo.style.height     = alturaOriginal;
        linhaAlvo.style.opacity    = '1';
        linhaAlvo.style.paddingTop    = '';
        linhaAlvo.style.paddingBottom = '';

        // Limpa inline styles após transição
        setTimeout(() => {
            linhaAlvo.style.overflow   = '';
            linhaAlvo.style.height     = '';
            linhaAlvo.style.transition = '';
            linhaAlvo.style.opacity    = '';
        }, 320);

        const dados = coletarDadosDaTabela();
        salvarDados(dados);
        atualizarPainelCompras();
    }, 5000);
}

function abrirModalAlertaSwipe(swipeBg) {
    if (!swipedRow) return;
    abrirModalAlerta(swipedRow);
    closeSwipe(swipedRow, swipeBg);
}