// bg-upload.js — StockFlow Pro v9.9.34
// ══════════════════════════════════════════════════════════════════
// Módulo de personalização de background.
// Suporta: imagem personalizada (IDB) e cor sólida (localStorage).
// API pública: initBgUpload() · removeBg()
// ══════════════════════════════════════════════════════════════════

const _BG_DB_NAME    = 'stockflow-bg';
const _BG_STORE_NAME = 'background';
const _BG_DB_VERSION = 1;
const _BG_KEY        = 'current';
const _BG_COLOR_LS   = 'stockflow_bg_color_v1';

let _bgDbPromise      = null;
let _currentObjUrl    = null;
let _resizeAbortCtrl  = null; // FIX MÉDIO: AbortController real substitui flag booleana

// ── IDB ───────────────────────────────────────────────────────────
function _openBgDB() {
    if (_bgDbPromise) return _bgDbPromise;
    _bgDbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(_BG_DB_NAME, _BG_DB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(_BG_STORE_NAME)) {
                db.createObjectStore(_BG_STORE_NAME);
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
    return _bgDbPromise;
}

function _bgTx(mode) {
    return _openBgDB().then(db => {
        const tx    = db.transaction(_BG_STORE_NAME, mode);
        const store = tx.objectStore(_BG_STORE_NAME);
        return { tx, store };
    });
}

function _idbReq(req) {
    return new Promise((res, rej) => {
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e.target.error);
    });
}

async function _bgSave(blob) {
    const buf = await blob.arrayBuffer();
    const { store } = await _bgTx('readwrite');
    return _idbReq(store.put({ buf, type: blob.type }, _BG_KEY));
}

async function _bgLoad() {
    try {
        const { store } = await _bgTx('readonly');
        return await _idbReq(store.get(_BG_KEY));
    } catch { return null; }
}

async function _bgDelete() {
    try {
        const { store } = await _bgTx('readwrite');
        return _idbReq(store.delete(_BG_KEY));
    } catch { /* nada salvo */ }
}

// ── Fix zoom mobile: dimensões em px, não vw/vh ───────────────────
function _travarDimensoes() {
    const w = window.innerWidth  + 'px';
    const h = window.innerHeight + 'px';
    const el = document.getElementById('bg-image-layer');
    const ov = document.getElementById('bg-overlay');
    if (el) { el.style.width = w; el.style.height = h; }
    if (ov) { ov.style.width = w; ov.style.height = h; }
}

function _iniciarResizeWatch() {
    // FIX MÉDIO: AbortController garante que re-chamadas (hot-reload, testes)
    // não acumulem listeners no window — padrão de pullrefresh.js.
    if (_resizeAbortCtrl) _resizeAbortCtrl.abort();
    _resizeAbortCtrl = new AbortController();
    let t;
    window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(_travarDimensoes, 150);
    }, { passive: true, signal: _resizeAbortCtrl.signal });
}

// ── Aplicar imagem ────────────────────────────────────────────────
// Recria o <img> do zero a cada troca — zero estado residual.
function _applyBgImage(objectUrl) {
    const oldUrl = _currentObjUrl;
    _currentObjUrl = objectUrl;

    // Remove elemento anterior
    document.getElementById('bg-image-layer')?.remove();

    // Limpa cor sólida
    document.body.style.backgroundColor = '';
    document.body.classList.remove('has-solid-color');
    try { localStorage.removeItem(_BG_COLOR_LS); } catch { /* quota */ }

    // Cria <img> novo com dimensões travadas em px
    const img = document.createElement('img');
    img.id  = 'bg-image-layer';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.style.width  = window.innerWidth  + 'px';
    img.style.height = window.innerHeight + 'px';
    img.src = objectUrl;

    img.onload = () => {
        if (oldUrl && oldUrl !== objectUrl) URL.revokeObjectURL(oldUrl);
    };
    img.onerror = () => {
        console.error('[bg-upload] Falha ao carregar imagem:', objectUrl);
        // Revoga também no erro — sem onload o oldUrl jamais seria liberado.
        if (oldUrl && oldUrl !== objectUrl) URL.revokeObjectURL(oldUrl);
    };

    document.body.insertBefore(img, document.body.firstChild);
    document.body.classList.add('has-custom-bg');

    // Garante overlay
    if (!document.getElementById('bg-overlay')) {
        const ov = document.createElement('div');
        ov.id = 'bg-overlay';
        img.insertAdjacentElement('afterend', ov);
    }
    const ov = document.getElementById('bg-overlay');
    if (ov) {
        ov.style.width   = window.innerWidth  + 'px';
        ov.style.height  = window.innerHeight + 'px';
        ov.style.display = 'block';
    }

    _iniciarResizeWatch();
}

