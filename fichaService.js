// services/fichaService.js — StockFlow Pro · Engine Service Layer v5.0
// ══════════════════════════════════════════════════════════════════
// RESPONSABILIDADE ÚNICA: converter dados do StockFlow Pro para o
// formato do ft-engine.js e expor os resultados prontos para a UI.
//
// REGRAS DESTE MÓDULO (invioláveis):
//   ✅ Zero acesso ao DOM
//   ✅ Zero acesso ao Firebase ou localStorage
//   ✅ Zero lógica de negócio própria — delega tudo ao ft-engine
//   ✅ Funções puras: mesmo input → mesmo output, sempre
//   ✅ Nunca lança exceção com dados inválidos → retorna 0 ou null
//
// BLINDAGEM (v4.1):
//   ✅ safe(n)         — guarda NaN/Infinity em todos os pontos de render
//   ✅ validateState() — valida arrays antes de qualquer cálculo
//   ✅ calcularMemo()  — memo leve para iterações de lista
//   ✅ _log()          — log estruturado com step + payload + ts
//   ✅ _G frozen       — mapa de conversão imutável em runtime
//   ✅ SERVICE_CONFIG  — contrato de configuração auditável
//
// ENTERPRISE (v5.0):
//   ✅ trace/getTrace/clearTrace — ring buffer de observabilidade por cálculo
//   ✅ measure(fn, label)        — wrapper de tempo de execução com alerta
//   ✅ fastHash(str)             — FNV-1a 32-bit, substitui JSON.stringify no memo
//   ✅ ENGINE_CONTRACT           — contrato formal dos campos de saída
//   ✅ validateOutput(r, id)     — valida CalcResult contra o contrato, loga erros
//   ✅ detectAnomalias(r, id)    — detecta valores fora do padrão esperado
//   ✅ calcularMemoSmart()       — memo + trace + validateOutput integrados
//
// SCHEMAS MAPEADOS:
//   StockFlow Ingrediente : { id, nome, unidade, quantidade_embalagem, preco_compra }
//   StockFlow Preparo     : { id, nome, ingredientes:[{nome,peso_g,valor_kg,valor}], peso_depois_pronto }
//   StockFlow Receita     : { id, nome, variantes:[{ingredientes:[{ingrediente_id,quantidade,unidade,custo}], preco_venda}], custo_alerta }
//   StockFlow Gasto       : { id, nome, valor, tipo:'fixo'|'variavel', recorrencia:'mensal'|'anual' }
//   StockFlow Cfg         : { custo_fixo_mensal, dias_operacao, meta_faturamento, preco_medio, margem_alvo }
// ══════════════════════════════════════════════════════════════════
import {
  buildContext,
  calcFicha,
  fichaItemBreakdown,
  calcDashboard,
  calcPrecoParaMargem,
  calcMargemParaPreco,
  ingCostPerG,
  fixedCostPerUnit,
  totalFixedCosts,
  validateIngredient,
  validatePreparo,
  validateFicha,
} from './ft-engine.js';


// ── ENGINE_MODE — Cutover completo: modo strict permanente ──────────
//
// Flag de migração removida. O sistema opera exclusivamente na nova
// engine (ft-engine.js). Sem fallback, sem cache, sem legado.
//
export const ENGINE_MODE = 'strict';

/**
 * Invalida o cache de memoização.
 * CHAMAR após qualquer write no Firebase (salvar receita, ingrediente, gasto).
 */
export function invalidateCache() {
    const size = _memoCache.size;
    _memoCache.clear();
    _log('debug', 'invalidateCache', { cleared: size });
}


// ── Helpers internos ────────────────────────────────────────────────

/** Converte qualquer valor para número finito; retorna fallback quando NaN ou infinito. */
export function safeNumber(n, fallback = 0) {
    const v = Number(n);
    return (isNaN(v) || !isFinite(v)) ? fallback : v;
}

/** Número positivo finito; qualquer outra coisa → 0. */
const _sp = v => { const n = safeNumber(v); return n > 0 ? n : 0; };

/** Número finito (pode ser negativo ou zero); NaN/null/undefined → 0. */
const _sn = v => safeNumber(v);

/** String segura; null/undefined → ''. */
const _ss = v => (v == null ? '' : String(v));


// ── Proteção de renderização ─────────────────────────────────────────

/**
 * Guarda numérica para renderização na UI.
 * Garante que nenhum NaN ou Infinity chegue ao DOM.
 * Use em todos os pontos de saída numérica de templates.
 *
 * @param   {any}    n
 * @param   {number} [fallback=0]
 * @returns {number}
 */
