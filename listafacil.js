// listafacil.js — StockFlow Pro v9.9.42
// v9.7.5: CSS extraído para style.css; esc() centralizado em utils.js.
// v9.8.9: Pedido de Compra WhatsApp — formatação, envio por fornecedor,
//         campo "fone" no modelo de item, modal de edição de telefone.
// ══════════════════════════════════════════════════════════════════
// CORREÇÃO DEFINITIVA — Delegação de eventos
// ══════════════════════════════════════════════════════════════════
// A raiz dos problemas anteriores era adicionar listeners individuais
// em cada <tr> durante renderLFLista(). Isso cria race conditions,
// handlers duplicados e pode ser bloqueado por CSS do container.
//
// SOLUÇÃO: Delegação de eventos — UM listener no tbody que detecta
// clicks em qualquer botão/input filho via e.target.closest().
// Sobrevive a re-renders, não acumula, não é afetado por CSS pai.
// ══════════════════════════════════════════════════════════════════

import {
    carregarItensLF, salvarItensLF,
    carregarOrcamentoLF, salvarOrcamentoLF,
    registrarPrecoHistorico,
    STORAGE_KEYS,
} from './storage.js';
import { mostrarToast }        from './toast.js';
import { mostrarConfirmacao }  from './confirm.js';
import { darFeedback, copiarParaClipboard, esc } from './utils.js';
import { agendarSnapshot }     from './calendario.js';
import { abrirComFoco, fecharComFoco } from './modal.js';
import { avaliarExpr }         from './expr.js';

// ── Chave de storage para configurações do pedido ────────────────
// FIX #5 CRÍTICO: era 'sf_lf_config_v1' — divergia de STORAGE_KEYS.lfConfig
// ('listaFacil_config_v1'). Config nunca era lida por storage.js. Unificado.
const LF_CONFIG_KEY = STORAGE_KEYS.lfConfig;

// ── Estado ───────────────────────────────────────────────────────
let lfItens     = [];
let lfOrcamento = 3200;
let lfCalcInput = null;
let lfCalcExpr  = '';
let _delegacaoInited      = false;
let _sfDadosListenerInited = false; // FIX BUG 7: previne acúmulo do listener sf:dados-recarregados
let _editItemId = null; // id do item sendo editado no modal de telefone

