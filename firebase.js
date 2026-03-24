// firebase.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// v9.9.6 — Migração para Firebase SDK v10 Modular (tree-shakeable).
//
//   ANTES (compat SDK v9.22.2):
//     • 3 <script> bloqueantes no HTML (~350KB combinados)
//     • Namespace global window.firebase — impossível tree-shaking
//
//   DEPOIS (SDK v10 modular):
//     • Zero <script> no HTML — importado aqui via CDN ES modules
//     • Apenas as funções usadas são carregadas (~80KB a menos)
//     • API pública idêntica — nenhum outro módulo precisa mudar
//
//   Com Vite (melhoria #10) os imports viram 'firebase/app' etc. e o
//   bundler resolve tree-shaking + offline automaticamente.
// ══════════════════════════════════════════════════════════════════

import { initializeApp }
    from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFirestore, collection, doc,
         setDoc, getDocs, deleteDoc, onSnapshot }
    from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signOut, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

// ── CONFIGURAÇÃO ──────────────────────────────────────────────────
// Esta versão (firebase.js) é usada SEM Vite, servindo arquivos estáticos
// diretamente. import.meta.env não está disponível nesse modo.
//
// ⚠️  ANTES DE PUBLICAR NO GIT: remova as credenciais abaixo e substitua
//     por placeholders. Use firebase.vite.js (com import.meta.env) em produção.
//     Garanta que .gitignore existe e inclui .env — veja .env.example.
//
// Para deploy com Vite: use firebase.vite.js conforme descrito no seu header.
const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyCyEkDlF-9zYG6N-QoibYCCeyyNjr7YQ8I',
    authDomain:        'stockflow-pro-274d7.firebaseapp.com',
    projectId:         'stockflow-pro-274d7',
    storageBucket:     'stockflow-pro-274d7.firebasestorage.app',
    messagingSenderId: '1081617701534',
    appId:             '1:1081617701534:web:d2b8a296ddeaacc961f98f',
};

let _app   = null;
let _db    = null;
let _auth  = null;
let _uid   = null;
let _user  = null;
let _ready = false;
const _readyListeners = [];

export function fbIsAvailable() { return _ready && !!_uid; }
export function fbGetUid()      { return _uid; }
export function fbGetUser()     { return _user; }

export async function initFirebase() {
    try {
        _app  = initializeApp(FIREBASE_CONFIG);
        _db   = getFirestore(_app);
        _auth = getAuth(_app);
        return true;
    } catch (e) {
        console.error('[firebase] Erro ao inicializar SDK:', e);
        return false;
    }
}

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

function _colRef(colecao) {
    if (!_db || !_uid) throw new Error('[firebase] Firebase indisponível ou sem usuário autenticado.');
    return collection(_db, 'users', _uid, colecao);
}

/**
 * Salva (upsert) um documento.
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
 * @returns {Array<object>} Array com campo `id` em cada item.
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