export function safe(n, fallback = 0) {
    const v = Number(n);
    return (isNaN(v) || !isFinite(v)) ? fallback : v;
}


// ── Log estruturado ──────────────────────────────────────────────────

/**
 * Logger interno com contexto rastreável.
 * Formato: { '[StockFlow]': step, ...payload, ts: timestamp }
 *
 * @param {'debug'|'warn'|'error'} level
 * @param {string} step   — identificador do passo (ex: '_calc', 'comparar')
 * @param {object} [payload]
 */
function _log(level, step, payload = {}) {
    const entry = { '[StockFlow]': step, ...payload, ts: Date.now() };
    if      (level === 'error') console.error(entry);
    else if (level === 'warn' ) console.warn(entry);
    else                        console.debug(entry);
}


// ── Trace ring buffer ────────────────────────────────────────────────
//
// Ring buffer circular de até _TRACE_MAX entradas.
// Cada entrada registra um passo do pipeline de cálculo com timestamp
// de alta resolução. Usado para rastreabilidade de ponta a ponta.
//

const _TRACE_MAX = 200;
const _traceBuffer = [];
let   _traceSeq   = 0;

/**
 * Registra um evento no ring buffer de trace.
 * Cada chamada a calcularFichaCompleta/calcularMemoSmart produz 2 eventos:
 *   'calc:start' — início, com receitaId
 *   'calc:end'   — fim, com ms + resumo de resultado
 *
 * Também pode ser chamado externamente para rastrear eventos da UI.
 *
 * @param {string} step    — ex: 'calc:start', 'memo:hit', 'anomalia:custo_alto'
 * @param {object} [data]
 */
export function trace(step, data = {}) {
    if (_traceBuffer.length >= _TRACE_MAX) _traceBuffer.shift();
    _traceBuffer.push({
        seq  : ++_traceSeq,
        step,
        ts   : performance.now(),
        ...data,
    });
}

/**
 * Retorna cópia imutável do ring buffer de trace.
 * Use em DevTools ou relatórios de suporte.
 *
 * @returns {Array<{seq, step, ts, ...data}>}
 */
export function getTrace() {
    return [..._traceBuffer];
}

/**
 * Limpa o ring buffer de trace.
 * Útil antes de iniciar uma sessão de diagnóstico.
 */
export function clearTrace() {
    _traceBuffer.length = 0;
    _traceSeq = 0;
}


// ── Medição de performance ───────────────────────────────────────────

const _MEASURE_WARN_MS = 50; // alerta se cálculo demorar mais que 50ms

/**
 * Executa fn() medindo o tempo de execução.
 * Emite log 'warn' se ultrapassar _MEASURE_WARN_MS.
 * Registra no trace buffer.
 *
 * @template T
 * @param {() => T} fn
 * @param {string}  label — identificador legível (ex: 'calcFicha:pizza-m')
 * @returns {T} — resultado de fn(), sem alteração
 */
export function measure(fn, label) {
    const t0     = performance.now();
    const result = fn();
    const ms     = performance.now() - t0;
    const rounded = +ms.toFixed(3);

    if (ms > _MEASURE_WARN_MS) {
        _log('warn', 'measure:slow', { label, ms: rounded });
    } else {
        _log('debug', 'measure', { label, ms: rounded });
    }
    trace('measure', { label, ms: rounded });
    return result;
}


// ── Memo de cálculo ──────────────────────────────────────────────────
//
// Cache leve por render-cycle para evitar recalcular a mesma receita N vezes
// quando o dashboard itera sobre a lista completa de receitas com o mesmo
// appState. A chave combina o ID da receita com um fingerprint do estado.
//
// Invalidado por invalidateCache() — deve ser chamado após qualquer write
// no Firebase (salvar receita, ingrediente, gasto, configuração).
//
const _memoCache = new Map();
const _MEMO_MAX  = 100;

/**
 * Fatores de conversão para gramas.
 * Unidades não listadas aqui são tratadas como unidades de contagem ('un').
 * Frozen: mapa imutável — sem riscos de mutação em runtime.
 */
const _G = Object.freeze({ g: 1, ml: 1, kg: 1000, l: 1000 });

/**
 * Converte uma quantidade em qualquer unidade StockFlow para a unidade base do engine.
 *   Peso  (g, kg, ml, l) → gramas
 *   Contagem (uni, cx, bld, pct, crt, frd, rl) → contagem (inalterada)
 */
function _toBase(valor, unidade) {
  const fator = _G[unidade];
  return fator != null ? _sp(valor) * fator : _sp(valor);
}

/** Unidade do engine: 'g' para pesos, 'un' para tudo mais. */
const _engineUnit = unidade => (_G[unidade] != null ? 'g' : 'un');


