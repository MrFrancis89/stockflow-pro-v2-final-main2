// massa.js — StockFlow Pro v9.9.10
// Massa Master — Calculadora proporcional de receitas com múltiplas abas,
// ingredientes livres, renomear, criar e apagar receitas.
// Todas as ações destrutivas pedem confirmação.

import { darFeedback, copiarParaClipboard, esc } from './utils.js';
import { mostrarToast }                         from './toast.js';
import { mostrarConfirmacao }  from './confirm.js';
import { abrirComFoco, fecharComFoco } from './modal.js';

const STORAGE_KEY = 'massaMasterReceitas_v1';
const LEGACY_V1   = 'massaMasterBase_v1';
const LEGACY_V0   = 'massaMasterBase';

// ── Receita padrão de fábrica ─────────────────────────────────────
function gerarId() {
    return Date.now() + Math.floor(Math.random() * 99999);
}

function receitaPadrao() {
    return {
        id: gerarId(),
        nome: 'Massa Master',
        ingredientes: [
            { id: gerarId(), nome: 'Açúcar',      valor: 50,  unidade: 'g'  },
            { id: gerarId(), nome: 'Sal',          valor: 25,  unidade: 'g'  },
            { id: gerarId(), nome: 'Fermento',     valor: 2.5, unidade: 'g'  },
            { id: gerarId(), nome: 'Óleo',         valor: 50,  unidade: 'g'  },
            { id: gerarId(), nome: 'Água c/ gelo', valor: 500, unidade: 'ml' },
        ],
    };
}

// ── Storage ───────────────────────────────────────────────────────
function carregarEstado() {
    // Migrar chaves legadas
    try {
        const l0 = localStorage.getItem(LEGACY_V0);
        if (l0) { localStorage.setItem(LEGACY_V1, l0); localStorage.removeItem(LEGACY_V0); }
    } catch(e) {}

    // Migrar v9.7 (objeto de base) para v9.8 (array de receitas)
    try {
        const l1 = localStorage.getItem(LEGACY_V1);
        if (l1) {
            const base = JSON.parse(l1);
            const r = receitaPadrao();
            const map = { 'Açúcar':'acucar','Sal':'sal','Fermento':'fermento','Óleo':'oleo','Água c/ gelo':'agua' };
            r.ingredientes = r.ingredientes.map(ing =>
                map[ing.nome] && base[map[ing.nome]] != null ? { ...ing, valor: base[map[ing.nome]] } : ing
            );
            const estado = { receitas: [r], ativaIdx: 0 };
            localStorage.removeItem(LEGACY_V1);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
            return estado;
        }
    } catch(e) {}

    // Leitura normal
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.receitas) && parsed.receitas.length > 0) return parsed;
        }
    } catch(e) { console.warn('[massa] storage corrompido:', e); }

    const estado = { receitas: [receitaPadrao()], ativaIdx: 0 };
    salvarEstado(estado);
    return estado;
}

function salvarEstado(estado) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); }
    catch(e) { console.error('[massa] Falha ao salvar:', e); }
}

// ── Helpers de UI ─────────────────────────────────────────────────

function arredondar(n, c = 2) { return parseFloat(n.toFixed(c)); }

// Modal de entrada de texto (nome de receita, renomear)
function pedirTexto({ titulo, placeholder, valorInicial = '', extra = '', onOk }) {
    darFeedback();
    const modal = document.getElementById('massa-input-modal');
    if (!modal) return;

    document.getElementById('massa-modal-title').textContent = titulo;
    document.getElementById('massa-modal-body').innerHTML =
        (extra ? `<p style="font-size:13px;opacity:.65;margin:0 0 10px;">${esc(extra)}</p>` : '') +
        `<input id="massa-modal-input" class="modal-input" type="text"
                placeholder="${esc(placeholder)}" value="${esc(valorInicial)}"
                autocomplete="off" autocorrect="off" spellcheck="false"
                style="width:100%;box-sizing:border-box;">`;

    _abrirMassaModal(modal, () => {
        const val = document.getElementById('massa-modal-input')?.value.trim();
        if (!val) { mostrarToast('Campo não pode estar vazio.', 'aviso'); return false; }
        onOk(val); return true;
    });
    setTimeout(() => {
        const el = document.getElementById('massa-modal-input');
        el?.focus(); el?.select();
    }, 80);
}

