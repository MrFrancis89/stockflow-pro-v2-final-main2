// storage.js — StockFlow Pro v9.9.42
// ══════════════════════════════════════════════════════════════════
// v9.9.5  — salvarDados() atualiza appStore.estoqueItens
// v9.9.39 — Múltiplos estoques
// v9.9.41 — [BUG 1] criarEstoque: retorna nome.trim()
//           [BUG 2] _atualizarStoreEstoques: inclui estoqueItens no store
//
//   ESTRUTURA LOCAL (localStorage)
//   ────────────────────────────────
//   sf_estoques_meta   → JSON: Array<{ id, nome }>
//                        Ordem dos estoques na UI; sem os itens.
//   sf_estoque_{id}    → JSON: Array<item>
//                        Itens de cada estoque, isolados por chave.
//   sf_estoque_ativo   → string: id do estoque selecionado
//
//   Chave legada 'estoqueDados_v4_categorias' é migrada para o
//   estoque "Principal" na primeira execução e removida.
//
//   ESTRUTURA FIREBASE (Firestore)
//   ────────────────────────────────
//   users/{uid}/dados/principal →
//     {
//       estoquesMeta: [{ id, nome }],
//       estoques:     { [id]: Array<item> },
//       ocultos:      [],
//       meus:         [],
//       ts:           number
//     }
//   users/{uid}/dados/listafacil → (inalterado)
//
//   Mantém backward-compat: se o documento tiver apenas o campo
//   legado `estoque` (array), migra automaticamente para o esquema
//   multi-estoque na próxima gravação.
// ══════════════════════════════════════════════════════════════════

import { idbGet, idbSetComPurge, idbKeys, idbFmtDate, migrarSnapshotsLegados } from './idb.js';
import { fbIsAvailable, fbSave, fbLoad }                                        from './firebase.js';
import appStore                                                                 from './store.js';

// ── Constantes de chaves ──────────────────────────────────────────
export const STORAGE_KEYS = {
    // Multi-estoque (v9.9.39)
    estoquesMeta:   'sf_estoques_meta',
    estoquePrefix:  'sf_estoque_',
    estoqueAtivo:   'sf_estoque_ativo',

    // Legado — mantido para migração
    dadosLegado:    'estoqueDados_v4_categorias',

    ocultos:        'itensOcultosPadrao_v4',
    meus:           'meusItensPadrao_v4',
    tema:           'temaEstoque',
    lupaPos:        'lupaPosicao_v1',
    dicaSwipe:      'dicaSwipeMostrada',
    ultimaVersao:   'stockflow_ultima_versao',
    lfItens:        'listaFacil_itens_v1',
    lfOrcamento:    'listaFacil_orcamento_v1',
    lfHistorico:    'listaFacil_historico_v1',
    lfConfig:       'listaFacil_config_v1',
};

// ── Gerador de ID ─────────────────────────────────────────────────
function _gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Wrappers localStorage ─────────────────────────────────────────
function _setItem(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { console.error(`[storage] Falha ao salvar "${key}":`, e); return false; }
}
function _getItem(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.error(`[storage] Dado corrompido em "${key}":`, e);
        return fallback;
    }
}

// ── Migração legada ───────────────────────────────────────────────
/**
 * Verifica se existe a chave legada 'estoqueDados_v4_categorias'.
 * Se sim, cria um estoque "Principal" com esses dados, remove a chave
 * legada e retorna true. Opera uma única vez (idempotente).
 */