// ── Mappers privados ────────────────────────────────────────────────

/**
 * StockFlow Ingrediente → engine Ingredient.
 * Campos faltando → defaults seguros (sem crash, sem NaN).
 */
function _mapIngrediente(ing) {
  if (!ing || typeof ing !== 'object') return null;
  const id = _ss(ing.id).trim();
  if (!id) return null;

  const unidade = _ss(ing.unidade || 'g');

  return {
    id,
    name          : _ss(ing.nome         ?? ing.name),
    purchasePrice : _sp(ing.preco_compra  ?? ing.purchasePrice),
    packageWeightG: _toBase(ing.quantidade_embalagem ?? ing.packageWeightG, unidade),
    lossPercent   : _sn(ing.perda_pct     ?? ing.lossPercent ?? 0),
    unit          : _engineUnit(unidade),
  };
}

/**
 * Item de variante de receita StockFlow → engine Item.
 * StockFlow: { ingrediente_id, quantidade, unidade, custo }
 * Engine:    { id, type: 'ingredient', weightG }
 *
 * Nota: receitas do StockFlow Pro referenciam APENAS ingredientes por ID
 * (não preparos). O tipo é sempre 'ingredient'.
 */
function _mapReceitaItem(item) {
  if (!item || typeof item !== 'object') return null;
  const id = _ss(item.ingrediente_id ?? item.id).trim();
  if (!id) return null;

  const unidade = _ss(item.unidade || 'g');
  const weightG = _toBase(item.quantidade ?? item.weightG, unidade);
  if (weightG <= 0) return null;

  return { id, type: 'ingredient', weightG };
}

/**
 * StockFlow Receita + variante → engine Ficha.
 *
 * Usa a variante fornecida; se nula, usa a primeira variante ativa;
 * se não houver variantes, usa os ingredientes da raiz da receita.
 */
function _mapReceita(rec, varianteOverride) {
  if (!rec || typeof rec !== 'object') return null;

  const variante = varianteOverride
    ?? rec.variantes?.find(v => v.ativo !== false)
    ?? rec.variantes?.[0]
    ?? null;

  const ingsRaw = Array.isArray(variante?.ingredientes) ? variante.ingredientes
                : Array.isArray(rec.ingredientes)        ? rec.ingredientes
                : [];

  return {
    id               : _ss(rec.id),
    productName      : _ss(rec.nome    ?? rec.productName),
    size             : _ss(variante?.nome_tamanho ?? variante?.tamanho_id ?? rec.tamanho),
    sellingPrice     : _sp(variante?.preco_venda ?? rec.preco_venda),
    alertThreshold   : _sn(rec.custo_alerta      ?? rec.alertThreshold ?? 0),
    includeFixedCosts: rec.incluir_custo_fixo    ?? rec.includeFixedCosts ?? true,
    items: ingsRaw.filter(Boolean).map(_mapReceitaItem).filter(Boolean),
  };
}

/**
 * StockFlow Gasto → engine FixedCost.
 * Gastos variáveis são descartados. Anuais são normalizados para mensal.
 */
function _mapGasto(gasto) {
  if (!gasto || typeof gasto !== 'object') return null;
  // Descarta tipo 'variavel' (apenas 'fixo' impacta o custo unitário fixo)
  if (gasto.tipo !== undefined && gasto.tipo !== 'fixo') return null;

  const valor = gasto.recorrencia === 'anual'
    ? _sp(gasto.valor) / 12
    : _sp(gasto.valor);

  return { id: _ss(gasto.id), name: _ss(gasto.nome ?? gasto.name), value: valor };
}


// ── API pública ─────────────────────────────────────────────────────

/**
 * Normaliza as fontes de dados brutas num AppState canônico.
 * Chamado pela UI antes de qualquer cálculo.
 *
 * @param {object} raw
 * @param {Array}         raw.ingredientes   — getIngredientes()
 * @param {Array}         raw.receitas       — getReceitasAtivas()
 * @param {Array|number}  raw.gastos         — Array de gastos OU número de getTotalFixoMensal()
 * @param {object}        raw.cfg            — getCfgNegocio()
 * @returns {AppState}
 */
export function buildAppState({ ingredientes = [], receitas = [], gastos = [], cfg = {} } = {}) {
  return {
    ingredientes: Array.isArray(ingredientes) ? ingredientes : [],
    receitas    : Array.isArray(receitas)     ? receitas     : [],
    gastos      : Array.isArray(gastos) ? gastos : (typeof gastos === 'number' ? gastos : []),
    cfg         : cfg && typeof cfg === 'object' ? cfg : {},
  };
}