// Modal de adição de ingrediente (nome + valor + unidade)
function pedirIngrediente({ onOk }) {
    darFeedback();
    const modal = document.getElementById('massa-input-modal');
    if (!modal) return;

    document.getElementById('massa-modal-title').textContent = 'Novo Ingrediente';
    document.getElementById('massa-modal-body').innerHTML = `
    <div style="display:grid;gap:10px;">
        <div>
            <label style="font-size:12px;opacity:.6;display:block;margin-bottom:4px;">Nome</label>
            <input id="mi-nome" class="modal-input" type="text" placeholder="Ex: Azeite"
                   autocomplete="off" style="width:100%;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>
                <label style="font-size:12px;opacity:.6;display:block;margin-bottom:4px;">Qtd por 1 kg de trigo</label>
                <input id="mi-valor" class="modal-input" type="number" placeholder="Ex: 30"
                       step="0.1" inputmode="decimal" style="width:100%;box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:12px;opacity:.6;display:block;margin-bottom:4px;">Unidade</label>
                <select id="mi-unidade" class="modal-input" style="width:100%;box-sizing:border-box;">
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                    <option value="uni">uni</option>
                    <option value="pct">pct</option>
                    <option value="cx">cx</option>
                    <option value="bld">bld</option>
                    <option value="crt">crt</option>
                    <option value="frd">frd</option>
                    <option value="rl">rl</option>
                    <option value="colher">colher</option>
                    <option value="xícara">xícara</option>
                </select>
            </div>
        </div>
    </div>`;

    _abrirMassaModal(modal, () => {
        const nome  = document.getElementById('mi-nome')?.value.trim();
        const valor = parseFloat((document.getElementById('mi-valor')?.value || '0').replace(/\./g, '').replace(',', '.'));
        const unid  = document.getElementById('mi-unidade')?.value || 'g';
        if (!nome)        { mostrarToast('Digite o nome.', 'aviso'); return false; }
        if (!valor || valor <= 0) { mostrarToast('Quantidade deve ser maior que zero.', 'aviso'); return false; }
        onOk({ nome, valor, unidade: unid }); return true;
    });
    setTimeout(() => document.getElementById('mi-nome')?.focus(), 80);
}

// Abre o modal e conecta os botões. callback retorna true para fechar.
function _abrirMassaModal(modal, onConfirm) {
    modal.style.display = 'flex';
    abrirComFoco(modal);

    // Substitui botões para remover handlers antigos
    ['massa-modal-ok','massa-modal-cancel','massa-modal-close'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const clone = el.cloneNode(true);
        el.replaceWith(clone);
    });

    // overlayHandler declarado antes de fechar() para que fechar() possa
    // removê-lo — evita acúmulo de listeners quando o modal é fechado via
    // botões (OK/Cancelar/✕) em vez de clique no overlay.
    let overlayHandler;
    function fechar() {
        fecharComFoco(modal);
        modal.style.display = 'none';
        modal.removeEventListener('click', overlayHandler);
    }

    document.getElementById('massa-modal-ok')?.addEventListener('click', () => {
        darFeedback(); if (onConfirm()) fechar();
    });
    document.getElementById('massa-modal-cancel')?.addEventListener('click', () => { darFeedback(); fechar(); });
    document.getElementById('massa-modal-close')?.addEventListener('click',  () => { darFeedback(); fechar(); });

    overlayHandler = e => { if (e.target === modal) fechar(); };
    modal.addEventListener('click', overlayHandler);

    // Enter no primeiro input do modal confirma
    const firstInput = modal.querySelector('input');
    firstInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { darFeedback(); if (onConfirm()) fechar(); }
        if (e.key === 'Escape') fechar();
    });
}