function _migrarLegado() {
    const dadosLegados = _getItem(STORAGE_KEYS.dadosLegado, null);
    if (dadosLegados === null) return false; // já migrado ou nunca existiu

    const meta = _getItem(STORAGE_KEYS.estoquesMeta, null);
    if (meta !== null) {
        // Já existe estrutura multi — remove legado sem recriar
        localStorage.removeItem(STORAGE_KEYS.dadosLegado);
        return false;
    }

    // Cria estoque "Principal" com os dados legados
    const id = _gerarId();
    const novoMeta = [{ id, nome: 'Principal' }];
    _setItem(STORAGE_KEYS.estoquesMeta,          JSON.stringify(novoMeta));
    _setItem(STORAGE_KEYS.estoquePrefix + id,     JSON.stringify(dadosLegados));
    _setItem(STORAGE_KEYS.estoqueAtivo,           id);
    localStorage.removeItem(STORAGE_KEYS.dadosLegado);
    console.info('[storage] Migração legado → multi-estoque concluída. ID:', id);
    return true;
}

// ── API de estoques ───────────────────────────────────────────────

/**
 * Retorna a lista de metadados dos estoques (sem os itens).
 * @returns {Array<{ id: string, nome: string }>}
 */
export function carregarEstoquesMeta() {
    return _getItem(STORAGE_KEYS.estoquesMeta, []);
}

/**
 * Retorna o ID do estoque ativo.
 * Garante que sempre exista um estoque; cria "Principal" se necessário.
 * @returns {string}
 */
export function carregarEstoqueAtivoId() {
    let id = localStorage.getItem(STORAGE_KEYS.estoqueAtivo);
    const meta = carregarEstoquesMeta();

    // Valida que o ID salvo ainda existe na lista
    if (id && meta.some(m => m.id === id)) return id;

    // Fallback: usa o primeiro da lista ou cria um novo
    if (meta.length > 0) {
        id = meta[0].id;
        _setItem(STORAGE_KEYS.estoqueAtivo, id);
        return id;
    }

    // Nenhum estoque existe — cria "Principal" do zero
    id = _gerarId();
    const novoMeta = [{ id, nome: 'Principal' }];
    _setItem(STORAGE_KEYS.estoquesMeta,      JSON.stringify(novoMeta));
    _setItem(STORAGE_KEYS.estoquePrefix + id, JSON.stringify([]));
    _setItem(STORAGE_KEYS.estoqueAtivo,       id);
    return id;
}

/**
 * Salva o ID do estoque ativo e atualiza o store.
 * Dispara renderização dos módulos via change:estoqueAtivoId.
 * @param {string} id
 */
export function salvarEstoqueAtivoId(id) {
    _setItem(STORAGE_KEYS.estoqueAtivo, id);
    const itens = carregarItensEstoque(id);
    appStore.set({ estoqueAtivoId: id, estoqueItens: itens });
}

/**
 * Carrega os itens de um estoque específico.
 * @param {string} id
 * @returns {Array}
 */
export function carregarItensEstoque(id) {
    return _getItem(STORAGE_KEYS.estoquePrefix + id, []);
}

/**
 * Cria um novo estoque com array de itens vazio.
 * @param {string} nome - Nome exibido na UI
 * @returns {{ id: string, nome: string }}
 */
export function criarEstoque(nome) {
    const nomeTrimado = nome.trim();
    const id   = _gerarId();
    const meta = carregarEstoquesMeta();
    meta.push({ id, nome: nomeTrimado });
    _setItem(STORAGE_KEYS.estoquesMeta,       JSON.stringify(meta));
    _setItem(STORAGE_KEYS.estoquePrefix + id, JSON.stringify([]));
    _atualizarStoreEstoques();
    _agendarSyncPrincipal();
    // FIX BUG 1: retorna nomeTrimado (o que foi salvo), não o nome bruto original.
    return { id, nome: nomeTrimado };
}

/**
 * Renomeia um estoque existente.
 * @param {string} id
 * @param {string} novoNome
 */
export function renomearEstoque(id, novoNome) {
    const meta = carregarEstoquesMeta();
    const entry = meta.find(m => m.id === id);
    if (!entry) return;
    entry.nome = novoNome.trim();
    _setItem(STORAGE_KEYS.estoquesMeta, JSON.stringify(meta));
    _atualizarStoreEstoques();
    _agendarSyncPrincipal();
}

