// ft-format.js — v3.1
// Fix: n2input() converte número JS para string BR (evita bug parseNum com ponto decimal)
export function formatCurrency(n) {
    if (n == null || isNaN(n)) return 'R$ 0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
export function formatPercent(n, isDecimal = false) {
    if (n == null || isNaN(n)) return '0,00%';
    const v = isDecimal ? n * 100 : n;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}
export function formatQtdUnid(qtd, unidade) {
    if (qtd == null) return '—';
    const f = qtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    return `${f} ${unidade}`;
}
export function formatNum(n, decimais = 2) {
    if (n == null || isNaN(n)) return '0';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}
// ── Parse numérico unificado ────────────────────────────────────────
// Implementação canônica reside em ft-engine.js.
// Re-exportada aqui para compatibilidade com importadores existentes.
export { parseNum } from './ft-engine.js';
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
export function formatDataCurta(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
export const TAMANHO_LABEL = { P: 'P (25cm)', M: 'M (30cm)', G: 'G (35cm)', GG: 'GG (40cm)' };
export const UNIDADE_LABEL = { g: 'g', kg: 'kg', ml: 'ml', l: 'L', uni: 'uni', pct: 'pct', cx: 'cx', bld: 'bld', crt: 'crt', frd: 'frd', rl: 'rl' };
export const PORCOES_PADRAO = { P: 6, M: 8, G: 10, GG: 12 };

/**
 * Converte número JS → string BR para pré-preenchimento de inputs.
 * Evita o bug de parseNum("2.5") → 25 (ponto confundido com sep. de milhar).
 *   n2input(2.5)        → "2,5"
 *   n2input(35, 2, 2)   → "35,00"
 *   n2input(1000, 0, 0) → "1.000"
 */
export function n2input(n, minDec = 0, maxDec = 3) {
    if (n == null || isNaN(Number(n)) || n === '') return '';
    return Number(n).toLocaleString('pt-BR', {
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDec,
    });
}

// ── Utilitários centralizados (v3.2) ─────────────────────────────

/**
 * Escapa entidades HTML para uso seguro em template literals.
 * Centralizado aqui para eliminar _esc() duplicada em todos os módulos ft-*.
 */
export function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Máscara decimal para inputs de quantidade (ex: 2,5 kg).
 * • dot → vírgula  • permite apenas dígitos + uma vírgula
 * • preserva posição do cursor ao reescrever o valor
 */
export function applyMaskDecimal(inp) {
    inp.addEventListener('keydown', e => {
        if (e.key === '.') {
            e.preventDefault();
            const pos = inp.selectionStart;
            const val = inp.value;
            if (!val.includes(',')) {
                inp.value = val.slice(0, pos) + ',' + val.slice(inp.selectionEnd);
                inp.setSelectionRange(pos + 1, pos + 1);
                inp.dispatchEvent(new Event('input'));
            }
        }
    });
    inp.addEventListener('input', () => {
        let v = inp.value.replace(/[^\d,]/g, '');
        const ci = v.indexOf(',');
        if (ci !== -1) v = v.slice(0, ci + 1) + v.slice(ci + 1).replace(/,/g, '');
        if (inp.value !== v) {
            const pos = inp.selectionStart - (inp.value.length - v.length);
            inp.value = v;
            inp.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
        }
    });
}

/**
 * Máscara monetária para inputs de preço (ex: 35,50).
 * • dot → vírgula  • max 2 casas decimais
 * • blur: adiciona ,00 em inteiros  (ex: "35" → "35,00")
 */
export function applyMaskCurrency(inp) {
    inp.addEventListener('keydown', e => {
        if (e.key === '.') {
            e.preventDefault();
            const pos = inp.selectionStart, val = inp.value;
            if (!val.includes(',')) {
                inp.value = val.slice(0, pos) + ',' + val.slice(inp.selectionEnd);
                inp.setSelectionRange(pos + 1, pos + 1);
                inp.dispatchEvent(new Event('input'));
            }
        }
    });
    inp.addEventListener('input', () => {
        let v = inp.value.replace(/[^\d,]/g, '');
        const ci = v.indexOf(',');
        if (ci !== -1) {
            const dec = v.slice(ci + 1).replace(/,/g, '').slice(0, 2);
            v = v.slice(0, ci + 1) + dec;
        }
        if (inp.value !== v) inp.value = v;
    });
    inp.addEventListener('blur', () => {
        const v = inp.value.trim();
        if (!v) return;
        if (!v.includes(',')) { inp.value = v + ',00'; return; }
        const parts = v.split(',');
        inp.value = parts[0] + ',' + (parts[1] || '').padEnd(2, '0').slice(0, 2);
    });
}

/**
 * Máscara para inputs de configuração (markup %, overhead %, etc.).
 * • dot → vírgula  • max 2 casas decimais
 * • blur: inteiros são mantidos como estão (sem forçar ,00)
 *         vírgula sozinha limpa o campo
 */
export function applyMaskDecimalConfig(inp) {
    inp.addEventListener('keydown', e => {
        if (e.key === '.') {
            e.preventDefault();
            const pos = inp.selectionStart, val = inp.value;
            if (!val.includes(',')) {
                inp.value = val.slice(0, pos) + ',' + val.slice(inp.selectionEnd);
                inp.setSelectionRange(pos + 1, pos + 1);
                inp.dispatchEvent(new Event('input'));
            }
        }
    });
    inp.addEventListener('input', () => {
        let v = inp.value.replace(/[^\d,]/g, '');
        const ci = v.indexOf(',');
        if (ci !== -1) v = v.slice(0, ci + 1) + v.slice(ci + 1).replace(/,/g, '').slice(0, 2);
        if (inp.value !== v) inp.value = v;
    });
    inp.addEventListener('blur', () => {
        const v = inp.value.trim();
        if (!v || v === ',') { inp.value = ''; return; }
        if (!v.includes(',')) return; // inteiro — ok sem ,00
        const parts = v.split(',');
        inp.value = parts[0] + ',' + (parts[1] || '').padEnd(2, '0').slice(0, 2);
    });
}
