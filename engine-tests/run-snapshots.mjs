/**
 * engine-tests/run-snapshots.mjs — StockFlow Pro · Engine Test Suite v1.0
 * ══════════════════════════════════════════════════════════════════════════
 *
 * EXECUÇÃO:
 *   node engine-tests/run-snapshots.mjs
 *
 * REQUER: Node.js ≥ 18 (ESM nativo, performance.now global)
 *
 * COBERTURA:
 *   1. Snapshot regression — 8 casos com tolerância 0.01
 *   2. Fuzz testing        — 1000 execuções com inputs aleatórios
 *   3. NaN / Infinity scan — todos os campos numéricos em todos os casos
 *   4. Invariantes lógicos — isLoss, isZeroPrice, margin range, etc.
 *
 * SAÍDA:
 *   ✅ / ❌ por caso + sumário final com contagem de passou/falhou
 * ══════════════════════════════════════════════════════════════════════════
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Import da engine (caminho relativo ao projeto) ────────────────────────
// A engine é a única dependência — zero libs externas.
import {
    calcFicha,
    calcPrecoParaMargem,
    calcMargemParaPreco,
    ingCostPerG,
    fixedCostPerUnit,
    totalFixedCosts,
    buildContext,
    parseNum,
} from '../ft-engine.js';


// ══════════════════════════════════════════════════════════════════════════
//  UTILITÁRIOS DE ASSERÇÃO
// ══════════════════════════════════════════════════════════════════════════

let _passed = 0;
let _failed = 0;
let _warns  = 0;

/**
 * Falha fatal — aborta o caso imediatamente.
 */
function fail(caseId, msg, detail = {}) {
    _failed++;
    const d = Object.keys(detail).length ? '\n    ' + JSON.stringify(detail) : '';
    console.error(`  ❌  ${caseId}: ${msg}${d}`);
}

/**
 * Passe — incrementa contador.
 */
function pass(caseId, msg) {
    _passed++;
    console.log(`  ✅  ${caseId}: ${msg}`);
}

/**
 * Aviso — não falha o case, mas conta para o relatório.
 */
function warn(caseId, msg, detail = {}) {
    _warns++;
    const d = Object.keys(detail).length ? ' ' + JSON.stringify(detail) : '';
    console.warn(`  ⚠️   ${caseId}: ${msg}${d}`);
}

/**
 * Verifica se um número é seguro (não NaN, não Infinity).
 */
function isSafe(v) {
    return typeof v === 'number' && isFinite(v);
}

/**
 * Compara valor com expected dentro da tolerância.
 */
function within(actual, expected, tol = 0.01) {
    if (!isSafe(actual) || !isSafe(expected)) return false;
    return Math.abs(actual - expected) <= tol + Math.abs(expected) * 0.0001;
}


// ══════════════════════════════════════════════════════════════════════════
//  BLOCO 1 — SNAPSHOT REGRESSION
// ══════════════════════════════════════════════════════════════════════════

function runSnapshots() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' BLOCO 1 — Snapshot Regression');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const raw      = readFileSync(join(__dir, 'snapshots.json'), 'utf-8');
    const fixtures = JSON.parse(raw);
    const TOL      = fixtures._meta.tolerance;

    for (const tc of fixtures.cases) {
        const { id, description, ctx: ctxRaw, ficha, expected } = tc;
        console.log(`\n  [${id}] ${description}`);

        // Montar contexto real via buildContext
        const ctx = buildContext(ctxRaw);

        // Executar engine
        let result;
        try {
            result = calcFicha(ficha, ctx);
        } catch (e) {
            fail(id, `calcFicha lançou exceção: ${e.message}`);
            continue;
        }

        // Null check
        if (result === null) {
            fail(id, 'calcFicha retornou null');
            continue;
        }

        // NaN / Infinity scan nos campos numéricos do resultado
        const numericFields = ['varCost','fixCost','totalCost','profit','margin','markup','breakeven','precoSugerido'];
        let nanFound = false;
        for (const f of numericFields) {
            if (!isSafe(result[f])) {
                fail(id, `Campo '${f}' é NaN ou Infinity`, { value: result[f] });
                nanFound = true;
            }
        }
        if (nanFound) continue;

        // Comparar com expected
        let caseOk = true;
        for (const [field, exp] of Object.entries(expected)) {
            const actual = result[field];

            if (typeof exp === 'boolean') {
                if (actual !== exp) {
                    fail(id, `Campo booleano '${field}'`, { expected: exp, actual });
                    caseOk = false;
                }
            } else if (typeof exp === 'number') {
                if (!within(actual, exp, TOL)) {
                    fail(id, `Campo '${field}' fora da tolerância (±${TOL})`, { expected: exp, actual, diff: +(actual - exp).toFixed(5) });
                    caseOk = false;
                }
            }
        }

        if (caseOk) pass(id, 'todos os campos dentro da tolerância');
    }
}