/**
 * Exclui um estoque e todos os seus itens.
 * Se for o estoque ativo, ativa o primeiro da lista restante.
 * Nunca permite excluir o último — garante ao menos 1 estoque.
 * @param {string} id
 */
export function excluirEstoque(id) {
    let meta = carregarEstoquesMeta();
    if (meta.length <= 1) return; // proteção: ao menos 1 estoque

    meta = meta.filter(m => m.id !== id);
    _setItem(STORAGE_KEYS.estoquesMeta, JSON.stringify(meta));
    localStorage.removeItem(STORAGE_KEYS.estoquePrefix + id);

    // Se era o ativo, troca para o primeiro restante
    const ativoAtual = localStorage.getItem(STORAGE_KEYS.estoqueAtivo);
    if (ativoAtual === id) {
        salvarEstoqueAtivoId(meta[0].id);
    } else {
        _atualizarStoreEstoques();
    }
    _agendarSyncPrincipal();
}

// ── Sincroniza o store com o estado atual do localStorage ─────────
function _atualizarStoreEstoques() {
    const meta    = carregarEstoquesMeta();
    const ativoId = localStorage.getItem(STORAGE_KEYS.estoqueAtivo) || '';
    const estoques = new Map();
    meta.forEach(({ id, nome }) => {
        estoques.set(id, { id, nome, itens: carregarItensEstoque(id) });
    });
    // FIX BUG 2: inclui estoqueItens para manter alerta.js e compras.js sincronizados.
    // Sem isso, após criarEstoque/renomearEstoque o atalho de leitura ficava stale.
    const estoqueItens = ativoId
        ? (estoques.get(ativoId)?.itens ?? [])
        : [];
    appStore.set({ estoques, estoqueAtivoId: ativoId, estoqueItens });
}

// ── Debounce Firebase sync ────────────────────────────────────────
let _syncPrincipalTimer = null;
let _syncLFTimer        = null;

function _agendarSyncPrincipal() {
    clearTimeout(_syncPrincipalTimer);
    _syncPrincipalTimer = setTimeout(_pushPrincipal, 2000);
}
function _agendarSyncLF() {
    clearTimeout(_syncLFTimer);
    _syncLFTimer = setTimeout(_pushListaFacil, 2000);
}

async function _pushPrincipal() {
    if (!fbIsAvailable()) return;
    try {
        const meta = carregarEstoquesMeta();
        const estoques = {};
        meta.forEach(({ id }) => {
            estoques[id] = carregarItensEstoque(id);
        });
        await fbSave('dados', 'principal', {
            estoquesMeta: meta,
            estoques,
            ocultos: _getItem(STORAGE_KEYS.ocultos, []) ?? [],
            meus:    _getItem(STORAGE_KEYS.meus,    []) ?? [],
            ts:      Date.now(),
        });
    } catch(e) { console.warn('[storage] fbSave dados/principal falhou:', e); }
}

async function _pushListaFacil() {
    if (!fbIsAvailable()) return;
    try {
        await fbSave('dados', 'listafacil', {
            itens:     _getItem(STORAGE_KEYS.lfItens,     null) ?? [],
            orcamento: _getItem(STORAGE_KEYS.lfOrcamento, null) ?? 3200,
            historico: _getItem(STORAGE_KEYS.lfHistorico, {})  ?? {},
            ts:        Date.now(),
        });
    } catch(e) { console.warn('[storage] fbSave dados/listafacil falhou:', e); }
}