/**
 * Valida e normaliza um AppState antes de qualquer cálculo.
 * Garante que os arrays obrigatórios nunca sejam null/undefined/objeto.
 * Emite log estruturado para cada campo inválido encontrado.
 *
 * Use antes de buildAppState() para detectar problemas cedo:
 *   buildAppState(validateState({ ingredientes, receitas, gastos, cfg }))
 *
 * @param {any} appState
 * @returns {object} AppState saneado — nunca lança exceção
 */
export function validateState(appState) {
    if (!appState || typeof appState !== 'object') {
        _log('warn', 'validateState', {
            problem : 'appState inválido',
            received: typeof appState,
        });
        return { ingredientes: [], receitas: [], gastos: [], cfg: {} };
    }

    const out = {
        ingredientes: Array.isArray(appState.ingredientes) ? appState.ingredientes : [],
        receitas    : Array.isArray(appState.receitas)     ? appState.receitas     : [],
        gastos      : (Array.isArray(appState.gastos) || typeof appState.gastos === 'number')
                        ? appState.gastos : [],
        cfg         : (appState.cfg && typeof appState.cfg === 'object') ? appState.cfg : {},
    };

    if (!Array.isArray(appState.ingredientes))
        _log('warn', 'validateState', {
            field   : 'ingredientes',
            problem : 'não é array',
            received: typeof appState.ingredientes,
        });

    if (!Array.isArray(appState.receitas))
        _log('warn', 'validateState', {
            field   : 'receitas',
            problem : 'não é array',
            received: typeof appState.receitas,
        });

    if (!Array.isArray(appState.gastos) && typeof appState.gastos !== 'number')
        _log('warn', 'validateState', {
            field   : 'gastos',
            problem : 'não é array nem número',
            received: typeof appState.gastos,
        });

    return out;
}

/**
 * Converte um AppState (StockFlow Pro) em um Context do engine.
 * Função pura: sem acesso a DOM, Firebase ou globals.
 *
 * @param {AppState} appState — gerado por buildAppState()
 * @returns {Context}         — pronto para passar ao engine
 */
export function mapFirebaseToEngineState(appState) {
  const s = appState || {};

  // ── Ingredientes ─────────────────────────────────────────────────
  const ingredients = (Array.isArray(s.ingredientes) ? s.ingredientes : [])
    .filter(Boolean)
    .map(_mapIngrediente)
    .filter(Boolean);

  // ── Fichas (uma por variante ativa) ─────────────────────────────
  // Cada variante ativa de cada receita vira uma ficha independente no engine.
  const fichas = (Array.isArray(s.receitas) ? s.receitas : [])
    .filter(Boolean)
    .flatMap(rec => {
      if (Array.isArray(rec.variantes) && rec.variantes.length > 0) {
        return rec.variantes
          .filter(v => v.ativo !== false)
          .map(v => _mapReceita(rec, v))
          .filter(Boolean);
      }
      const f = _mapReceita(rec, null);
      return f ? [f] : [];
    });

  // ── Custos fixos ────────────────────────────────────────────────
  // Aceita Array de gastos (formato Firebase) OU número pré-computado
  // (getTotalFixoMensal()) para facilitar diferentes pontos de chamada.
  let fixedCosts;
  if (typeof s.gastos === 'number') {
    fixedCosts = s.gastos > 0
      ? [{ id: 'ft_total_fixo', name: 'Custos Fixos Mensais', value: s.gastos }]
      : [];
  } else {
    fixedCosts = (Array.isArray(s.gastos) ? s.gastos : [])
      .filter(Boolean)
      .map(_mapGasto)
      .filter(Boolean);
  }

  // ── Settings ────────────────────────────────────────────────────
  const cfg = s.cfg || {};

  // Volume mensal: estimado de meta/preço médio. Engine aceita 0 com segurança.
  const precoMedio    = _sp(cfg.preco_medio);
  const metaFatura    = _sp(cfg.meta_faturamento);
  const monthlyVolume = precoMedio > 0 && metaFatura > 0
    ? Math.round(metaFatura / precoMedio)
    : 0;

  const workingDays  = _sp(cfg.dias_operacao ?? cfg.workingDays) || 20;
  const targetMargin = _sn(cfg.margem_alvo   ?? cfg.targetMargin ?? 30);

  return buildContext({
    ingredients,
    preparos  : [],   // Preparos do StockFlow não têm IDs de ingredientes → engine não os usa
    fixedCosts,
    fichas,
    settings  : { monthlyVolume, workingDays, targetMargin },
  });
}


// ── Cálculo principal ───────────────────────────────────────────────