// ══════════════════════════════════════════════════════════════════════════
//  BLOCO 2 — FUZZ TESTING (1000 execuções)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Gera número aleatório no intervalo [min, max].
 */
function rnd(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Gera um ingrediente aleatório.
 * Cobre edge cases: preço zero, peso zero, perda 0%, perda 99%.
 */
function randIngredient(id) {
    const edgeCase = Math.random() < 0.05; // 5% chance de edge case
    return {
        id,
        name         : `ing-${id}`,
        purchasePrice: edgeCase ? 0 : rnd(0.1, 200),
        packageWeightG: edgeCase ? 0 : rnd(10, 5000),
        lossPercent  : edgeCase ? 99 : rnd(0, 40),
        unit         : Math.random() < 0.8 ? 'g' : 'un',
    };
}

/**
 * Gera uma ficha aleatória com 0-5 ingredientes.
 */
function randFicha(ings) {
    const itemCount = Math.floor(rnd(0, 6));
    const items = [];
    for (let i = 0; i < itemCount && i < ings.length; i++) {
        items.push({
            id     : ings[i].id,
            type   : 'ingredient',
            weightG: rnd(1, 500),
        });
    }
    return {
        id               : 'fuzz-ficha',
        productName      : 'Fuzz Pizza',
        size             : 'M',
        items,
        sellingPrice     : Math.random() < 0.1 ? 0 : rnd(0, 200),
        alertThreshold   : rnd(0, 50),
        includeFixedCosts: Math.random() < 0.5,
    };
}

/**
 * Valida invariantes lógicas de um CalcResult.
 * Retorna lista de violações (strings). Vazio = OK.
 */
function checkInvariants(r) {
    const errs = [];

    // Invariante 1: todos os campos numéricos devem ser finitos
    for (const f of ['varCost','fixCost','totalCost','profit','margin','markup','breakeven','precoSugerido']) {
        if (!isSafe(r[f])) errs.push(`${f}=NaN/Infinity`);
    }

    // Invariante 2: totalCost = varCost + fixCost
    if (isSafe(r.totalCost) && isSafe(r.varCost) && isSafe(r.fixCost)) {
        const expected = r.varCost + r.fixCost;
        if (!within(r.totalCost, expected, 0.001)) {
            errs.push(`totalCost(${r.totalCost}) ≠ varCost+fixCost(${expected})`);
        }
    }

    // Invariante 3: isZeroPrice ↔ sellingPrice = 0
    // (não temos acesso ao sellingPrice original aqui, mas podemos checar via breakeven)
    // isLoss só pode ser true se !isZeroPrice
    if (r.isLoss && r.isZeroPrice) errs.push('isLoss=true e isZeroPrice=true simultaneamente');

    // Invariante 4: margin deve estar em range razoável [-100, 100] dado arredondamento engine
    if (isSafe(r.margin) && (r.margin > 100 || r.margin < -1000)) {
        errs.push(`margin fora de range esperado: ${r.margin}`);
    }

    // Invariante 5: markup deve estar em [0, 999] (engine limita a 999×)
    if (isSafe(r.markup) && (r.markup < 0 || r.markup > 999.001)) {
        errs.push(`markup fora de range [0,999]: ${r.markup}`);
    }

    // Invariante 6: varCost, fixCost, totalCost não podem ser negativos
    for (const f of ['varCost', 'fixCost', 'totalCost']) {
        if (isSafe(r[f]) && r[f] < -0.001) errs.push(`${f} negativo: ${r[f]}`);
    }

    return errs;
}

function runFuzz() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' BLOCO 2 — Fuzz Testing (1000 execuções)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const RUNS       = 1000;
    let   nanTotal   = 0;
    let   invarTotal = 0;
    let   nullTotal  = 0;
    let   throwTotal = 0;

    const t0 = performance.now();

    for (let i = 0; i < RUNS; i++) {
        // Gerar contexto aleatório
        const ingCount = Math.floor(rnd(0, 6));
        const ings = Array.from({ length: ingCount }, (_, j) => randIngredient(`fi-${i}-${j}`));
        const ficha = randFicha(ings);

        const hasFixedCosts = Math.random() < 0.4;
        const fixedCosts = hasFixedCosts
            ? [{ id: 'fc1', name: 'Fixo', value: rnd(100, 5000) }]
            : [];

        const monthlyVolume = Math.random() < 0.1 ? 0 : Math.floor(rnd(10, 2000));

        const ctx = buildContext({
            ingredients: ings,
            preparos   : [],
            fixedCosts,
            fichas     : [],
            settings   : {
                monthlyVolume,
                workingDays : Math.floor(rnd(1, 30)),
                targetMargin: rnd(0, 90),
            },
        });

        // Executar
        let result;
        try {
            result = calcFicha(ficha, ctx);
        } catch (e) {
            throwTotal++;
            fail('fuzz', `execução ${i} lançou exceção`, { error: e.message, ficha: ficha.id });
            if (throwTotal >= 5) { fail('fuzz', 'Abort: muitas exceções'); break; }
            continue;
        }

        if (result === null) {
            nullTotal++;
            continue; // null é válido para ficha inválida
        }

        // NaN / Infinity
        const numFields = ['varCost','fixCost','totalCost','profit','margin','markup','breakeven','precoSugerido'];
        for (const f of numFields) {
            if (!isSafe(result[f])) { nanTotal++; break; }
        }

        // Invariantes
        const errs = checkInvariants(result);
        if (errs.length) {
            invarTotal++;
            warn('fuzz', `execução ${i} violou invariante`, { errs });
        }
    }

    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`\n  Execuções : ${RUNS}`);
    console.log(`  Tempo     : ${elapsed}ms (${(elapsed / RUNS).toFixed(3)}ms/exec)`);
    console.log(`  null      : ${nullTotal} (fichas inválidas — esperado)`);
    console.log(`  Exceções  : ${throwTotal}`);

    if (nanTotal === 0) {
        pass('fuzz', `Zero NaN / Infinity em ${RUNS} execuções aleatórias`);
    } else {
        fail('fuzz', `${nanTotal} execuções produziram NaN ou Infinity`);
    }

    if (invarTotal === 0) {
        pass('fuzz', `Zero violações de invariante em ${RUNS} execuções`);
    } else {
        fail('fuzz', `${invarTotal} execuções violaram invariantes lógicos`);
    }

    if (throwTotal === 0) {
        pass('fuzz', `Zero exceções não tratadas em ${RUNS} execuções`);
    } else {
        fail('fuzz', `${throwTotal} execuções lançaram exceções`);
    }
}