// ── Pull Firebase → localStorage ─────────────────────────────────
export async function fbPullPrincipal() {
    if (!fbIsAvailable()) return;
    try {
        const docs       = await fbLoad('dados');
        const principal  = docs.find(d => d.id === 'principal');
        const listafacil = docs.find(d => d.id === 'listafacil');

        if (principal) {
            // ── Esquema multi-estoque ──────────────────────────
            if (Array.isArray(principal.estoquesMeta) && principal.estoquesMeta.length > 0
                && principal.estoques && typeof principal.estoques === 'object') {

                _setItem(STORAGE_KEYS.estoquesMeta, JSON.stringify(principal.estoquesMeta));
                principal.estoquesMeta.forEach(({ id }) => {
                    const itens = principal.estoques[id];
                    if (Array.isArray(itens)) {
                        _setItem(STORAGE_KEYS.estoquePrefix + id, JSON.stringify(itens));
                    }
                });

                // FIX: valida o estoqueAtivo local contra o meta recebido.
                // Se o ID local não existe no meta do servidor (ex: foi excluído
                // em outro dispositivo), usa o primeiro do meta para evitar que
                // carregarEstoqueAtivoId() precise corrigir com efeito colateral.
                const ativoLocal    = localStorage.getItem(STORAGE_KEYS.estoqueAtivo);
                const ativoValido   = principal.estoquesMeta.some(m => m.id === ativoLocal);
                if (!ativoValido) {
                    _setItem(STORAGE_KEYS.estoqueAtivo, principal.estoquesMeta[0].id);
                }

            // ── Migração: documento legado com campo `estoque` ─
            } else if (Array.isArray(principal.estoque) && principal.estoque.length > 0) {
                const id       = _gerarId();
                const novoMeta = [{ id, nome: 'Principal' }];
                _setItem(STORAGE_KEYS.estoquesMeta,       JSON.stringify(novoMeta));
                _setItem(STORAGE_KEYS.estoquePrefix + id,  JSON.stringify(principal.estoque));
                if (!localStorage.getItem(STORAGE_KEYS.estoqueAtivo))
                    _setItem(STORAGE_KEYS.estoqueAtivo, id);
                console.info('[storage] Migração Firebase legado → multi concluída.');
            }

            if (Array.isArray(principal.ocultos))
                _setItem(STORAGE_KEYS.ocultos, JSON.stringify(principal.ocultos));
            if (Array.isArray(principal.meus))
                _setItem(STORAGE_KEYS.meus,    JSON.stringify(principal.meus));
        }

        if (listafacil) {
            if (Array.isArray(listafacil.itens))
                _setItem(STORAGE_KEYS.lfItens,     JSON.stringify(listafacil.itens));
            if (typeof listafacil.orcamento === 'number')
                _setItem(STORAGE_KEYS.lfOrcamento, String(listafacil.orcamento));
            if (listafacil.historico && typeof listafacil.historico === 'object')
                _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(listafacil.historico));
        }

        // FIX RAIZ: após atualizar o localStorage, sincroniza o appStore
        // para que salvarDados e outros módulos usem os IDs e dados corretos.
        // Sem isso, o store ficava com IDs do boot antigo enquanto o localStorage
        // já tinha os IDs do Firebase — qualquer troca de estoque salvava
        // nos IDs errados, zerando o conteúdo ao voltar.
        const ativoIdAtualizado = localStorage.getItem(STORAGE_KEYS.estoqueAtivo)
                               || carregarEstoqueAtivoId();
        const metaAtualizada    = carregarEstoquesMeta();
        const estoquesMap       = new Map();
        metaAtualizada.forEach(({ id, nome }) => {
            estoquesMap.set(id, { id, nome, itens: carregarItensEstoque(id) });
        });
        const estoqueItensAtualizado = estoquesMap.get(ativoIdAtualizado)?.itens ?? [];
        appStore.set({
            estoques:       estoquesMap,
            estoqueAtivoId: ativoIdAtualizado,
            estoqueItens:   estoqueItensAtualizado,
        });

        console.info('[storage] Pull Firebase concluído. Store sincronizado.');
    } catch(e) {
        console.warn('[storage] fbPull falhou, usando localStorage:', e);
    }
}

/** Push imediato de todos os dados locais para o Firebase. */
export async function fbPushTudo() {
    await _pushPrincipal();
    await _pushListaFacil();
}