/**
 * Cálculo financeiro completo de uma receita StockFlow Pro.
 *
 * Retorna os mesmos campos de calcFicha() do engine, mais:
 *   breakdown  — custo detalhado por ingrediente (para exibição)
 *
 * @param {object}  receitaRaw        — receita do getReceitasAtivas()
 * @param {AppState} appState         — de buildAppState()
 * @param {object}  [varianteOverride] — variante específica (opcional)
 * @returns {CalcResult & {breakdown} | null}
 */
export function calcularFichaCompleta(receitaRaw, appState, varianteOverride = null) {
    if (!receitaRaw || !appState) return null;

    const receitaId = _ss(receitaRaw?.id || receitaRaw?.nome || '?');
    trace('calc:start', { receitaId });

    return measure(() => {
        const ctx    = mapFirebaseToEngineState(appState);
        const ficha  = _mapReceita(receitaRaw, varianteOverride);
        if (!ficha) {
            trace('calc:null', { receitaId, reason: 'mapReceita returned null' });
            return null;
        }

        const result = calcFicha(ficha, ctx);
        if (!result) {
            trace('calc:null', { receitaId, reason: 'calcFicha returned null' });
            return null;
        }

        const final = { ...result, breakdown: fichaItemBreakdown(ficha, ctx) };

        // Validação e detecção de anomalias — nunca bloqueia o resultado
        validateOutput(final, receitaId);
        detectAnomalias(final, receitaId);

        trace('calc:end', {
            receitaId,
            totalCost : final.totalCost,
            margin    : final.margin,
            isLoss    : final.isLoss,
        });

        return final;
    }, `calcFicha:${receitaId}`);
}

/**
 * Hash FNV-1a 32-bit sobre uma string.
 * ~10× mais rápido que JSON.stringify para chaves de memo.
 *
 * Características:
 *   • Sem colisões relevantes para IDs e números de produto alimentar
 *   • Saída em base36 (7 chars típico) — compacta como chave de Map
 *   • Zero alocações além da string de retorno
 *   • Determinístico: mesma entrada → mesma saída, sempre
 *
 * @param   {string} str
 * @returns {string} hash base36
 */
function fastHash(str) {
    // FNV-1a: offset basis e prime (32-bit)
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        // Multiplicação 32-bit sem overflow via >>> 0
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
}

/**
 * Fingerprint leve do AppState para chave de memo.
 * Inclui apenas campos que afetam o resultado de calcFicha.
 * @private
 */
function _memoKey(receitaRaw, appState) {
    const id = _ss(receitaRaw?.id || receitaRaw?.nome || '__unknown__');
    const s  = appState || {};

    // Concatena campos relevantes em uma única string antes de hashing.
    // Separadores '\x00' evitam colisões entre valores adjacentes.
    const raw = [
        id,
        (Array.isArray(s.ingredientes) ? s.ingredientes : [])
            .map(i => `${i?.id}\x01${i?.preco_compra}`).join('\x00'),
        (Array.isArray(s.receitas) ? s.receitas : [])
            .map(r => r?.id).join('\x00'),
        typeof s.gastos === 'number'
            ? String(s.gastos)
            : (Array.isArray(s.gastos) ? s.gastos : [])
                .map(g => `${g?.id}\x01${g?.valor}`).join('\x00'),
        s.cfg?.margem_alvo,
        s.cfg?.meta_faturamento,
        s.cfg?.preco_medio,
        s.cfg?.dias_operacao,
    ].join('\x02');

    return `${id}::${fastHash(raw)}`;
}

/**
 * Versão memoizada de calcularFichaCompleta.
 * Use em iterações sobre listas de receitas (ex: dashboard, exportações)
 * onde o mesmo appState é passado para múltiplas receitas na mesma chamada.
 *
 * Cache invalidado por invalidateCache() — chamar após qualquer write.
 * Máximo de _MEMO_MAX entradas; entradas mais antigas são evictas (FIFO).
 *
 * @param {object}  receitaRaw
 * @param {AppState} appState
 * @param {object}  [varianteOverride]
 * @returns {CalcResult & {breakdown} | null}
 */
export function calcularMemo(receitaRaw, appState, varianteOverride = null) {
    if (!receitaRaw || !appState) return null;
    const key = _memoKey(receitaRaw, appState);
    if (_memoCache.has(key)) return _memoCache.get(key);
    const result = calcularFichaCompleta(receitaRaw, appState, varianteOverride);
    if (result !== null) {
        if (_memoCache.size >= _MEMO_MAX)
            _memoCache.delete(_memoCache.keys().next().value);
        _memoCache.set(key, result);
    }
    return result;
}


// ── Contrato formal da engine ────────────────────────────────────────

