// ft-storage.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// CAMADA DE DADOS — Ficha Técnica
// ──────────────────────────────────────────────────────────────────
// v10.0 — TAREFA 3: separação clara dados ↔ lógica.
//   • Esta camada é exclusivamente responsável por persistência.
//   • Zero lógica de negócio aqui — apenas CRUD + sincronização.
//   • Estratégia: LocalStorage como fonte primária + Firebase como
//     espelho em nuvem. Fallback automático e transparente.
//   • Logs estruturados para rastreabilidade.
// ══════════════════════════════════════════════════════════════════

import { fbSave, fbLoad, fbDelete, fbIsAvailable } from './firebase.js';

const LS_PREFIX = 'ft_';
const _warn = (...a) => console.warn('[ft-storage]', ...a);

// ── LocalStorage helpers ───────────────────────────────────────────
function lsKey(col)       { return LS_PREFIX + col; }

function lsGetAll(col) {
    try {
        return JSON.parse(localStorage.getItem(lsKey(col)) || '{}');
    } catch {
        return {};
    }
}

function lsSetAll(col, dados) {
    try {
        localStorage.setItem(lsKey(col), JSON.stringify(dados));
    } catch (e) {
        // QuotaExceededError → loga mas não quebra a aplicação
        _warn(`lsSetAll(${col}): localStorage cheio ou bloqueado.`, e);
    }
}

// ── CRUD principal ─────────────────────────────────────────────────

/**
 * Salva (upsert) um item.
 * Escreve no LS imediatamente; tenta espelhar no Firebase em background.
 * @param {string} colecao
 * @param {string} id
 * @param {object} dados
 */
export async function salvar(colecao, id, dados) {
    const item = { ...dados, id };
    // 1. Persiste local primeiro — garantia de resposta imediata
    const local = lsGetAll(colecao);
    local[id] = item;
    lsSetAll(colecao, local);
    // 2. Espelha no Firebase (não-bloqueante)
    if (fbIsAvailable()) {
        try { await fbSave(colecao, id, item); }
        catch (e) { _warn(`fbSave falhou (${colecao}/${id}) — dado seguro no LS.`, e); }
    }
}

/**
 * Carrega todos os itens de uma coleção.
 * Prioridade: Firebase → LS como fallback automático.
 * @param {string} colecao
 * @returns {Promise<Array>}
 */
export async function carregar(colecao) {
    if (fbIsAvailable()) {
        try {
            const fbDados = await fbLoad(colecao);
            // Atualiza LS com dados do Firebase (keep-in-sync)
            const mapa = {};
            fbDados.forEach(d => { mapa[d.id] = d; });
            lsSetAll(colecao, mapa);
            return fbDados;
        } catch (e) {
            _warn(`fbLoad falhou (${colecao}) — usando LS como fallback.`, e);
        }
    }
    return Object.values(lsGetAll(colecao));
}

/**
 * Remove um item.
 * Remove do LS imediatamente; tenta remover do Firebase em background.
 * @param {string} colecao
 * @param {string} id
 */
export async function remover(colecao, id) {
    const local = lsGetAll(colecao);
    delete local[id];
    lsSetAll(colecao, local);
    if (fbIsAvailable()) {
        try { await fbDelete(colecao, id); }
        catch (e) { _warn(`fbDelete falhou (${colecao}/${id}) — removido do LS.`, e); }
    }
}

// ── Configurações ─────────────────────────────────────────────────
const CFG_KEY = LS_PREFIX + 'config';

/**
 * Salva configurações do usuário.
 * @param {object} dados
 */
export async function salvarConfig(dados) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(dados)); }
    catch (e) { _warn('salvarConfig LS falhou:', e); }
    if (fbIsAvailable()) {
        try { await fbSave('configuracoes', 'default', dados); }
        catch (e) { _warn('salvarConfig Firebase falhou — salvo no LS.', e); }
    }
}

/**
 * Carrega configurações do usuário.
 * @returns {Promise<object|null>}
 */
export async function carregarConfig() {
    if (fbIsAvailable()) {
        try {
            const lista = await fbLoad('configuracoes');
            const cfg = lista.find(d => d.id === 'default');
            if (cfg) return cfg;
        } catch (e) { _warn('carregarConfig Firebase falhou — usando LS.', e); }
    }
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); }
    catch (e) { _warn('carregarConfig LS corrompido — retornando null.', e); return null; }
}

// ── Sincronização ─────────────────────────────────────────────────

/**
 * Push completo LS → Firebase.
 * Chamado após login bem-sucedido ou trigger manual de sync.
 * Inclui todas as coleções gerenciadas pela Ficha Técnica.
 */
export async function sincronizarLocalParaFirebase() {
    if (!fbIsAvailable()) return;
    const colecoes = ['ingredientes', 'receitas', 'preparos', 'gastos'];
    let ok = 0, fail = 0;
    for (const col of colecoes) {
        const local = lsGetAll(col);
        for (const [id, item] of Object.entries(local)) {
            try {
                await fbSave(col, id, item);
                ok++;
            } catch (e) {
                fail++;
                _warn(`sync falhou (${col}/${id}):`, e);
            }
        }
    }
    console.info(`[ft-storage] ✓ Sync concluído: ${ok} ok, ${fail} falhas.`);
}

/**
 * Limpa todos os dados de uma coleção no LS.
 * Usado por funcionalidades de "Limpar tudo" nos módulos.
 * @param {string} colecao
 */
export function limparColecaoLocal(colecao) {
    lsSetAll(colecao, {});
}