// ── Estoque ativo — API principal ─────────────────────────────────

/**
 * Ponto de entrada do boot. Executa migração legada se necessário,
 * garante que exista ao menos um estoque, popula o appStore completo
 * e retorna os itens do estoque ativo.
 * @returns {Array} itens do estoque ativo
 */
export function inicializarEstoques() {
    _migrarLegado();
    const ativoId = carregarEstoqueAtivoId();
    const itens   = carregarItensEstoque(ativoId);

    const meta     = carregarEstoquesMeta();
    const estoques = new Map();
    meta.forEach(({ id, nome }) => {
        estoques.set(id, { id, nome, itens: id === ativoId ? itens : carregarItensEstoque(id) });
    });

    appStore.set({ estoques, estoqueAtivoId: ativoId, estoqueItens: itens });
    return itens;
}

/**
 * Persiste os itens de um estoque ESPECÍFICO por ID, sem alterar o ativo.
 * Usado por _trocarEstoque para salvar o estoque que está sendo deixado,
 * evitando dependência de appStore ou localStorage durante a transição.
 * @param {string} id   — ID do estoque a salvar
 * @param {Array}  itens — itens a persistir
 */
export function salvarItensEstoque(id, itens) {
    if (!id) return;
    _setItem(STORAGE_KEYS.estoquePrefix + id, JSON.stringify(itens));
    _agendarSyncPrincipal();
    // Atualiza o Map sem mudar o ativo
    const estoques = appStore.get('estoques') || new Map();
    const novoMapa = new Map(estoques);
    const entryAtual = novoMapa.get(id);
    novoMapa.set(id, entryAtual ? { ...entryAtual, itens } : { id, nome: '', itens });
    appStore.set({ estoques: novoMapa });
}

/**
 * Persiste os itens do estoque ativo no localStorage, agenda sync
 * Firebase e atualiza appStore.estoqueItens (fonte de verdade).
 * Substitui salvarDados() legado para o estoque ativo.
 */
export function salvarDados(d) {
    // FIX RAIZ: usa localStorage como fonte de verdade para o ID ativo.
    // appStore.estoqueAtivoId pode estar stale após fbPullPrincipal() que
    // só grava no localStorage sem atualizar o store. Se salvarDados usasse
    // o store, os dados seriam gravados na chave errada → lista zerada ao trocar.
    const id = localStorage.getItem(STORAGE_KEYS.estoqueAtivo)
            || appStore.get('estoqueAtivoId');
    if (!id) return;
    _setItem(STORAGE_KEYS.estoquePrefix + id, JSON.stringify(d));
    _agendarSyncPrincipal();
    // Reconstrói o Map sem mutação in-place.
    // new Map(estoques) é cópia RASA — os objetos internos { id, nome, itens }
    // são as mesmas referências. Mutar .itens antes de new Map() contamina o
    // objeto original, causando dados incorretos após troca de estoque.
    const estoques = appStore.get('estoques') || new Map();
    const novoMapa = new Map();
    estoques.forEach((entry, key) => {
        // Cria cópia do objeto de cada estoque; para o ativo, usa os novos dados
        novoMapa.set(key, key === id
            ? { ...entry, itens: d }
            : { ...entry });
    });
    // Se o ativo não estava no map ainda (estoque recém-criado), adiciona
    if (!novoMapa.has(id)) {
        novoMapa.set(id, { id, nome: '', itens: d });
    }
    appStore.set({ estoqueItens: d, estoques: novoMapa });
}

/**
 * Carrega os itens do estoque ativo do localStorage.
 * @returns {Array|null}
 */
export function carregarDados() {
    // Prefere o localStorage como fonte de verdade para o ID ativo —
    // mais confiável que appStore durante transições de troca de estoque.
    const id = carregarEstoqueAtivoId() || appStore.get('estoqueAtivoId');
    if (!id) return null;
    return _getItem(STORAGE_KEYS.estoquePrefix + id, null);
}