// ── Configurações persistidas ─────────────────────────────────────
function _loadConfig() {
    try { return JSON.parse(localStorage.getItem(LF_CONFIG_KEY) || '{}'); } catch { return {}; }
}
function _saveConfig(cfg) {
    try { localStorage.setItem(LF_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}

// ── Inicialização ─────────────────────────────────────────────────
export function iniciarListaFacil() {
    const raw = carregarItensLF();
    lfItens = Array.isArray(raw) ? raw.map((it, i) => ({
        id:   it.id   || (Date.now() + i),
        n:    it.n    || '',
        q:    it.q    !== undefined ? Number(it.q) : 1,
        p:    it.p    !== undefined ? Number(it.p) : 0,
        fone: it.fone || '',   // ← v9.8.9: telefone do fornecedor (opcional)
    })) : [];
    lfOrcamento = carregarOrcamentoLF() || 3200;

    renderLFLista();
    atualizarGauge();
    configurarEventosDelegados();
    configurarTabsLF();
    configurarBudgetInput();
    configurarCalcLF();
    configurarAddModal();
    configurarEditItemModal();
    configurarPedidoModal();
    configurarComparador();

    // FAB
    document.addEventListener('tabChanged', e => {
        const fab = document.getElementById('lf-fabAddItem');
        if (!fab) return;
        fab.style.display = (e.detail?.tab === 'listafacil') ? 'flex' : 'none';
    });
    document.getElementById('lf-fabAddItem')?.addEventListener('click', () => {
        darFeedback(); abrirAddModal();
    });

    // Ações globais
    document.getElementById('lf-zerarPrecosBtn')?.addEventListener('click', () => {
        darFeedback();
        mostrarConfirmacao('Zerar todos os preços da lista?', () => {
            lfItens = lfItens.map(it => ({ ...it, p: 0 }));
            salvarLF(); renderLFLista(); atualizarGauge();
        });
    });
    document.getElementById('lf-zerarQuantidadesBtn')?.addEventListener('click', () => {
        darFeedback();
        mostrarConfirmacao('Zerar todas as quantidades?', () => {
            lfItens = lfItens.map(it => ({ ...it, q: 0 }));
            salvarLF(); renderLFLista(); atualizarGauge();
        });
    });
    document.getElementById('lf-zerarItensBtn')?.addEventListener('click', () => {
        darFeedback();
        mostrarConfirmacao('Remover TODOS os itens da lista?', () => {
            lfItens = []; salvarLF(); renderLFLista(); atualizarGauge();
        }, 'perigo');
    });

    document.getElementById('lf-shareBtn')?.addEventListener('click', compartilharListaLF);
    document.getElementById('lf-pedidoBtn')?.addEventListener('click', () => {
        darFeedback(); abrirModalPedido();
    });

    document.getElementById('lf-showChangelog')?.addEventListener('click', () => {
        darFeedback();
        const el = document.getElementById('lf-changelogModal');
        el.style.display = 'flex';
        abrirComFoco(el);
    });
    document.getElementById('lf-closeChangelog')?.addEventListener('click', () => {
        const el = document.getElementById('lf-changelogModal');
        fecharComFoco(el);
        el.style.display = 'none';
    });
    document.getElementById('lf-closeChangelogBtn')?.addEventListener('click', () => {
        const el = document.getElementById('lf-changelogModal');
        fecharComFoco(el);
        el.style.display = 'none';
    });

    // v9.9.5 — atualiza dados sem recarregar a página
    // Disparado por recarregarDados() após restaurar snapshot, importar JSON
    // ou restaurar da nuvem. Apenas re-lê e re-renderiza — sem re-registrar listeners.
    //
    // FIX BUG 7: listener registrado dentro de iniciarListaFacil() sem proteção
    // de flag. Se a função fosse chamada N vezes (ex: HMR, testes), N handlers
    // acumulavam no document e N re-renders disparavam simultaneamente após cada
    // sf:dados-recarregados. A flag _delegacaoInited já protegia os listeners
    // da tabela — aplicamos o mesmo padrão aqui.
    if (!_sfDadosListenerInited) {
        _sfDadosListenerInited = true;
        document.addEventListener('sf:dados-recarregados', () => {
            const raw = carregarItensLF();
            lfItens = Array.isArray(raw) ? raw.map((it, i) => ({
                id:   it.id   || (Date.now() + i),
                n:    it.n    || '',
                q:    it.q    !== undefined ? Number(it.q) : 1,
                p:    it.p    !== undefined ? Number(it.p) : 0,
                fone: it.fone || '',
            })) : [];
            lfOrcamento = carregarOrcamentoLF() || 3200;
            renderLFLista();
            atualizarGauge();
        });
    }
}

// ── Delegação de eventos na tabela (UMA VEZ) ──────────────────────
function configurarEventosDelegados() {
    if (_delegacaoInited) return;
    _delegacaoInited = true;

    const tbody = document.getElementById('lf-tableBody');
    if (!tbody) return;

    // ── Apagar item ────────────────────────────────────────────
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.lf-btn-del-row');
        if (!btn) return;
        const lid  = parseInt(btn.dataset.lid);
        const nome = btn.dataset.nome || '?';
        mostrarConfirmacao(`Remover "${nome}" da lista?`, () => {
            const idx = lfItens.findIndex(i => i.id === lid);
            if (idx !== -1) {
                lfItens.splice(idx, 1);
                salvarLF(); renderLFLista(); atualizarGauge();
            }
        });
    });

    // ── Abrir calculadora ao clicar no preço ───────────────────
    tbody.addEventListener('click', (e) => {
        const inp = e.target.closest('.lf-input-preco');
        if (!inp) return;
        e.preventDefault();
        darFeedback();
        abrirCalcLF(inp, inp.dataset.nome || '');
    });

    // ── Editar telefone do fornecedor ──────────────────────────
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.lf-btn-fone');
        if (!btn) return;
        darFeedback();
        const lid = parseInt(btn.dataset.lid);
        abrirEditItemModal(lid);
    });

    // ── Atualizar quantidade ───────────────────────────────────
    tbody.addEventListener('change', (e) => {
        const inp = e.target.closest('.lf-input-qtd');
        if (!inp) return;
        const lid  = parseInt(inp.dataset.lid);
        const it   = lfItens.find(i => i.id === lid);
        if (!it) return;
        const novaQ = parseFloat(inp.value.replace(',', '.')) || 0;
        it.q = novaQ;
        const totalEl = tbody.querySelector(`.lf-item-total[data-lid="${lid}"]`);
        if (totalEl) totalEl.textContent = fmtMoeda(novaQ * (it.p || 0));
        salvarLF(); atualizarGauge();
    });

    // ── Selecionar tudo ao focar qtd ───────────────────────────
    tbody.addEventListener('focus', (e) => {
        if (e.target.classList.contains('lf-input-qtd')) e.target.select();
    }, true);
}

