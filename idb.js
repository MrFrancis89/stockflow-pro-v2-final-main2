// idb.js — StockFlow Pro v9.8.0
// ══════════════════════════════════════════════════════════════════
// Wrapper minimalista sobre IndexedDB para o armazenamento de
// snapshots históricos (calendário).
//
// Por que não localStorage?
//   • localStorage é síncrono → bloqueia a Main Thread ao serializar
//     60 dias de dados (~centenas de KB).
//   • Cota de ~5 MB → estoura facilmente com histórico longo.
//   • IDB é assíncrono, cota de centenas de MB e cada snapshot é
//     uma entrada independente (sem ler/reescrever os outros 59).
//
// API pública:
//   idbFmtDate(d?)           → string "dd/mm/yyyy" zero-padded
//   idbGet(key)              → Promise<value | undefined>
//   idbSet(key, value)       → Promise<void>
//   idbSetComPurge(k,v,max)  → Promise<void>  ← set + purge atômicos
//   idbDel(key)              → Promise<void>
//   idbKeys()                → Promise<string[]>
//   idbClear()               → Promise<void>
// ══════════════════════════════════════════════════════════════════

const DB_NAME    = 'stockflow-snapshots';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

let _dbPromise = null;

function _openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => {
            console.error('[idb] Falha ao abrir IndexedDB:', e.target.error);
            reject(e.target.error);
        };
    });
    return _dbPromise;
}

function _tx(mode) {
    return _openDB().then(db => {
        const tx    = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        return { tx, store };
    });
}

function _req(idbRequest) {
    return new Promise((resolve, reject) => {
        idbRequest.onsuccess = e => resolve(e.target.result);
        idbRequest.onerror   = e => reject(e.target.error);
    });
}

// ── Formatador canônico de data ───────────────────────────────────
// FIX BUG 1: toLocaleDateString('pt-BR') em iOS Safari antigo retorna
// "1/1/2025" sem zero-padding, divergindo do fmt() do calendario.js
// que sempre produz "01/01/2025". Todas as gravações no IDB agora
// usam esta função como fonte única da chave de data.
export function idbFmtDate(d = new Date()) {
    return (
        String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' +
        d.getFullYear()
    );
}

// ── API pública ───────────────────────────────────────────────────

export async function idbGet(key) {
    const { store } = await _tx('readonly');
    return _req(store.get(key));
}

export async function idbSet(key, value) {
    const { store } = await _tx('readwrite');
    return _req(store.put(value, key));
}

export async function idbDel(key) {
    const { store } = await _tx('readwrite');
    return _req(store.delete(key));
}

export async function idbKeys() {
    const { store } = await _tx('readonly');
    return _req(store.getAllKeys());
}

export async function idbClear() {
    const { store } = await _tx('readwrite');
    return _req(store.clear());
}

// ── Set + Purge atômicos ──────────────────────────────────────────
// FIX BUG 2 + BUG 3: substitui o trio idbSet → idbKeys → idbDel[]
// que abria 3 transações separadas, criando race condition no iOS
// Safari e contenção com Promise.all de N writes simultâneos.
//
// Aqui: write, getAllKeys e todos os deletes ocorrem dentro de uma
// única transação readwrite — visibilidade e ordering garantidos
// pela spec do IDB. Sem Promise.all de transações concorrentes.
export function idbSetComPurge(key, value, maxKeys) {
    return _openDB().then(db => new Promise((resolve, reject) => {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        tx.oncomplete = () => resolve();
        tx.onerror    = e  => reject(e.target.error);
        tx.onabort    = () => reject(new Error('[idb] Transação abortada em idbSetComPurge'));

        const putReq = store.put(value, key);

        putReq.onsuccess = () => {
            // getAllKeys dentro da mesma tx — reflete o put acima imediatamente.
            const keysReq = store.getAllKeys();

            keysReq.onsuccess = () => {
                const all = keysReq.result;
                if (all.length <= maxKeys) return;

                const toDate = s => {
                    const [d, m, y] = s.split('/');
                    return new Date(+y, +m - 1, +d);
                };

                // Ordena do mais antigo para o mais novo e remove o excedente inicial.
                const excedentes = [...all]
                    .sort((a, b) => toDate(a) - toDate(b))
                    .slice(0, all.length - maxKeys);

                // Todos os deletes na mesma transação — sem contenção nem AbortError.
                for (const k of excedentes) store.delete(k);
            };

            keysReq.onerror = () => tx.abort();
        };

        putReq.onerror = () => tx.abort();
    }));
}

// ── Migração única do localStorage → IDB ─────────────────────────
// Chamada automaticamente no primeiro uso. Move a chave legada
// 'stockflow_snapshots_v1' para o IDB e remove do localStorage.
export async function migrarSnapshotsLegados(legacyKey) {
    try {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) return;
        const snaps = JSON.parse(raw);
        if (!snaps || typeof snaps !== 'object') return;

        const existentes = new Set(await idbKeys());
        for (const [data, payload] of Object.entries(snaps)) {
            if (!existentes.has(data)) {
                await idbSet(data, payload);
            }
        }
        localStorage.removeItem(legacyKey);
        console.info(`[idb] ${Object.keys(snaps).length} snapshot(s) migrado(s) do localStorage → IDB.`);
    } catch (e) {
        console.warn('[idb] Falha na migração de snapshots legados:', e);
    }
}