// ── Configurações de lista ────────────────────────────────────────
export function salvarOcultos(o) {
    _setItem(STORAGE_KEYS.ocultos, JSON.stringify(o));
    _agendarSyncPrincipal();
}
export function carregarOcultos() { return _getItem(STORAGE_KEYS.ocultos, []); }
export function salvarMeus(m) {
    _setItem(STORAGE_KEYS.meus, JSON.stringify(m));
    _agendarSyncPrincipal();
}
export function carregarMeus() { return _getItem(STORAGE_KEYS.meus, []); }

// ── UI / Tema ─────────────────────────────────────────────────────
export function salvarTema(modo)       { _setItem(STORAGE_KEYS.tema, modo); }
export function carregarTema()         { return localStorage.getItem(STORAGE_KEYS.tema); }
export function salvarPosicaoLupa(p)   { _setItem(STORAGE_KEYS.lupaPos, JSON.stringify(p)); }
export function carregarPosicaoLupa()  { return _getItem(STORAGE_KEYS.lupaPos, null); }
export function marcarDicaSwipeVista() { _setItem(STORAGE_KEYS.dicaSwipe, 'true'); }
export function dicaSwipeFoiVista()    { return !!localStorage.getItem(STORAGE_KEYS.dicaSwipe); }
export function salvarUltimaVersao(v)  { _setItem(STORAGE_KEYS.ultimaVersao, v); }
export function carregarUltimaVersao() { return localStorage.getItem(STORAGE_KEYS.ultimaVersao); }

// ── Lista Fácil ───────────────────────────────────────────────────
export function salvarItensLF(itens) {
    _setItem(STORAGE_KEYS.lfItens, JSON.stringify(itens));
    _agendarSyncLF();
}
export function carregarItensLF()     { return _getItem(STORAGE_KEYS.lfItens, null); }
export function salvarOrcamentoLF(v) {
    _setItem(STORAGE_KEYS.lfOrcamento, String(v));
    _agendarSyncLF();
}
export function carregarOrcamentoLF() {
    try {
        const v = localStorage.getItem(STORAGE_KEYS.lfOrcamento);
        return v ? (parseFloat(v) || 3200) : 3200;
    } catch { return 3200; }
}

// ── Histórico de preços ───────────────────────────────────────────
const MAX_HIST = 10;

export function registrarPrecoHistorico(nomeItem, preco) {
    if (!nomeItem || preco <= 0) return;
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    const k = nomeItem.toLowerCase().trim();
    if (!h[k]) h[k] = [];
    const hoje = new Date().toLocaleDateString('pt-BR');
    const last = h[k][h[k].length - 1];
    if (last && last.d === hoje && last.v === preco) return;
    h[k].push({ d: hoje, v: preco });
    if (h[k].length > MAX_HIST) h[k] = h[k].slice(-MAX_HIST);
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(h));
    _agendarSyncLF();
}
export function carregarHistoricoItem(nomeItem) {
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    return h[nomeItem.toLowerCase().trim()] || [];
}
export function carregarHistoricoCompleto()  { return _getItem(STORAGE_KEYS.lfHistorico, {}); }
export function limparHistoricoItem(nomeItem) {
    const h = _getItem(STORAGE_KEYS.lfHistorico, {});
    delete h[nomeItem.toLowerCase().trim()];
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(h));
    _agendarSyncLF();
}
export function limparTodoHistorico() {
    _setItem(STORAGE_KEYS.lfHistorico, '{}');
    _agendarSyncLF();
}
export function mesclarHistorico(historicoExterno) {
    if (!historicoExterno || typeof historicoExterno !== 'object') return;
    const local  = _getItem(STORAGE_KEYS.lfHistorico, {});
    const toDate = s => { const [d, m, y] = s.split('/'); return new Date(y, m - 1, d); };
    for (const [k, pontos] of Object.entries(historicoExterno)) {
        if (!Array.isArray(pontos)) continue;
        if (!local[k]) {
            local[k] = pontos.slice(-MAX_HIST);
        } else {
            const datasLocais = new Set(local[k].map(p => p.d));
            for (const p of pontos) {
                if (!datasLocais.has(p.d)) { local[k].push(p); datasLocais.add(p.d); }
            }
            local[k].sort((a, b) => toDate(a.d) - toDate(b.d));
            if (local[k].length > MAX_HIST) local[k] = local[k].slice(-MAX_HIST);
        }
    }
    _setItem(STORAGE_KEYS.lfHistorico, JSON.stringify(local));
    _agendarSyncLF();
}

