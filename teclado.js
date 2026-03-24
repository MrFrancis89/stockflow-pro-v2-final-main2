// teclado.js — StockFlow Pro v9.7.4
import { abrirCalculadora } from './calculadora.js';

export function ativarModoTeclado(input) {
    if (!input) return;
    input.removeAttribute('readonly');
    input.classList.add('modo-teclado');
    input.focus();

    let parent = input.parentNode;
    // BUG FIX #12: parent.style.position = '' (ao reverter) limpava o estilo inline
    // mesmo quando o pai tinha position definido via inline style (não via classe CSS).
    // Exemplo: um pai com style="position:absolute" ficaria sem position após o revert.
    // Solução: salva o valor inline ANTES de qualquer modificação e restaura exatamente.
    const savedInlinePosition = parent.style.position;

    if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }
    if (!parent.classList.contains('input-com-calc')) {
        parent.classList.add('input-com-calc');
    }
    let oldIcon = parent.querySelector('.btn-calc-revert');
    if (oldIcon) oldIcon.remove();

    let icon = document.createElement('span');
    icon.className = 'btn-calc-revert';
    icon.innerHTML = '&#x1F9EE;';
    icon.setAttribute('title', 'Usar calculadora');
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        input.setAttribute('readonly', true);
        input.classList.remove('modo-teclado');
        icon.remove();
        parent.classList.remove('input-com-calc');
        // BUG FIX #12: restaura o valor inline original em vez de '' vazio.
        parent.style.position = savedInlinePosition;
        abrirCalculadora(input);
    });
    parent.appendChild(icon);
}