// ── Aplicar cor sólida ────────────────────────────────────────────
function _applyBgColor(hex) {
    if (_currentObjUrl) {
        URL.revokeObjectURL(_currentObjUrl);
        _currentObjUrl = null;
    }
    // Remove imagem e overlay
    const imgEl = document.getElementById('bg-image-layer');
    const ovEl  = document.getElementById('bg-overlay');
    if (imgEl) { imgEl.src = ''; imgEl.style.display = 'none'; }
    if (ovEl)  ovEl.style.display = 'none';

    document.body.classList.add('has-custom-bg', 'has-solid-color');
    document.body.style.backgroundColor = hex;
    try { localStorage.setItem(_BG_COLOR_LS, hex); } catch { /* quota */ }
    // void explícito: fire-and-forget intencional — _bgDelete é async mas não
    // precisamos aguardar aqui. Falha silenciosa é aceitável: a imagem residual
    // no IDB será sobrescrita na próxima seleção de imagem ou limpeza de fundo.
    void _bgDelete();
}

// ── Limpar tudo ───────────────────────────────────────────────────
function _clearBg() {
    if (_currentObjUrl) {
        URL.revokeObjectURL(_currentObjUrl);
        _currentObjUrl = null;
    }
    document.body.classList.remove('has-custom-bg', 'has-solid-color');
    document.body.style.backgroundColor = '';
    document.getElementById('bg-image-layer')?.remove();
    document.getElementById('bg-overlay')?.remove();
    try { localStorage.removeItem(_BG_COLOR_LS); } catch { /* quota */ }
}

// ── Handler de arquivo ────────────────────────────────────────────
async function _onFileSelected(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const previewUrl = URL.createObjectURL(file);
    _applyBgImage(previewUrl);
    try {
        await _bgSave(file);
    } catch (e) {
        console.error('[bg-upload] Falha ao salvar no IDB:', e);
    }
}

// ── Painel de fundo ───────────────────────────────────────────────
const CORES_SOLIDAS = [
    { hex: '#0A0A0E', label: 'Preto'    },
    { hex: '#1C1C1E', label: 'Dark'     },
    { hex: '#1a1a2e', label: 'Midnight' },
    { hex: '#0e2218', label: 'Forest'   },
    { hex: '#1a0a00', label: 'Marrom'   },
    { hex: '#0a0020', label: 'Roxo'     },
    { hex: '#001a10', label: 'Verde'    },
    { hex: '#00101a', label: 'Azul'     },
    { hex: '#f5f5f7', label: 'Branco'   },
    { hex: '#1e1e1e', label: 'Grafite'  },
];

