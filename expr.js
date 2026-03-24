// expr.js — StockFlow Pro v9.9.14
// ══════════════════════════════════════════════════════════════════
// Avaliador de expressões aritméticas simples.
// Extraído de listafacil.js (v9.9.14 / #21) para permitir testes
// unitários sem dependências de DOM.
//
// Suporta: +  -  *  /  ÷  ×  parênteses, negativos unários.
// Lança Error em: parêntese não fechado, divisão por zero, token inválido.
// ══════════════════════════════════════════════════════════════════

/**
 * Avalia uma expressão aritmética simples.
 * @param {string} expr
 * @returns {number}
 * @throws {Error} se a expressão for inválida
 */
export function avaliarExpr(expr) {
    const src = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    let pos = 0;
    const peek    = () => src[pos];
    const consume = () => src[pos++];

    function parseNum() {
        const s = pos;
        if (peek() === '-') consume();
        while (pos < src.length && /[\d.]/.test(src[pos])) consume();
        const n = parseFloat(src.slice(s, pos));
        if (isNaN(n)) throw new Error('token inválido');
        return n;
    }
    function parseFactor() {
        if (peek() === '(') {
            consume();
            const v = parseExpr();
            if (peek() !== ')') throw new Error('parêntese não fechado');
            consume();
            return v;
        }
        if (peek() === '-') { consume(); return -parseFactor(); }
        return parseNum();
    }
    function parseTerm() {
        let l = parseFactor();
        while (pos < src.length && (peek() === '*' || peek() === '/')) {
            const op = consume(), r = parseFactor();
            if (op === '/' && r === 0) throw new Error('divisão por zero');
            l = op === '*' ? l * r : l / r;
        }
        return l;
    }
    function parseExpr() {
        let l = parseTerm();
        while (pos < src.length && (peek() === '+' || peek() === '-')) {
            const op = consume(), r = parseTerm();
            l = op === '+' ? l + r : l - r;
        }
        return l;
    }

    const result = parseExpr();
    if (pos !== src.length) throw new Error('expressão inválida');
    return result;
}