// ══════════════════════════════════════════════════════════════════
// ── Snapshots (IndexedDB) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

const MAX_SNAPSHOTS = 60;
migrarSnapshotsLegados('stockflow_snapshots_v1');

export async function salvarSnapshot(payload) {
    const hoje = idbFmtDate();

    // Inclui mapa de estoques no snapshot para restore completo
    const meta = carregarEstoquesMeta();
    const estoquesMapa = {};
    meta.forEach(({ id }) => {
        estoquesMapa[id] = carregarItensEstoque(id);
    });

    const entrada = {
        ts:            Date.now(),
        // Legado: 'estoque' aponta para o estoque ativo (compat. com restore)
        estoque:       Array.isArray(payload.estoque) ? payload.estoque : [],
        estoquesMeta:  meta,
        estoques:      estoquesMapa,
        ocultos:       Array.isArray(payload.ocultos) ? payload.ocultos : [],
        meus:          Array.isArray(payload.meus)    ? payload.meus    : [],
        lfItens:       Array.isArray(payload.lfItens) ? payload.lfItens : [],
        lfOrcamento:   typeof payload.lfOrcamento === 'number' ? payload.lfOrcamento : 3200,
        lfHistorico:   payload.lfHistorico && typeof payload.lfHistorico === 'object'
                       ? payload.lfHistorico : {},
    };

    try {
        await idbSetComPurge(hoje, entrada, MAX_SNAPSHOTS);
    } catch (e) {
        console.error('[storage] Falha ao salvar snapshot no IDB:', e);
    }
}

export async function carregarSnapshot(dataStr) {
    try { return (await idbGet(dataStr)) ?? null; }
    catch (e) { console.error('[storage] Falha ao carregar snapshot:', e); return null; }
}

export async function listarDatasComSnapshot() {
    try { return await idbKeys(); }
    catch (e) { console.error('[storage] Falha ao listar snapshots:', e); return []; }
}

export async function exportarTodosSnapshots() {
    const chaves = await idbKeys();
    const snapshots = {};
    await Promise.all(chaves.map(async k => {
        try { const s = await idbGet(k); if (s) snapshots[k] = s; } catch {}
    }));
    return { versao: '9.9.42', exportadoEm: new Date().toISOString(), snapshots };
}

export async function importarSnapshots(backupObj) {
    if (!backupObj?.snapshots || typeof backupObj.snapshots !== 'object')
        throw new Error('Arquivo de backup inválido ou corrompido.');
    const entradas = Object.entries(backupObj.snapshots);
    let importados = 0, ignorados = 0;
    for (const [data, payload] of entradas) {
        try {
            const existente = await idbGet(data);
            if (!existente || (payload.ts && payload.ts > (existente.ts || 0))) {
                await idbSetComPurge(data, payload, MAX_SNAPSHOTS); importados++;
            } else { ignorados++; }
        } catch { ignorados++; }
    }
    return { importados, ignorados };
}

// ── Lista Fácil — Configuração ────────────────────────────────────
export function carregarConfigLF() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.lfConfig);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
export function salvarConfigLF(cfg) {
    try { localStorage.setItem(STORAGE_KEYS.lfConfig, JSON.stringify(cfg)); } catch(e) {}
}