// ── Módulo principal ──────────────────────────────────────────────
export function iniciarMassa() {
    let estado = carregarEstado();

    const rec  = () => estado.receitas[estado.ativaIdx] || estado.receitas[0];
    const kg   = () => parseFloat((document.getElementById('massa-trigoInput')?.value || '0').replace(',','.')) || 0;
    const save = () => salvarEstado(estado);

    // ── Render completo ───────────────────────────────────────────
    function render() {
        const c = document.getElementById('massa-container');
        if (!c) return;
        const r = rec();
        const k = kg();

        c.innerHTML = buildHTML(r, k);
        bindEvents();
    }

    // ── HTML builder ──────────────────────────────────────────────
    function buildHTML(r, k) {
        return `
        <!-- ① HEADER COM LOGO -->
        <div class="card massa-hero-card">
            <div class="massa-brand">
                <span class="massa-logo">
                    ${SVG_PIZZA}
                </span>
                <div>
                    <h1 class="massa-title">Massa Master</h1>
                    <p class="massa-subtitle">Calculadora proporcional de receitas</p>
                </div>
            </div>
        </div>

        <!-- ② ABAS DE RECEITAS -->
        <div class="massa-tabs-bar">
            <div class="massa-tabs-scroll" id="massa-tabs-scroll">
                ${estado.receitas.map((rx, i) => `
                    <button class="massa-tab-btn${i === estado.ativaIdx ? ' active' : ''}"
                            data-midx="${i}" title="${esc(rx.nome)}">
                        ${esc(rx.nome.length > 14 ? rx.nome.slice(0,13)+'…' : rx.nome)}
                    </button>`).join('')}
                <button class="massa-tab-add" id="massa-btnNovaReceita" title="Nova receita">
                    ${SVG_PLUS}
                </button>
            </div>
        </div>

        <!-- ③ NOME + AÇÕES DA RECEITA ATIVA -->
        <div class="card massa-receita-card">
            <div class="massa-receita-topo">
                <span class="massa-receita-titulo">${esc(r.nome)}</span>
                <div class="massa-receita-acoes">
                    <button class="massa-icon-btn" id="massa-btnRenomear" title="Renomear">
                        ${SVG_EDIT} <span>Renomear</span>
                    </button>
                    ${estado.receitas.length > 1 ? `
                    <button class="massa-icon-btn massa-icon-btn--danger" id="massa-btnApagarReceita" title="Apagar">
                        ${SVG_TRASH} <span>Apagar</span>
                    </button>` : ''}
                    <button class="massa-icon-btn massa-icon-btn--muted" id="massa-btnResetReceita" title="Restaurar padrão">
                        ${SVG_RESET} <span>Padrão</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ④ INPUT DE TRIGO -->
        <div class="card massa-input-card">
            <label class="massa-label" for="massa-trigoInput">
                ${SVG_GRAIN} Quantidade de trigo (kg)
            </label>
            <input type="number" id="massa-trigoInput" class="massa-trigo-input"
                   placeholder="Ex: 2.5" step="0.1" inputmode="decimal"
                   autocomplete="off" value="${k || ''}">
        </div>

        <!-- ⑤ RESULTADOS CALCULADOS -->
        <div class="massa-section-label">Resultado proporcional</div>
        <div class="massa-results-grid" id="massa-results-grid">
            ${buildResultGrid(r, k)}
        </div>

        <!-- ⑥ PAINEL DE EDIÇÃO DOS INGREDIENTES -->
        <div class="card massa-edit-panel">
            <div class="massa-edit-header">
                <span class="massa-edit-title">
                    ${SVG_SETTINGS}
                    Ingredientes por 1 kg de trigo
                </span>
                <span class="massa-edit-hint">${r.ingredientes.length} ingrediente${r.ingredientes.length !== 1 ? 's' : ''}</span>
            </div>
            <div id="massa-ingr-list">
                ${buildIngrList(r)}
            </div>
            <button class="btn-zap massa-btn-add-ingr" id="massa-btnAddIngr">
                ${SVG_PLUS} Adicionar ingrediente
            </button>
        </div>

        <!-- ⑦ AÇÃO COPIAR -->
        <div class="massa-actions">
            <button id="massa-btnCopy" class="massa-action-btn btn-zap">
                ${SVG_COPY} Copiar Receita
            </button>
        </div>`;
    }

    function buildResultGrid(r, k) {
        if (!r.ingredientes.length) {
            return `<div class="massa-empty-state">Nenhum ingrediente. Adicione abaixo ↓</div>`;
        }
        return r.ingredientes.map(ing => `
            <div class="card massa-mini-card">
                <span class="massa-card-label">${esc(ing.nome)}</span>
                <div class="massa-card-value">
                    <span data-ingr-res="${ing.id}">${arredondar(k * ing.valor)}</span>
                    <small>${esc(ing.unidade)}</small>
                </div>
            </div>`).join('');
    }

    function buildIngrList(r) {
        if (!r.ingredientes.length) {
            return `<p class="massa-edit-note" style="text-align:center;padding:8px 0 4px;">
                     Use o botão abaixo para adicionar o primeiro ingrediente.</p>`;
        }
        return r.ingredientes.map(ing => `
        <div class="massa-ingr-row" data-mid="${ing.id}">
            <span class="massa-ingr-nome">${esc(ing.nome)}</span>
            <input class="massa-ingr-input" type="number" step="0.1"
                   value="${ing.valor}" inputmode="decimal"
                   data-mid="${ing.id}" aria-label="Quantidade de ${esc(ing.nome)}">
            <span class="massa-ingr-unid">${esc(ing.unidade)}</span>
            <button class="massa-ingr-del" data-mid="${ing.id}" aria-label="Remover ${esc(ing.nome)}">
                ${SVG_CLOSE}
            </button>
        </div>`).join('');
    }

    // ── Atualiza só os valores (sem re-render completo) ───────────
    function recalcular() {
        const r = rec(), k = kg();
        r.ingredientes.forEach(ing => {
            const el = document.querySelector(`[data-ingr-res="${ing.id}"]`);
            if (el) el.textContent = arredondar(k * ing.valor);
        });
    }

    // ── Eventos ───────────────────────────────────────────────────
    function bindEvents() {
        const r = rec();

        document.getElementById('massa-trigoInput')?.addEventListener('input', recalcular);

        // Troca de aba
        document.querySelectorAll('.massa-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                darFeedback();
                const idx = parseInt(btn.dataset.midx, 10);
                if (!isNaN(idx) && idx !== estado.ativaIdx) {
                    estado.ativaIdx = idx;
                    save(); render();
                }
            });
        });

        // Nova receita
        document.getElementById('massa-btnNovaReceita')?.addEventListener('click', () => {
            pedirTexto({
                titulo: 'Nova Receita',
                placeholder: 'Ex: Massa de Calabresa',
                extra: 'Escolha um nome para a nova receita:',
                onOk: nome => {
                    estado.receitas.push({ id: gerarId(), nome, ingredientes: [] });
                    estado.ativaIdx = estado.receitas.length - 1;
                    save(); render();
                    mostrarToast(`"${nome}" criada!`, 'sucesso');
                }
            });
        });

        // Renomear
        document.getElementById('massa-btnRenomear')?.addEventListener('click', () => {
            pedirTexto({
                titulo: 'Renomear Receita',
                placeholder: 'Novo nome',
                valorInicial: r.nome,
                extra: 'Digite o novo nome para esta receita:',
                onOk: novoNome => {
                    r.nome = novoNome;
                    save(); render();
                    mostrarToast('Receita renomeada!', 'sucesso');
                }
            });
        });

        // Apagar receita
        document.getElementById('massa-btnApagarReceita')?.addEventListener('click', () => {
            darFeedback();
            mostrarConfirmacao(
                `Apagar a receita "${r.nome}"?\nEsta ação não pode ser desfeita.`,
                () => {
                    estado.receitas.splice(estado.ativaIdx, 1);
                    estado.ativaIdx = Math.max(0, estado.ativaIdx - 1);
                    save(); render();
                    mostrarToast('Receita apagada.', 'info');
                }, 'perigo'
            );
        });

        // Restaurar padrão
        document.getElementById('massa-btnResetReceita')?.addEventListener('click', () => {
            darFeedback();
            mostrarConfirmacao(
                `Restaurar "${r.nome}" com os ingredientes padrão?\nOs ingredientes atuais serão substituídos.`,
                () => {
                    r.ingredientes = receitaPadrao().ingredientes;
                    save(); render();
                    mostrarToast('Receita restaurada para o padrão.', 'sucesso');
                }
            );
        });

        // Adicionar ingrediente
        document.getElementById('massa-btnAddIngr')?.addEventListener('click', () => {
            pedirIngrediente({
                onOk: ({ nome, valor, unidade }) => {
                    r.ingredientes.push({ id: gerarId(), nome, valor, unidade });
                    save(); render();
                    mostrarToast(`"${nome}" adicionado!`, 'sucesso');
                }
            });
        });

        // Editar valor de ingrediente inline
        document.querySelectorAll('.massa-ingr-input').forEach(input => {
            input.addEventListener('change', () => {
                const id  = parseInt(input.dataset.mid, 10);
                const ing = r.ingredientes.find(i => i.id === id);
                if (!ing) return;
                const v = parseFloat(input.value.replace(/\./g, '').replace(',', '.'));
                if (isNaN(v) || v < 0) { mostrarToast('Valor inválido.', 'aviso'); input.value = ing.valor; return; }
                ing.valor = v;
                save(); recalcular();
            });
        });

        // Remover ingrediente
        document.querySelectorAll('.massa-ingr-del').forEach(btn => {
            btn.addEventListener('click', () => {
                darFeedback();
                const id  = parseInt(btn.dataset.mid, 10);
                const ing = r.ingredientes.find(i => i.id === id);
                if (!ing) return;
                mostrarConfirmacao(
                    `Remover o ingrediente "${ing.nome}"?`,
                    () => {
                        r.ingredientes = r.ingredientes.filter(i => i.id !== id);
                        save(); render();
                        mostrarToast(`"${ing.nome}" removido.`, 'info');
                    }
                );
            });
        });

        // Copiar receita
        document.getElementById('massa-btnCopy')?.addEventListener('click', () => {
            darFeedback();
            const k = kg();
            if (!k) { mostrarToast('Digite a quantidade de trigo primeiro.', 'aviso'); return; }
            const linhas = r.ingredientes.map(ing =>
                `${ing.nome.padEnd(16)}: ${arredondar(k * ing.valor)} ${ing.unidade}`
            );
            copiarParaClipboard([`[Pizza] ${r.nome.toUpperCase()} -- ${k} kg de trigo`, '', ...linhas].join('\n'));
        });
    }

    render();
}

// ── SVG icons (inline para evitar imports extras) ─────────────────
const SVG_PIZZA = `<svg class="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 22h20L12 2z"/><circle cx="12" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg>`;
const SVG_PLUS  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_EDIT  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_TRASH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const SVG_RESET = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>`;
const SVG_GRAIN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M12 22V6M5 12l7-6 7 6"/><path d="M5 18l7-6 7 6"/></svg>`;
const SVG_SETTINGS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
const SVG_COPY  = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;