// ── Render da lista ───────────────────────────────────────────────
function renderLFLista() {
    const tbody = document.getElementById('lf-tableBody');
    if (!tbody) return;

    if (lfItens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"
            style="text-align:center;padding:32px 16px;opacity:.45;font-size:14px;">
            Nenhum item — toque no <strong>+</strong> para adicionar
            </td></tr>`;
        return;
    }

    tbody.innerHTML = lfItens.map(item => {
        const q       = Number(item.q) || 0;
        const p       = Number(item.p) || 0;
        const temFone = !!(item.fone && item.fone.trim());
        // Ícone de telefone: verde se tem número, muted se não tem
        const foneIcon = `
          <button class="lf-btn-fone${temFone ? ' has-fone' : ''}"
                  type="button"
                  data-lid="${item.id}"
                  title="${temFone ? 'Fornecedor: ' + esc(item.fone) : 'Adicionar telefone do fornecedor'}"
                  aria-label="${temFone ? 'Editar telefone' : 'Adicionar telefone do fornecedor'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.69 12 19.79 19.79 0 011.62 3.52 2 2 0 013.6 1.33h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 9a16 16 0 006.09 6.09l.98-.98a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </button>`;
        return `
        <tr data-lid="${item.id}">
          <td class="lf-td-nome">
            <span class="lf-nome-item">${esc(item.n)}</span>${foneIcon}
          </td>
          <td class="lf-td-qtd">
            <input type="text" class="lf-input-qtd"
                   value="${fmtQtd(q)}"
                   inputmode="decimal"
                   data-lid="${item.id}"
                   aria-label="Qtd ${esc(item.n)}">
          </td>
          <td class="lf-td-preco">
            <input type="text" class="lf-input-preco"
                   value="${fmtMoeda(p)}"
                   readonly
                   data-lid="${item.id}"
                   data-nome="${esc(item.n)}"
                   aria-label="Preço ${esc(item.n)}">
          </td>
          <td class="lf-td-total">
            <span class="lf-item-total" data-lid="${item.id}">${fmtMoeda(q * p)}</span>
          </td>
          <td class="lf-td-del">
            <button class="lf-btn-del-row"
                    type="button"
                    data-lid="${item.id}"
                    data-nome="${esc(item.n)}"
                    aria-label="Remover ${esc(item.n)}">
              <svg width="15" height="15" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </td>
        </tr>`;
    }).join('');
}

// ── Modal de adicionar item ───────────────────────────────────────
function configurarAddModal() {
    const modal    = document.getElementById('lf-addModal');
    if (!modal) return;
    const inputEl  = document.getElementById('lf-addNomeInput');
    const foneEl   = document.getElementById('lf-addFoneInput');
    const btnOk    = document.getElementById('lf-confirmAddItem');
    const btnCan   = document.getElementById('lf-cancelAddItem');
    const btnClose = document.getElementById('lf-closeAddModal');

    function fechar() {
        fecharComFoco(modal);
        modal.style.display = 'none';
        if (inputEl) inputEl.value = '';
        if (foneEl)  foneEl.value  = '';
    }
    function confirmar() {
        const nome = inputEl?.value.trim();
        if (!nome) { mostrarToast('Digite o nome do produto.', 'aviso'); return; }
        if (lfItens.find(it => it.n.toLowerCase() === nome.toLowerCase())) {
            mostrarToast('Produto já está na lista.', 'aviso'); return;
        }
        const fone = _normalizarFone(foneEl?.value || '');
        // FIX BUG 6: Date.now() pode colidir se dois itens forem adicionados
        // no mesmo milissegundo (duplo-clique rápido). Usa Date.now() + offset
        // aleatório para garantir unicidade dentro da sessão.
        const novoId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
        lfItens.push({ id: novoId, n: nome, q: 1, p: 0, fone });
        salvarLF(); renderLFLista(); atualizarGauge();
        fechar(); mostrarToast('Item adicionado!', 'sucesso');
    }

    btnOk?.addEventListener('click',    () => { darFeedback(); confirmar(); });
    btnCan?.addEventListener('click',   () => { darFeedback(); fechar(); });
    btnClose?.addEventListener('click', () => { darFeedback(); fechar(); });
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
    inputEl?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); foneEl?.focus(); } });
    foneEl?.addEventListener('keydown',  e => { if (e.key === 'Enter') confirmar(); });
}

function abrirAddModal() {
    const modal = document.getElementById('lf-addModal');
    if (!modal) return;
    modal.style.display = 'flex';
    abrirComFoco(modal);
}