/**
 * Contrato dos campos obrigatórios no retorno de calcFicha / calcularFichaCompleta.
 *
 * Usado por validateOutput() para verificar NaN, Infinity e violações de range.
 * Frozen: não pode ser alterado em runtime.
 */
export const ENGINE_CONTRACT = Object.freeze({
    /** Todos os campos que devem existir no resultado. */
    fields: Object.freeze([
        'varCost', 'fixCost', 'totalCost', 'profit',
        'margin', 'markup', 'breakeven', 'precoSugerido',
        'isLoss', 'isAlert', 'isZeroPrice', 'breakdown',
    ]),
    /** Campos que devem ser números finitos. */
    numeric: Object.freeze([
        'varCost', 'fixCost', 'totalCost', 'profit',
        'margin', 'markup', 'breakeven', 'precoSugerido',
    ]),
    /** Campos que devem ser booleanos. */
    boolean: Object.freeze(['isLoss', 'isAlert', 'isZeroPrice']),
    /**
     * Restrições de range.
     * Violações geram warn (não erro) — são casos reais, não bugs.
     */
    constraints: Object.freeze({
        varCost  : Object.freeze({ min: 0 }),
        fixCost  : Object.freeze({ min: 0 }),
        totalCost: Object.freeze({ min: 0 }),
        markup   : Object.freeze({ min: 0, max: 999 }),
        margin   : Object.freeze({ min: -100, max: 100 }),
    }),
});

/**
 * Valida um CalcResult contra ENGINE_CONTRACT.
 *
 * Regras:
 *   • Campo numérico NaN ou Infinity → log 'error' → retorna false
 *   • Violação de range → log 'warn' → retorna true (dado real, não bug)
 *   • Campo booleano com tipo errado → log 'warn'
 *   • breakdown ausente → log 'warn'
 *
 * Nunca lança exceção. Nunca bloqueia o resultado.
 *
 * @param {any}    result
 * @param {string} [receitaId='?']
 * @returns {boolean} false somente se houver NaN ou Infinity (erro de engine)
 */
export function validateOutput(result, receitaId = '?') {
    if (!result || typeof result !== 'object') {
        _log('warn', 'validateOutput:null', { receitaId });
        return false;
    }

    let valid = true;

    // Verificação de NaN e Infinity — erro crítico
    for (const field of ENGINE_CONTRACT.numeric) {
        const v = result[field];
        if (typeof v !== 'number' || !isFinite(v)) {
            _log('error', 'validateOutput:NaN', { receitaId, field, value: v });
            valid = false;
        }
    }

    // Verificação de tipo booleano
    for (const field of ENGINE_CONTRACT.boolean) {
        if (typeof result[field] !== 'boolean') {
            _log('warn', 'validateOutput:tipo', { receitaId, field, expected: 'boolean', received: typeof result[field] });
        }
    }

    // Verificação de range
    for (const [field, bounds] of Object.entries(ENGINE_CONTRACT.constraints)) {
        const v = result[field];
        if (typeof v === 'number' && isFinite(v)) {
            if (bounds.min != null && v < bounds.min)
                _log('warn', 'validateOutput:underflow', { receitaId, field, value: v, min: bounds.min });
            if (bounds.max != null && v > bounds.max)
                _log('warn', 'validateOutput:overflow', { receitaId, field, value: v, max: bounds.max });
        }
    }

    // breakdown deve existir e ser array
    if (!Array.isArray(result.breakdown))
        _log('warn', 'validateOutput:breakdown', { receitaId, received: typeof result.breakdown });

    return valid;
}

/**
 * Detecta valores fora do padrão esperado para um cardápio de pizzaria.
 * Retorna lista de anomalias (pode ser vazia). Nunca lança.
 *
 * Thresholds calibrados para o domínio StockFlow Pro:
 *   custo_alto       → totalCost > R$ 500 (ingredientes + fixo por unidade)
 *   prejuizo_extremo → margin < −50% (preço abaixo de metade do custo)
 *   markup_improvavel→ markup > 500× (preço 500× o custo é dado provavelmente errado)
 *   sem_ingredientes → varCost = 0 com preço definido (receita incompleta)
 *   preco_zero_com_custo → isZeroPrice e totalCost > 0 (custo sem preço)
 *
 * @param {object} result    — CalcResult retornado por calcularFichaCompleta
 * @param {string} [receitaId='?']
 * @returns {Array<{tipo, campo, valor}>}
 */
