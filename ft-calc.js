// ft-calc.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// MOTOR DE CÁLCULO UNIFICADO — Ficha Técnica
// ──────────────────────────────────────────────────────────────────
// REGRAS DE OURO:
//   1. Zero dependências de DOM — funções puras, testáveis, portáveis.
//   2. Zero imports de outros módulos — esta é a camada base.
//   3. Toda lógica de precificação e custo passa por aqui.
//
// API PADRÃO v10 (nomes canônicos para toda a aplicação):
//   calcularCustoIngredientes   — custo bruto da lista de ingredientes
//   calcularCustoTotal          — custo com overhead + mão de obra
//   calcularMargem              — margem bruta % sobre preço de venda
//   calcularPrecoSugerido       — preço de venda a partir de margem desejada
//
// API LEGADA (aliases — mantidos para compatibilidade total com ft-custos.js):
//   calcCustoUnitario · calcCustoIngrediente · calcCustoReceita
//   calcCustoEfetivo  · calcCustoPorcao      · calcPrecoMarkup
//   calcPrecoMargem   · calcLucro            · calcMargemReal
//   calcMarkupImplicito · calcRendimento     · calcVariacaoPreco
// ══════════════════════════════════════════════════════════════════

/** Garante número finito; NaN / null / undefined → 0 */
const _n = v => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0);

// ══════════════════════════════════════════════════════════════════
// API PADRÃO — funções canônicas obrigatórias (v10)
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula o custo bruto de uma lista de ingredientes.
 * @param {Array<{custo?: number}>} ingredientes
 * @returns {number}
 */
export function calcularCustoIngredientes(ingredientes) {
    if (!Array.isArray(ingredientes)) return 0;
    return ingredientes.reduce((s, i) => s + _n(i.custo), 0);
}

/**
 * Calcula o custo total de produção com overhead e mão de obra.
 * @param {number} custoIng    Custo bruto dos ingredientes em R$
 * @param {number} overheadPct Overhead em % (ex: 15 → +15% sobre ingredientes)
 * @param {number} maoDeObra   Mão de obra em R$ fixo por unidade
 * @returns {number}
 */
export function calcularCustoTotal(custoIng, overheadPct = 0, maoDeObra = 0) {
    return _n(custoIng) * (1 + Math.max(0, _n(overheadPct)) / 100) + Math.max(0, _n(maoDeObra));
}

/**
 * Margem bruta % sobre o preço de venda.
 * Fórmula: ((preco - custo) / preco) × 100
 * @returns {number} 0 se preco ≤ 0
 */
export function calcularMargem(preco, custo) {
    const p = _n(preco);
    if (p <= 0) return 0;
    return ((_n(preco) - _n(custo)) / p) * 100;
}

/**
 * Preço de venda sugerido a partir de margem desejada.
 * Fórmula: custo / (1 − margem/100)
 * @param {number} margemPct Margem desejada em % — deve ser < 100
 * @returns {number} 0 se margem ≥ 100
 */
export function calcularPrecoSugerido(custo, margemPct) {
    const m = _n(margemPct) / 100;
    if (m >= 1) return 0;
    return _n(custo) / (1 - m);
}

// ══════════════════════════════════════════════════════════════════
// API LEGADA — aliases para compatibilidade total (não remover)
// ══════════════════════════════════════════════════════════════════

export function calcCustoUnitario(precoCompra, qtdEmbalagem) {
    const q = _n(qtdEmbalagem);
    return q <= 0 ? 0 : _n(precoCompra) / q;
}

export function calcCustoIngrediente(quantidade, custoUnitario) {
    return _n(quantidade) * _n(custoUnitario);
}

/** Alias de calcularCustoIngredientes */
export function calcCustoReceita(ingredientes) {
    return calcularCustoIngredientes(ingredientes);
}

/** Alias de calcularCustoTotal */
export function calcCustoEfetivo(custoIng, overheadPct = 0, maoDeObra = 0) {
    return calcularCustoTotal(custoIng, overheadPct, maoDeObra);
}

export function calcCustoPorcao(custoTotal, porcoes) {
    const p = _n(porcoes);
    return p <= 0 ? 0 : _n(custoTotal) / p;
}

export function calcPrecoMarkup(custo, markupPercent) {
    return _n(custo) * (1 + _n(markupPercent) / 100);
}

/** Alias de calcularPrecoSugerido */
export function calcPrecoMargem(custo, margemPercent) {
    return calcularPrecoSugerido(custo, margemPercent);
}

export function calcLucro(preco, custo) {
    return _n(preco) - _n(custo);
}

/** Alias de calcularMargem */
export function calcMargemReal(preco, custo) {
    return calcularMargem(preco, custo);
}

export function calcMarkupImplicito(preco, custo) {
    const c = _n(custo);
    return c <= 0 ? 0 : ((_n(preco) - c) / c) * 100;
}

export function calcRendimento(qtdEmbalagem, qtdPorPizza) {
    const q = _n(qtdPorPizza);
    return q <= 0 ? 0 : _n(qtdEmbalagem) / q;
}

export function calcVariacaoPreco(precoAtual, precoAnterior) {
    const ant = _n(precoAnterior);
    return ant <= 0 ? 0 : ((_n(precoAtual) - ant) / ant) * 100;
}

// ══════════════════════════════════════════════════════════════════
// RE-EXPORTS — ft-core.js (V2) via ft-calc.js para compatibilidade
// Qualquer módulo pode importar calcularFichaTecnica de ft-calc.js
// sem precisar conhecer ft-core.js diretamente.
// ══════════════════════════════════════════════════════════════════
export { calcularFichaTecnica, precificar,
         calcularPontoEquilibrio, analisarMargemSaude,
         calcularVariacoes, analisarReceitas } from './ft-core.js';