// ── Modal de editar telefone do item ──────────────────────────────
function configurarEditItemModal() {
    const modal    = document.getElementById('lf-editItemModal');
    if (!modal) return;
    const btnOk    = document.getElementById('lf-confirmEditItem');
    const btnCan   = document.getElementById('lf-cancelEditItem');
    const btnClose = document.getElementById('lf-closeEditItem');
    const foneEl   = document.getElementById('lf-editFoneInput');

    function fechar() { fecharComFoco(modal); modal.style.display = 'none'; _editItemId = null; }
    function confirmar() {
        if (_editItemId === null) return;
        const it = lfItens.find(i => i.id === _editItemId);
        if (!it) return;
        it.fone = _normalizarFone(foneEl?.value || '');
        salvarLF(); renderLFLista();
        fechar();
        mostrarToast(it.fone ? 'Fornecedor salvo!' : 'Telefone removido.', 'sucesso');
    }

    btnOk?.addEventListener('click',    () => { darFeedback(); confirmar(); });
    btnCan?.addEventListener('click',   () => { darFeedback(); fechar(); });
    btnClose?.addEventListener('click', () => { darFeedback(); fechar(); });
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });
    foneEl?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); });
}

function abrirEditItemModal(lid) {
    const modal = document.getElementById('lf-editItemModal');
    if (!modal) return;
    const it = lfItens.find(i => i.id === lid);
    if (!it) return;
    _editItemId = lid;
    const titleEl = document.getElementById('lf-editItemTitle');
    if (titleEl) titleEl.textContent = `Fornecedor — ${it.n}`;
    const foneEl = document.getElementById('lf-editFoneInput');
    if (foneEl) foneEl.value = it.fone || '';
    modal.style.display = 'flex';
    abrirComFoco(modal);
}

// ══════════════════════════════════════════════════════════════════

/**
 * Formata os itens em um pedido de compra textual.
 * @param {string} pizzaria  Nome do estabelecimento
 * @param {Array}  itens     Subconjunto de lfItens a incluir
 * @returns {string}
 */
function _formatarPedido(pizzaria, itens) {
    const data  = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const nome  = pizzaria.trim() || 'Pizzaria';
    const total = itens.reduce((s, it) => s + (Number(it.q) || 0) * (Number(it.p) || 0), 0);

    const linhas = itens.map(it => {
        const q = Number(it.q) || 0;
        const p = Number(it.p) || 0;
        const sub = q * p;
        const subStr = sub > 0 ? ` = ${fmtMoeda(sub)}` : '';
        return `- ${it.n} × ${fmtQtd(q)}${subStr}`;
    });

    let texto = `*Pedido de Compra*\n`;
    texto    += `${nome}\n`;
    texto    += `${data}\n`;
    texto    += `-----------------\n`;
    texto    += linhas.join('\n');
    texto    += `\n-----------------\n`;
    if (total > 0) texto += `Total: ${fmtMoeda(total)}\n`;
    texto    += `\nStockFlow Pro`;
    return texto;
}

/**
 * Constrói a URL do WhatsApp com o texto do pedido.
 * @param {string} texto  Texto já formatado
 * @param {string} fone   Número normalizado (apenas dígitos) ou ''
 * @returns {string}  URL whatsapp:// ou https://wa.me/
 */