export function detectAnomalias(result, receitaId = '?') {
    if (!result || typeof result !== 'object') return [];

    const anomalias = [];

    if (result.totalCost > 500) {
        anomalias.push({ tipo: 'custo_alto', campo: 'totalCost', valor: result.totalCost });
        _log('warn', 'anomalia:custo_alto', { receitaId, totalCost: result.totalCost });
    }

    if (result.margin < -50) {
        anomalias.push({ tipo: 'prejuizo_extremo', campo: 'margin', valor: result.margin });
        _log('warn', 'anomalia:prejuizo_extremo', { receitaId, margin: result.margin });
    }

    if (result.markup > 500) {
        anomalias.push({ tipo: 'markup_improvavel', campo: 'markup', valor: result.markup });
        _log('warn', 'anomalia:markup_improvavel', { receitaId, markup: result.markup });
    }

    if (result.varCost === 0 && !result.isZeroPrice) {
        anomalias.push({ tipo: 'sem_ingredientes', campo: 'varCost', valor: 0 });
        _log('warn', 'anomalia:sem_ingredientes', { receitaId });
    }

    if (result.isZeroPrice && result.totalCost > 0) {
        anomalias.push({ tipo: 'custo_sem_preco', campo: 'isZeroPrice', valor: result.totalCost });
        _log('warn', 'anomalia:custo_sem_preco', { receitaId, totalCost: result.totalCost });
    }

    return anomalias;
}


// ── calcularMemoSmart ────────────────────────────────────────────────

/**
 * Versão enterprise de calcularMemo.
 * Combina: memo (fastHash) + trace + validateOutput + detectAnomalias.
 *
 * Use em iterações de lista (dashboard, exportações, relatórios) onde
 * o mesmo appState é reusado para muitas receitas consecutivas.
 *
 * Diferença para calcularMemo simples:
 *   • Registra 'memo:hit' no trace quando encontra cache hit
 *   • Chama validateOutput e detectAnomalias no resultado cacheado
 *     (garante integridade mesmo após invalidação parcial)
 *
 * @param {object}  receitaRaw
 * @param {AppState} appState
 * @param {object}  [varianteOverride]
 * @returns {CalcResult & {breakdown} | null}
 */
export function calcularMemoSmart(receitaRaw, appState, varianteOverride = null) {
    if (!receitaRaw || !appState) return null;

    const receitaId = _ss(receitaRaw?.id || receitaRaw?.nome || '?');
    const key = _memoKey(receitaRaw, appState);

    if (_memoCache.has(key)) {
        trace('memo:hit', { receitaId, key: key.split('::')[1] });
        return _memoCache.get(key);
    }

    // Miss — calcula (calcularFichaCompleta já emite trace + validate)
    trace('memo:miss', { receitaId });
    const result = calcularFichaCompleta(receitaRaw, appState, varianteOverride);

    if (result !== null) {
        if (_memoCache.size >= _MEMO_MAX)
            _memoCache.delete(_memoCache.keys().next().value);
        _memoCache.set(key, result);
    }

    return result;
}


// ── Dashboard ───────────────────────────────────────────────────────

/**
 * Métricas agregadas de todas as fichas precificadas.
 *
 * @param {AppState} appState
 * @returns {DashboardResult | null}
 */
export function calcularDashboard(appState) {
  if (!appState) return null;
  return calcDashboard(mapFirebaseToEngineState(appState));
}


// ── Utilitários de custo direto ─────────────────────────────────────

/**
 * Custo por grama (ou por unidade) de um ingrediente StockFlow.
 *
 * @param {object} ingRaw — ingrediente do getIngredientes()
 * @returns {number}      — custo em R$ por grama (ou por unidade se uni)
 */
export function calcularCustoUnitario(ingRaw) {
  const ing = _mapIngrediente(ingRaw);
  return ing ? ingCostPerG(ing) : 0;
}

/**
 * Custo fixo rateado por unidade de produção.
 *
 * @param {AppState} appState
 * @returns {number}
 */
export function calcularCustoFixoPorUnidade(appState) {
  const ctx = mapFirebaseToEngineState(appState || {});
  return fixedCostPerUnit(ctx.fixedCosts, ctx.settings.monthlyVolume);
}

/**
 * Total mensal de custos fixos do AppState.
 *
 * @param {AppState} appState
 * @returns {number}
 */
export function calcularTotalFixoMensal(appState) {
  const ctx = mapFirebaseToEngineState(appState || {});
  return totalFixedCosts(ctx.fixedCosts);
}


// ── Precificação reversa (pass-through sem overhead) ───────────────

/** Preço para atingir uma margem desejada. */
export { calcPrecoParaMargem, calcMargemParaPreco };


// ── Utilitários do Simulador (migrados de ft-calc.js) ───────────────
//
// Estas funções suportam cálculos de overhead e mão de obra da UI do
// Simulador, que não fazem parte do contrato de calcFicha (engine pura).
// A lógica é idêntica à do ft-calc.js removido.
//

