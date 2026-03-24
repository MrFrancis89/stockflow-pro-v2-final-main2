// firebase.vite.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// Versão Vite: usa imports de pacote npm e import.meta.env.
// Para usar: npm run build (Vite resolve os imports e as env vars).
//
// DEPLOY SEM VITE (GitHub Pages, arquivos estáticos):
//   Use firebase.js — funciona direto no browser via CDN gstatic.
//   Não é necessário ativar este arquivo para deploy estático.
//
// API pública idêntica à firebase.js — nenhum outro módulo muda.
// ══════════════════════════════════════════════════════════════════

import { initializeApp }
    from 'firebase/app';
import { getFirestore, collection, doc,
         setDoc, getDocs, deleteDoc, onSnapshot }
    from 'firebase/firestore';
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signOut, onAuthStateChanged }
    from 'firebase/auth';

// Variáveis de ambiente Vite (configure .env com VITE_FIREBASE_*).
// Consulte .env.example para a lista completa.
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
    console.warn(
        '[firebase] ⚠  Variáveis VITE_FIREBASE_* não encontradas.\n' +
        'Copie .env.example → .env e preencha as credenciais do Firebase.'
    );
}

const FIREBASE_CONFIG = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             || '',
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || '',
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || '',
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             import.meta.env.VITE_FIREBASE_APP_ID              || '',
};

// ── Estado interno ────────────────────────────────────────────────
let _app   = null;
let _db    = null;
let _auth  = null;
let _uid   = null;
let _user  = null;
let _ready = false;
const _readyListeners = [];

// ── Getters públicos ──────────────────────────────────────────────
export function fbIsAvailable() { return _ready && !!_uid; }
export function fbGetUid()      { return _uid; }
export function fbGetUser()     { return _user; }

// ── Inicialização ─────────────────────────────────────────────────
export async function initFirebase() {
    try {
        _app  = initializeApp(FIREBASE_CONFIG);
        _db   = getFirestore(_app);
        _auth = getAuth(_app);
        console.info('[firebase] ✓ SDK Vite inicializado.');
        return true;
    } catch (e) {
        console.error('[firebase] ✗ Erro ao inicializar SDK:', e);
        return false;
    }
}

// ── Auth ──────────────────────────────────────────────────────────
export function fbGetCurrentUser() {
    return new Promise(resolve => {
        if (!_auth) { resolve(null); return; }
        const unsub = onAuthStateChanged(_auth, user => {
            unsub();
            if (user) { _uid = user.uid; _user = user; _ready = true; }
            resolve(user || null);
        });
    });
}

export async function fbSignInGoogle() {
    if (!_auth) throw new Error('[firebase] Firebase não inicializado.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        const cred = await signInWithPopup(_auth, provider);
        _uid   = cred.user.uid;
        _user  = cred.user;
        _ready = true;
        _readyListeners.forEach(fn => fn(_user));
        console.info(`[firebase] ✓ Login Google — UID: ${_uid}`);
        return cred.user;
    } catch (e) {
        console.error('[firebase] ✗ Erro no login Google:', e);
        throw e;
    }
}

export async function fbSignOut() {
    if (!_auth) return;
    try {
        await signOut(_auth);
        _uid = null; _user = null; _ready = false;
        console.info('[firebase] ✓ Logout realizado.');
    } catch (e) {
        console.error('[firebase] ✗ Erro no logout:', e);
        throw e;
    }
}

export function onFirebaseReady(cb) {
    if (typeof cb === 'function') _readyListeners.push(cb);
}

// ── Helpers internos ──────────────────────────────────────────────
function _colRef(colecao) {
    if (!_db || !_uid) throw new Error('[firebase] Firebase indisponível ou sem usuário autenticado.');
    return collection(_db, 'users', _uid, colecao);
}

// ── CRUD ──────────────────────────────────────────────────────────

/**
 * Salva (upsert) um documento.
 * @param {string} colecao  Nome da coleção Firestore
 * @param {string} id       ID do documento
 * @param {object} dados    Dados a salvar (merge: true)
 */
export async function fbSave(colecao, id, dados) {
    if (!fbIsAvailable()) throw new Error('[firebase] fbSave: usuário não autenticado.');
    try {
        await setDoc(doc(_colRef(colecao), id), dados, { merge: true });
    } catch (e) {
        console.error(`[firebase] ✗ fbSave(${colecao}/${id}):`, e);
        throw e;
    }
}

/**
 * Carrega todos os documentos de uma coleção.
 * @returns {Array<object>} Array de objetos com campo `id`.
 */
export async function fbLoad(colecao) {
    if (!fbIsAvailable()) throw new Error('[firebase] fbLoad: usuário não autenticado.');
    try {
        const snap = await getDocs(_colRef(colecao));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error(`[firebase] ✗ fbLoad(${colecao}):`, e);
        throw e;
    }
}

/**
 * Remove um documento.
 */
export async function fbDelete(colecao, id) {
    if (!fbIsAvailable()) throw new Error('[firebase] fbDelete: usuário não autenticado.');
    try {
        await deleteDoc(doc(_colRef(colecao), id));
    } catch (e) {
        console.error(`[firebase] ✗ fbDelete(${colecao}/${id}):`, e);
        throw e;
    }
}

/**
 * Observa mudanças em tempo real em uma coleção.
 * @returns {Function} Função para cancelar o listener (unsubscribe).
 */
export function fbWatch(colecao, callback) {
    if (!fbIsAvailable()) {
        console.warn(`[firebase] fbWatch(${colecao}): Firebase indisponível.`);
        return () => {};
    }
    try {
        return onSnapshot(_colRef(colecao), snap => {
            callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, e => {
            console.error(`[firebase] ✗ fbWatch(${colecao}):`, e);
        });
    } catch (e) {
        console.error(`[firebase] ✗ fbWatch(${colecao}) setup:`, e);
        return () => {};
    }
}
