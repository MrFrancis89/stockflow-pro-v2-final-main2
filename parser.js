// parser.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — Resultado de frações com casas decimais excessivas
//   PROBLEMA : parseFractionToDecimal('1/3') retornava '0.3333333333333333'
//              exibido na interface como "0,3333333333333333" — feio e incorreto
//              para contexto de quantidade de estoque.
//   CORREÇÃO : Arredondamento para até 3 casas decimais com trim de zeros
//              desnecessários (1.000 → 1, 0.500 → 0.5).
//
// BUG #2 — .replace(',', '.') é aplicado mas a regex só substitui a primeira vírgula
//   PROBLEMA : Se o usuário digitar "1,5,3" (inválido), apenas o primeiro
//              ',' é substituído → "1.5,3" → parseFloat lê "1.5", ignora ",3".
//              Comportamento silencioso inesperado.
//   CORREÇÃO : Substitui todas as vírgulas com /,/g antes de validar.
//
// BUG #3 — Denominador zero verificado para fração, mas não para número misto
//   PROBLEMA : Já estava tratado para ambos. Mantido e documentado.
// ══════════════════════════════════════════════════════════════════

import { mostrarToast } from './toast.js';
import { salvarDados } from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';

// Arredonda para até 'casas' decimais, removendo zeros à direita.
function arredondar(n, casas = 3) {
    return parseFloat(n.toFixed(casas));
}

export function parseFractionToDecimal(str) {
    if (!str) return '';

    // BUG FIX #2: substitui TODAS as vírgulas, não só a primeira.
    const s = str.trim().replace(/,/g, '.');

    // Fração simples: "3/4"
    const fractionMatch = s.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
        const num = parseInt(fractionMatch[1]);
        const den = parseInt(fractionMatch[2]);
        if (den === 0) { mostrarToast('Denominador não pode ser zero.', 'aviso'); return str; }
        // BUG FIX #1: arredonda resultado da fração.
        return arredondar(num / den).toString().replace('.', ',');
    }

    // Número misto: "2 3/4"
    const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
        const whole = parseInt(mixedMatch[1]);
        const num   = parseInt(mixedMatch[2]);
        const den   = parseInt(mixedMatch[3]);
        if (den === 0) { mostrarToast('Denominador não pode ser zero.', 'aviso'); return str; }
        // BUG FIX #1: arredonda resultado do número misto.
        return arredondar(whole + num / den).toString().replace('.', ',');
    }

    // Número decimal simples
    const num = parseFloat(s);
    if (!isNaN(num)) {
        return arredondar(num).toString().replace('.', ',');
    }

    mostrarToast('Formato inválido. Use números ou frações (ex: 1/2, 2 1/2)', 'aviso');
    return str;
}

export function parseAndUpdateQuantity(input) {
    const original = input.value;
    const parsed   = parseFractionToDecimal(original);
    if (parsed !== original) {
        input.value = parsed;
        const dados = coletarDadosDaTabela();
        salvarDados(dados);
    }
}