/** Custo efetivo com overhead (%) e mão de obra (R$) sobre custo base. */
export function calcCustoEfetivo(custoIng, overheadPct = 0, maoDeObra = 0) {
    const c = _sp(custoIng);
    return c * (1 + Math.max(0, _sn(overheadPct)) / 100) + Math.max(0, _sn(maoDeObra));
}

/** Preço sugerido pelo método markup: custo × (1 + markup%). */
export function calcPrecoMarkup(custo, markupPercent) {
    return _sn(custo) * (1 + _sn(markupPercent) / 100);
}

/**
 * Preço para atingir margem desejada — alias de calcPrecoParaMargem.
 * Assinatura (custo, margem%) compatível com o uso legado em ft-custos.js.
 */
export function calcPrecoMargem(custo, margemPercent) {
    return calcPrecoParaMargem(_sn(custo), _sn(margemPercent));
}

/** Lucro absoluto: preço − custo. */
export function calcLucro(preco, custo) {
    return _sn(preco) - _sn(custo);
}

/**
 * Margem real (%) sobre o preço de venda.
 * Assinatura: (preco, custo) — compatível com o uso legado em ft-custos.js e ft-dashboard.js.
 * Internamente delega a calcMargemParaPreco(custo, preco) do engine.
 */
export function calcMargemReal(preco, custo) {
    return calcMargemParaPreco(_sn(custo), _sn(preco));
}

/** Markup implícito (%): quanto o preço supera o custo em termos relativos. */
export function calcMarkupImplicito(preco, custo) {
    const c = _sn(custo);
    return c <= 0 ? 0 : ((_sn(preco) - c) / c) * 100;
}

/** Custo (ou preço) por porção: valor total ÷ número de porções. */
export function calcCustoPorcao(custoTotal, porcoes) {
    const p = _sp(porcoes);
    return p <= 0 ? 0 : _sn(custoTotal) / p;
}

/** Rendimento: quantas pizzas/produções saem de uma embalagem. */
export function calcRendimento(qtdEmbalagem, qtdPorPizza) {
    const q = _sp(qtdPorPizza);
    return q <= 0 ? 0 : _sn(qtdEmbalagem) / q;
}


// ── Parse numérico unificado ────────────────────────────────────────
//
// Ponto único de parseNum para toda a aplicação.
// Re-exportado de ft-engine.js para eliminar a implementação duplicada
// que existia em ft-format.js.
//
export { parseNum } from './ft-engine.js';


// ── Validações ──────────────────────────────────────────────────────

/**
 * Valida um ingrediente StockFlow antes de salvar.
 * Mapeado para o contrato do engine; retorna mapa de erros.
 *
 * @param {object} ingRaw
 * @returns {{ name?, purchasePrice?, packageWeightG?, lossPercent? }}
 */
export function validarIngrediente(ingRaw) {
  return validateIngredient(_mapIngrediente(ingRaw) ?? {});
}

/**
 * Valida um preparo StockFlow antes de salvar.
 *
 * Nota: preparos do StockFlow usam ingredientes por nome (não ID),
 * portanto não há risco de referência circular. A validação verifica
 * apenas nome e peso final.
 *
 * @param {object} prepRaw
 * @returns {{ name?, finalWeightG? }}
 */
export function validarPreparo(prepRaw) {
  const d = prepRaw || {};
  return validatePreparo({
    id          : _ss(d.id) || '__new__',
    name        : _ss(d.nome ?? d.name),
    finalWeightG: _sp(d.peso_depois_pronto ?? d.finalWeightG),
    items       : [],    // sem refs de preparo filhos no StockFlow Pro
  }, []);
}

/**
 * Valida uma receita StockFlow antes de salvar.
 *
 * @param {object} recRaw
 * @returns {{ productName?, size? }}
 */
export function validarFicha(recRaw) {
  return validateFicha(_mapReceita(recRaw, null) ?? {});
}


// ── Configuração do serviço (auditável, imutável) ────────────────────

/**
 * Contrato de configuração do fichaService.
 * Frozen: não pode ser alterado em runtime.
 * Use para introspection e testes de integração.
 */
export const SERVICE_CONFIG = Object.freeze({
    ENGINE_MODE      : 'strict',
    VERSION          : '5.0',
    MEMO_MAX         : _MEMO_MAX,
    TRACE_MAX        : _TRACE_MAX,
    MEASURE_WARN_MS  : _MEASURE_WARN_MS,
    UNIT_MAP         : Object.freeze({ ..._G }),
});