// ══════════════════════════════════════════════════════════════════════════
//  BLOCO 3 — TESTES DE UTILIDADES
// ══════════════════════════════════════════════════════════════════════════

function runUtilTests() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' BLOCO 3 — Utilidades da Engine');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // parseNum
    const parseTests = [
        ['1.234,56', 1234.56],
        ['12,5',     12.5],
        ['1234.56',  1234.56],
        ['0',        0],
        ['',         0],
        [null,       0],
        [undefined,  0],
        ['abc',      0],
        [Infinity,   0],
        [NaN,        0],
    ];
    let parseOk = true;
    for (const [input, expected] of parseTests) {
        const actual = parseNum(input);
        if (!within(actual, expected, 0.001)) {
            fail('parseNum', `parseNum(${JSON.stringify(input)}) = ${actual}, esperado ${expected}`);
            parseOk = false;
        }
    }
    if (parseOk) pass('parseNum', `${parseTests.length} casos de parse corretos`);

    // calcPrecoParaMargem
    const margTests = [
        [10, 30, 14.29],
        [10, 0,  10],
        [10, 99, 1000],
        [0,  30, 0],
    ];
    let margOk = true;
    for (const [cost, marg, expected] of margTests) {
        const actual = calcPrecoParaMargem(cost, marg);
        if (!within(actual, expected, 0.01)) {
            fail('calcPrecoParaMargem', `(${cost}, ${marg}%) = ${actual}, esperado ${expected}`);
            margOk = false;
        }
    }
    if (margOk) pass('calcPrecoParaMargem', `${margTests.length} casos corretos`);

    // calcMargemParaPreco
    const margemTests = [
        [5, 15, 66.67],
        [0, 15, 100],
        [5, 0,  0],
    ];
    let margemOk = true;
    for (const [cost, price, expected] of margemTests) {
        const actual = calcMargemParaPreco(cost, price);
        if (!within(actual, expected, 0.01)) {
            fail('calcMargemParaPreco', `(cost=${cost}, price=${price}) = ${actual}, esperado ${expected}`);
            margemOk = false;
        }
    }
    if (margemOk) pass('calcMargemParaPreco', `${margemTests.length} casos corretos`);

    // ingCostPerG — edge cases
    const ingTests = [
        [{ purchasePrice: 0,  packageWeightG: 500,  lossPercent: 0,  unit: 'g' }, 0],
        [{ purchasePrice: 10, packageWeightG: 0,    lossPercent: 0,  unit: 'g' }, 0],
        [{ purchasePrice: 10, packageWeightG: 500,  lossPercent: 0,  unit: 'g' }, 0.02],
        [{ purchasePrice: 10, packageWeightG: 500,  lossPercent: 50, unit: 'g' }, 0.04],
        [{ purchasePrice: 5,  packageWeightG: 10,   lossPercent: 0,  unit: 'un' }, 0.5],
    ];
    let ingOk = true;
    for (const [ing, expected] of ingTests) {
        const actual = ingCostPerG(ing);
        if (!isSafe(actual)) {
            fail('ingCostPerG', `retornou NaN/Infinity`, { ing });
            ingOk = false;
        } else if (!within(actual, expected, 0.0001)) {
            fail('ingCostPerG', `(${JSON.stringify(ing)}) = ${actual}, esperado ${expected}`);
            ingOk = false;
        }
    }
    if (ingOk) pass('ingCostPerG', `${ingTests.length} edge cases corretos`);

    // fixedCostPerUnit — edge cases
    const fixTests = [
        [[], 100, 0],
        [[{ id: 'a', value: 1000 }], 0,   0],
        [[{ id: 'a', value: 1000 }], 100, 10],
        [[{ id: 'a', value: 500 }, { id: 'b', value: 500 }], 50, 20],
    ];
    let fixOk = true;
    for (const [costs, vol, expected] of fixTests) {
        const actual = fixedCostPerUnit(costs, vol);
        if (!isSafe(actual)) {
            fail('fixedCostPerUnit', `retornou NaN/Infinity`, { costs, vol });
            fixOk = false;
        } else if (!within(actual, expected, 0.001)) {
            fail('fixedCostPerUnit', `(vol=${vol}) = ${actual}, esperado ${expected}`);
            fixOk = false;
        }
    }
    if (fixOk) pass('fixedCostPerUnit', `${fixTests.length} edge cases corretos`);
}


// ══════════════════════════════════════════════════════════════════════════
//  RUNNER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   StockFlow Pro — Engine Test Suite v1.0             ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  Engine: ft-engine.js`);
console.log(`  Data  : ${new Date().toISOString()}`);

const t0Total = performance.now();

runSnapshots();
runFuzz();
runUtilTests();

const elapsed = (performance.now() - t0Total).toFixed(1);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' SUMÁRIO FINAL');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ✅ Passed  : ${_passed}`);
console.log(`  ❌ Failed  : ${_failed}`);
console.log(`  ⚠️  Warnings: ${_warns}`);
console.log(`  ⏱  Tempo   : ${elapsed}ms`);
console.log('');

if (_failed === 0) {
    console.log('  🟢  TODOS OS TESTES PASSARAM — Engine validada.\n');
    process.exit(0);
} else {
    console.log(`  🔴  ${_failed} TESTE(S) FALHARAM — Investigar antes de deploy.\n`);
    process.exit(1);
      }
            