function _abrirPainel(btnFundo) {
    document.getElementById('bg-color-panel')?.remove();

    const painel = document.createElement('div');
    painel.id = 'bg-color-panel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Fundo');

    const titulo = document.createElement('p');
    titulo.className = 'bg-color-panel-title';
    titulo.textContent = 'Cor de fundo';
    painel.appendChild(titulo);

    const grid = document.createElement('div');
    grid.className = 'bg-color-grid';
    CORES_SOLIDAS.forEach(({ hex, label }) => {
        const btn = document.createElement('button');
        btn.className = 'bg-color-swatch';
        btn.style.background = hex;
        btn.setAttribute('title', label);
        btn.setAttribute('aria-label', label);
        btn.addEventListener('click', () => {
            _applyBgColor(hex);
            painel.remove();
        });
        grid.appendChild(btn);
    });
    painel.appendChild(grid);

    const sep = document.createElement('p');
    sep.className = 'bg-color-sep';
    sep.textContent = 'ou';
    painel.appendChild(sep);

    const btnImg = document.createElement('button');
    btnImg.className = 'bg-color-btn-imagem';
    btnImg.innerHTML = '📷&nbsp; Escolher imagem...';
    btnImg.addEventListener('click', () => {
        painel.remove();
        document.getElementById('bg-upload')?.click();
    });
    painel.appendChild(btnImg);

    const btnRem = document.createElement('button');
    btnRem.className = 'bg-color-btn-remover';
    btnRem.textContent = 'Remover fundo';
    btnRem.addEventListener('click', async () => {
        _clearBg();
        await _bgDelete();
        painel.remove();
    });
    painel.appendChild(btnRem);

    // Renderiza invisível para medir altura real antes de posicionar
    painel.style.visibility = 'hidden';
    painel.style.top        = '0';
    painel.style.left       = '0';
    document.body.appendChild(painel);

    // rAF garante que o browser já fez layout e offsetHeight é real
    requestAnimationFrame(() => {
        const rect   = btnFundo.getBoundingClientRect();
        const pw     = painel.offsetWidth;
        const ph     = painel.offsetHeight;
        const margin = 8;
        const vw     = window.innerWidth;
        const vh     = window.innerHeight;

        // Tenta abrir ACIMA; se não couber, abre ABAIXO; sempre clampeia
        let top;
        if (rect.top - ph - margin >= margin) {
            top = rect.top - ph - margin;
        } else {
            top = rect.bottom + margin;
        }
        // Garante que nunca sai pela parte de baixo nem de cima
        top = Math.min(top, vh - ph - margin);
        top = Math.max(top, margin);

        // Horizontal: alinha com botão, sem sair da tela
        let left = rect.left;
        if (left + pw > vw - margin) left = vw - pw - margin;
        if (left < margin) left = margin;

        painel.style.top        = top + 'px';
        painel.style.left       = left + 'px';
        painel.style.bottom     = 'auto';
        painel.style.visibility = 'visible';
    });


    setTimeout(() => {
        document.addEventListener('pointerdown', function fechar(e) {
            if (!painel.contains(e.target) && e.target !== btnFundo) {
                painel.remove();
                document.removeEventListener('pointerdown', fechar);
            }
        });
    }, 0);
}

// ── Wiring ────────────────────────────────────────────────────────
function _injectUI() {
    const btn   = document.getElementById('btn-fundo');
    const input = document.getElementById('bg-upload');
    if (!btn || !input) return;

    input.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) _onFileSelected(file);
        e.target.value = '';
    });

    btn.addEventListener('click', () => _abrirPainel(btn));

    document.addEventListener('tabChanged', e => {
        btn.style.display = e.detail?.tab === 'fichatecnica' ? 'none' : 'flex';
    });
}

// ── API pública ───────────────────────────────────────────────────
export async function initBgUpload() {
    _injectUI();

    // Restaura cor sólida
    try {
        const cor = localStorage.getItem(_BG_COLOR_LS);
        if (cor) { _applyBgColor(cor); return; }
    } catch { /* sem cor */ }

    // Restaura imagem do IDB
    try {
        const stored = await _bgLoad();
        if (!stored?.buf) return;
        const blob      = new Blob([stored.buf], { type: stored.type || 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        _applyBgImage(objectUrl);
    } catch (e) {
        console.warn('[bg-upload] Falha ao restaurar background:', e);
    }
}

export async function removeBg() {
    _clearBg();
    await _bgDelete();
}