function _urlWhatsApp(texto, fone) {
    const encoded = encodeURIComponent(texto);
    // Tenta primeiro whatsapp:// (abre o app nativo diretamente)
    // Fallback no JS: se falhar, usa https://wa.me/ (funciona em qualquer browser)
    if (fone) {
        // Remove qualquer não-dígito e garante código de país
        const num = fone.replace(/\D/g, '');
        return `https://wa.me/${num}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
}

/**
 * Agrupa os itens da lista por número de fornecedor.
 * Itens sem fone ficam no grupo '' (sem fornecedor).
 * @returns {Map<string, Array>}  fone → itens[]
 */
function _agruparPorFornecedor() {
    const grupos = new Map();
    for (const it of lfItens) {
        const fone = _normalizarFone(it.fone || '');
        if (!grupos.has(fone)) grupos.set(fone, []);
        grupos.get(fone).push(it);
    }
    return grupos;
}

/**
 * Configura o modal de pedido: listeners de fechar e input de pizzaria.
 */
function configurarPedidoModal() {
    const modal    = document.getElementById('lf-pedidoModal');
    if (!modal) return;
    const btnClose = document.getElementById('lf-closePedido');
    const inputPiz = document.getElementById('lf-pedidoPizzaria');

    function fechar() { fecharComFoco(modal); modal.style.display = 'none'; }

    btnClose?.addEventListener('click', () => { darFeedback(); fechar(); });
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    // Atualiza preview em tempo real ao digitar o nome da pizzaria
    inputPiz?.addEventListener('input', () => _atualizarPreviewPedido());
}

/**
 * Abre o modal de pedido e renderiza preview + botões de envio.
 */
function abrirModalPedido() {
    // v9.8.9 fix: remove guard silencioso — modal abre sempre.
    // Se a lista estiver vazia, o preview mostra aviso claro dentro do modal.
    const modal    = document.getElementById('lf-pedidoModal');
    const inputPiz = document.getElementById('lf-pedidoPizzaria');
    if (!modal) return;

    // Restaura o nome salvo
    const cfg = _loadConfig();
    if (inputPiz) inputPiz.value = cfg.pizzaria || '';

    _atualizarPreviewPedido();
    modal.style.display = 'flex';
    abrirComFoco(modal);
}

/**
 * Atualiza o preview e os botões de envio com base no nome atual da pizzaria.
 */
function _atualizarPreviewPedido() {
    const inputPiz  = document.getElementById('lf-pedidoPizzaria');
    const previewEl = document.getElementById('lf-pedidoPreview');
    const botoesEl  = document.getElementById('lf-pedidoBotoes');
    if (!previewEl || !botoesEl) return;

    const pizzaria = inputPiz?.value || '';

    // Persiste o nome
    const cfg = _loadConfig();
    cfg.pizzaria = pizzaria;
    _saveConfig(cfg);

    // Lista vazia: mostra aviso claro no preview, sem botão de envio
    if (lfItens.length === 0) {
        previewEl.textContent = 'Nenhum item na lista. Adicione produtos antes de enviar o pedido.';
        botoesEl.innerHTML = '';
        return;
    }

    // Agrupa por fornecedor
    const grupos = _agruparPorFornecedor();

    // Preview mostra o pedido completo (todos os itens)
    const textoCompleto = _formatarPedido(pizzaria, lfItens);
    previewEl.textContent = textoCompleto;

    // Monta os botões de envio
    botoesEl.innerHTML = '';

    if (grupos.size === 1 && grupos.has('')) {
        // Nenhum item tem telefone — copiar + abrir WA sem número
        botoesEl.appendChild(_criarBotaoCopiar(textoCompleto));
        botoesEl.appendChild(_criarBotaoEnviar('Abrir WhatsApp', '', textoCompleto));
    } else {
        // Tem fornecedores com telefone
        let temSemFone = false;
        for (const [fone, itens] of grupos) {
            if (!fone) { temSemFone = true; continue; }
            const texto  = _formatarPedido(pizzaria, itens);
            const label  = `Enviar para ${_formatarFoneDisplay(fone)}`;
            botoesEl.appendChild(_criarBotaoEnviar(label, fone, texto));
        }
        if (temSemFone) {
            const itensSemFone = grupos.get('');
            const texto        = _formatarPedido(pizzaria, itensSemFone);
            botoesEl.appendChild(_criarBotaoCopiar(textoCompleto));
            botoesEl.appendChild(_criarBotaoEnviar('Enviar (sem número)', '', texto));
        }
    }
}

/** Cria um botão de envio via WhatsApp. */
function _criarBotaoEnviar(label, fone, texto) {
    const btn = document.createElement('button');
    btn.className = 'lf-pedido-send-btn';
    btn.type      = 'button';
    btn.setAttribute('aria-label', fone ? `Enviar pedido via WhatsApp para ${fone}` : 'Enviar pedido via WhatsApp');
    btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>${esc(label)}`;
    btn.addEventListener('click', () => {
        darFeedback();
        const url = _urlWhatsApp(texto, fone);
        // Tenta abrir diretamente; fallback para window.open em desktop
        try {
            window.location.href = url;
        } catch {
            window.open(url, '_blank');
        }
        setTimeout(() => {
            mostrarToast('Pedido gerado! Abrindo WhatsApp...', 'sucesso');
            document.getElementById('lf-pedidoModal').style.display = 'none';
        }, 350);
    });
    return btn;
}

/** Cria um botão de copiar o texto do pedido para a área de transferência. */
function _criarBotaoCopiar(texto) {
    const btn = document.createElement('button');
    btn.className = 'lf-pedido-copy-btn';
    btn.type      = 'button';
    btn.setAttribute('aria-label', 'Copiar texto do pedido para área de transferência');
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copiar texto do pedido`;
    btn.addEventListener('click', () => {
        darFeedback();
        copiarParaClipboard(texto);
        mostrarToast('Pedido copiado!', 'sucesso');
    });
    return btn;
}

// ── Helpers de telefone ───────────────────────────────────────────

/** Remove formatação e garante apenas dígitos. Mantém vazio se inválido. */
function _normalizarFone(raw) {
    let digits = String(raw).replace(/\D/g, '');
    // Normaliza DDI duplicado: "0055..." → "55...", depois verificado como 13 dígitos.
    // Sem essa normalização, "0055 11 99999-9999" vira 15 dígitos e não é formatado.
    if (digits.startsWith('0055')) digits = digits.slice(2);
    // Mínimo de 10 dígitos (DDD + número) para ser considerado válido
    return digits.length >= 10 ? digits : '';
}

/** Formata o número para exibição amigável (ex: +55 11 99999-9999). */
function _formatarFoneDisplay(digits) {
    if (!digits) return '';
    if (digits.length === 13) {
        // +55 + DDD(2) + 9(1) + número(8)
        return `+${digits.slice(0,2)} ${digits.slice(2,4)} ${digits.slice(4,9)}-${digits.slice(9)}`;
    }
    if (digits.length === 11) {
        // DDD(2) + 9(1) + número(8)
        return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    }
    return digits;
}

// ── Calculadora LF ────────────────────────────────────────────────
function configurarCalcLF() {
    const modal = document.getElementById('lf-calcModal');
    if (!modal) return;

    function fecharCalc() { fecharComFoco(modal); modal.style.display = 'none'; lfCalcInput = null; lfCalcExpr = ''; }
    document.getElementById('lf-closeCalc')?.addEventListener('click', () => { darFeedback(); fecharCalc(); });
    modal.addEventListener('click', e => { if (e.target === modal) fecharCalc(); });

    document.querySelectorAll('[data-lf-calc]').forEach(btn => {
        btn.addEventListener('click', () => {
            darFeedback();
            const v = btn.dataset.lfCalc;
            if      (v === 'OK')   { salvarCalcLF(); }
            else if (v === 'C')    { lfCalcExpr = ''; atualizarDisplayCalcLF(); }
            else if (v === 'BACK') { lfCalcExpr = lfCalcExpr.slice(0, -1); atualizarDisplayCalcLF(); }
            else {
                if (v === ',') {
                    const parts = lfCalcExpr.split(/[+\-*/]/);
                    if (parts[parts.length - 1].includes('.')) return;
                }
                lfCalcExpr += (v === ',') ? '.' : v;
                atualizarDisplayCalcLF();
            }
        });
    });
}

function abrirCalcLF(input, nome) {
    lfCalcInput = input;
    lfCalcExpr  = '';
    const title = document.getElementById('lf-calc-title');
    if (title) title.textContent = 'Calc: ' + nome;
    atualizarDisplayCalcLF();
    const modal = document.getElementById('lf-calcModal');
    modal.style.display = 'flex';
    abrirComFoco(modal);
}

function atualizarDisplayCalcLF() {
    const el = document.getElementById('lf-calc-display');
    if (el) el.textContent = lfCalcExpr.replace(/\./g, ',') || '0';
}

function salvarCalcLF() {
    if (!lfCalcInput) return;
    const display = document.getElementById('lf-calc-display');
    const exprToEval = lfCalcExpr.trim() || '0';
    try {
        let val = avaliarExpr(exprToEval);
        if (!isFinite(val) || isNaN(val)) throw new Error('inválido');
        val = Math.round(val * 100) / 100;

        lfCalcInput.value = fmtMoeda(val);

        if (lfCalcInput.classList.contains('lf-input-preco')) {
            const tbody = document.getElementById('lf-tableBody');
            const lid   = parseInt(lfCalcInput.dataset.lid);
            const it    = !isNaN(lid) ? lfItens.find(i => i.id === lid) : null;
            if (it) {
                it.p = val;
                const totalEl = tbody?.querySelector(`.lf-item-total[data-lid="${lid}"]`);
                if (totalEl) totalEl.textContent = fmtMoeda((Number(it.q) || 0) * val);
                if (val > 0) registrarPrecoHistorico(it.n, val);
            }
            salvarLF(); atualizarGauge();
        }

        document.getElementById('lf-calcModal').style.display = 'none';
        lfCalcInput = null; lfCalcExpr = '';
        mostrarToast('Preço salvo', 'sucesso');
    } catch (e) {
        if (display) { display.textContent = 'Erro'; setTimeout(atualizarDisplayCalcLF, 1000); }
    }
}

// ── Orçamento / Gauge ─────────────────────────────────────────────
function configurarBudgetInput() {
    const inlineInput = document.getElementById('lf-budgetInlineInput');
    if (!inlineInput) return;
    inlineInput.value = fmtMoeda(lfOrcamento);
    inlineInput.addEventListener('focus', () => {
        inlineInput.value = lfOrcamento.toFixed(2).replace('.', ','); inlineInput.select();
    });
    inlineInput.addEventListener('blur', () => {
        const val = parseMoeda(inlineInput.value) || 3200;
        lfOrcamento = val; salvarOrcamentoLF(val);
        inlineInput.value = fmtMoeda(val); atualizarGauge(); agendarSnapshot();
    });
    const legacyInput = document.getElementById('lf-budgetInput');
    if (legacyInput) {
        legacyInput.value = fmtMoeda(lfOrcamento);
        legacyInput.addEventListener('change', () => {
            lfOrcamento = parseMoeda(legacyInput.value) || 3200;
            salvarOrcamentoLF(lfOrcamento);
            if (inlineInput) inlineInput.value = fmtMoeda(lfOrcamento);
            atualizarGauge();
        });
    }
}

function atualizarGauge() {
    const gasto = calcTotalGasto();
    const saldo = lfOrcamento - gasto;
    const pct   = lfOrcamento > 0 ? Math.min(1, gasto / lfOrcamento) : 0;
    renderGaugeRing(pct);

    const s = Math.abs(saldo) < 0.005 ? 0 : saldo;
    const gastoEl = document.getElementById('lf-gaugeGasto');
    const saldoEl = document.getElementById('lf-gaugeSaldo');
    if (gastoEl) gastoEl.textContent = fmtMoeda(gasto);
    if (saldoEl) {
        saldoEl.textContent = (s < 0 ? '-' : '') + fmtMoeda(Math.abs(s));
        saldoEl.className   = 'lf-gauge-num-value ' + (s >= 0 ? 'saldo-ok' : 'saldo-ruim');
    }
    const fBudget = document.getElementById('lf-footerBudget');
    const fGasto  = document.getElementById('lf-footerGasto');
    const fSaldo  = document.getElementById('lf-footerSaldo');
    if (fBudget) fBudget.textContent = fmtMoeda(lfOrcamento);
    if (fGasto)  fGasto.textContent  = fmtMoeda(gasto);
    if (fSaldo) {
        fSaldo.textContent = (s < 0 ? '-' : '') + fmtMoeda(Math.abs(s));
        fSaldo.className   = 'lf-footer-number ' + (s >= 0 ? 'saldo-ok' : 'saldo-bad');
    }
    const lgGasto = document.getElementById('lf-totalGastoDisplay');
    const lgDif   = document.getElementById('lf-diferencaDisplay');
    if (lgGasto) lgGasto.textContent = fmtMoeda(gasto);
    if (lgDif)   lgDif.textContent   = (s < 0 ? '-' : '') + fmtMoeda(Math.abs(s));
}

function calcTotalGasto() {
    return lfItens.reduce((s,it) => s + ((Number(it.q)||0)*(Number(it.p)||0)), 0);
}

function renderGaugeRing(pct) {
    const el = document.getElementById('lf-gaugeRing');
    if (!el) return;
    const r = 54, cx = 64, cy = 64;
    const circ = 2 * Math.PI * r;
    const dash  = Math.max(0, Math.min(pct, 1)) * circ;
    const cor = pct < 0.75 ? 'var(--btn-green, #30D158)'
              : pct < 0.90 ? '#FF9F0A'
              : '#FF453A';
    el.innerHTML = `<svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
              stroke="var(--surface-3)" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${cor}" stroke-width="10"
              stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
              stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
            fill="var(--text)" font-size="18" font-weight="700"
            font-family="-apple-system,sans-serif">${Math.round(pct * 100)}%</text></svg>`;
}

// ── Tabs internas ─────────────────────────────────────────────────
function configurarTabsLF() {
    const btns  = document.querySelectorAll('.lf-tab-btn');
    const conts = document.querySelectorAll('.lf-tab-content');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            darFeedback();
            btns.forEach(b => b.classList.remove('active'));
            conts.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabEl = document.getElementById('lf-tab-' + btn.dataset.lfTab);
            if (tabEl) tabEl.classList.add('active');
        });
    });
}

// ── Comparador ────────────────────────────────────────────────────
const UNIT_FACTOR={kg:1,g:0.001,l:1,ml:0.001,un:1,uni:1,pct:1,cx:1,bld:1,crt:1,frd:1,rl:1};

function configurarComparador() {
    ['lf-comp_p1','lf-comp_p2'].forEach((id,i) => {
        const el=document.getElementById(id);
        if (!el) return;
        const label=`Produto ${i+1}`;
        el.addEventListener('click', () => { darFeedback(); abrirCalcLF(el, label); });
    });
    document.getElementById('lf-btnComparar')?.addEventListener('click', () => {
        darFeedback(); compararProdutos();
    });
}

function compararProdutos() {
    const p1=parseMoeda(document.getElementById('lf-comp_p1')?.value||'0');
    const q1=parseFloat((document.getElementById('lf-comp_q1')?.value||'0').replace(',','.'))||0;
    const u1=document.getElementById('lf-comp_u1')?.value||'kg';
    const p2=parseMoeda(document.getElementById('lf-comp_p2')?.value||'0');
    const q2=parseFloat((document.getElementById('lf-comp_q2')?.value||'0').replace(',','.'))||0;
    const u2=document.getElementById('lf-comp_u2')?.value||'kg';
    const el=document.getElementById('lf-comparadorResultado');
    if (!el) return;
    if (!p1||!q1||!p2||!q2) {
        el.style.display='block';
        el.innerHTML='<p style="text-align:center;opacity:.5;padding:12px;">Preencha todos os campos.</p>';
        return;
    }
    // Normaliza para unidade base usando UNIT_FACTOR
    const ppu1 = p1 / (q1 * (UNIT_FACTOR[u1] || 1));
    const ppu2 = p2 / (q2 * (UNIT_FACTOR[u2] || 1));
    // Label da unidade base coerente com ambos os produtos
    const isPeso   = (u1==='kg'||u1==='g') || (u2==='kg'||u2==='g');
    const isVolume = (u1==='l'||u1==='ml') || (u2==='l'||u2==='ml');
    const uLabel   = isPeso ? 'kg' : isVolume ? 'L' : 'un';
    const melhor   = ppu1 <= ppu2 ? 1 : 2;
    const pct = (Math.max(ppu1,ppu2) > 0)
        ? (Math.abs(ppu1-ppu2) / Math.max(ppu1,ppu2) * 100).toFixed(1)
        : '0.0';
    el.style.display='block';
    el.innerHTML=`
        <div class="lf-comp-resultado">
            <div class="lf-comp-linha"><span>Produto 1:</span>
                <strong class="${melhor===1?'comp-winner':''}">${fmtMoeda(ppu1)} / ${uLabel}</strong></div>
            <div class="lf-comp-linha"><span>Produto 2:</span>
                <strong class="${melhor===2?'comp-winner':''}">${fmtMoeda(ppu2)} / ${uLabel}</strong></div>
            <div class="lf-comp-vencedor">Produto ${melhor} é ${pct}% mais barato por ${uLabel}</div>
        </div>`;
}

// ── Compartilhar ──────────────────────────────────────────────────
function compartilharListaLF() {
    darFeedback();
    if (lfItens.length===0) { mostrarToast('Lista vazia.', 'aviso'); return; }
    const total=calcTotalGasto();
    const linhas=lfItens.map(it=>`• ${it.n} × ${fmtQtd(it.q)} = ${fmtMoeda((Number(it.q)||0)*(Number(it.p)||0))}`);
    const texto=`LISTA DE COMPRAS\n\n${linhas.join('\n')}\n\nTOTAL: ${fmtMoeda(total)}\nORÇAMENTO: ${fmtMoeda(lfOrcamento)}`;
    if (navigator.share) navigator.share({text:texto}).catch(()=>copiarParaClipboard(texto));
    else copiarParaClipboard(texto);
}

// ── Helpers ───────────────────────────────────────────────────────
function salvarLF() { salvarItensLF(lfItens); agendarSnapshot(); }

function fmtMoeda(val) {
    const n=typeof val==='number'?val:parseFloat(val)||0;
    const abs=Math.abs(n)<0.005?0:Math.abs(n);
    return 'R$ '+abs.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}
function parseMoeda(str) {
    // BUG FIX: /R\$/ em regex — \$ é âncora de fim-de-string, NÃO o caractere $.
    // Usar replace de string literal para remover o prefixo "R$ " de forma confiável.
    const s = String(str)
        .replace('R$ ', '')   // remove "R$ " (com espaço)
        .replace('R$', '')    // remove "R$" (sem espaço, fallback)
        .replace(/\./g, '')   // remove separadores de milhar
        .replace(',', '.');   // vírgula decimal → ponto
    return parseFloat(s) || 0;
}
function fmtQtd(val) {
    const n=Number(val)||0; return n%1===0?String(n):n.toFixed(2).replace('.',',');
}
