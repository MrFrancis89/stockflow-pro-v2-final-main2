// store.js — StockFlow Pro Reactive State v9.9.40
// ══════════════════════════════════════════════════════════════════
// v9.9.39 — Múltiplos estoques
//   Novos campos no estado global:
//     estoques      : Map<id, { id, nome, itens[] }>
//     estoqueAtivoId: string — ID do estoque selecionado
//
//   estoqueItens mantido como atalho de leitura para compatibilidade
//   com módulos legados (alerta.js, compras.js) sem alteração.
// ══════════════════════════════════════════════════════════════════

class Store extends EventTarget {
    #state = {};

    constructor(initialState = {}) {
        super();
        this.#state = { ...initialState };
    }

    get(key) {
        return this.#state[key];
    }

    set(partial) {
        const prev = { ...this.#state };
        this.#state = { ...this.#state, ...partial };

        // CONTRATO: valores do tipo Map/Set devem ser passados como novas instâncias
        // (new Map(existente)) — comparação é por referência. Nunca mutar o Map do
        // estado in-place sem criar uma nova instância ao chamar set().
        const changedKeys = Object.keys(partial).filter(k => partial[k] !== prev[k]);
        if (changedKeys.length === 0) return;

        this.dispatchEvent(new CustomEvent('change', {
            detail: { prev, next: this.#state, keys: changedKeys }
        }));

        changedKeys.forEach(key => {
            this.dispatchEvent(new CustomEvent(`change:${key}`, {
                detail: { prev: prev[key], next: this.#state[key] }
            }));
        });
    }

    snapshot() {
        return { ...this.#state };
    }

    on(key, callback) {
        const handler = (e) => callback(e.detail.next, e.detail.prev);
        this.addEventListener(`change:${key}`, handler);
        return () => this.removeEventListener(`change:${key}`, handler);
    }
}

export const appStore = new Store({
    tema:           'escuro',
    abaAtiva:       'estoque',
    lfItens:        [],
    lfOrcamento:    3200.00,

    // ── Multi-estoque (v9.9.39) ──────────────────────────────────
    estoques:       new Map(),   // Map<id, { id, nome, itens[] }>
    estoqueAtivoId: '',          // ID do estoque selecionado

    // Atalho de leitura — sempre == estoques.get(estoqueAtivoId)?.itens ?? []
    // Mantém compatibilidade com alerta.js e compras.js sem alteração.
    estoqueItens:   [],

    pwaInstalavel:  false,
    pwaPrompt:      null,
});

export default appStore;
