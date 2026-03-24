// estoques.js — StockFlow Pro v9.9.42
// ══════════════════════════════════════════════════════════════════
// NOVO MÓDULO (v9.9.39) — Gestão de múltiplos estoques na UI.
// v9.9.41 — [BUG 3] _acao_criar: persiste estado antes de criar
//           [BUG 4] _recarregarUIEstoque: reconstrói Map de estoques
//
// Responsabilidades:
//   • Renderizar o seletor dropdown no topo da aba Estoque
//   • Criar, renomear e excluir estoques via modal de nome / confirm.js
//   • Reagir à troca de estoque ativo: re-renderiza tabela, compras
//     e alertas sem reload de página
//
// Integração:
//   • Escuta appStore.on('estoqueAtivoId') para mudanças programáticas
//   • Usa confirm.js para ações destrutivas
//   • Usa modal.js para focus trap no modal de nome
//
// HTML esperado (ver index-patch.html):
//   #multi-estoque-bar  — barra com select + 3 botões
//   #modal-estoque-nome — modal com input de texto
// ══════════════════════════════════════════════════════════════════

import {
    carregarEstoquesMeta,
    carregarItensEstoque,
    salvarItensEstoque,
    criarEstoque,
    renomearEstoque,
    excluirEstoque,
    salvarEstoqueAtivoId,
    carregarEstoqueAtivoId,
    salvarDados,
    carregarDados,
} from './storage.js';
import { coletarDadosDaTabela }             from './tabela.js';
import { mostrarConfirmacao }               from './confirm.js';
import { abrirComFoco, fecharComFoco }      from './modal.js';
import { renderizarListaCompleta }          from './ui.js';
import { atualizarPainelCompras }           from './compras.js';
import { verificarAlertas }                 from './alerta.js';
import { atualizarDropdown }               from './dropdown.js';
import { initSwipe }                        from './swipe.js';
import { mostrarToast }                     from './toast.js';
import appStore                             from './store.js';

// ── Estado interno ────────────────────────────────────────────────
/** Callback a executar quando o modal de nome for confirmado */
let _onNomeConfirmado = null;

// ── Helpers de UI ─────────────────────────────────────────────────

/**
 * Reconstrói as <option> do select de estoques.
 * Não re-dispara 'change' — apenas seta .value após reconstruir.
 */
function _renderizarSelect() {
    const sel = document.getElementById('multi-estoque-select');
    if (!sel) return;

    const ativo = appStore.get('estoqueAtivoId') || carregarEstoqueAtivoId();
    const meta  = carregarEstoquesMeta();

    sel.innerHTML = '';
    meta.forEach(({ id, nome }) => {
        const opt    = document.createElement('option');
        opt.value    = id;
        opt.selected = id === ativo;
        opt.textContent = nome;
        sel.appendChild(opt);
    });

    // Botão excluir: desabilitado quando há apenas 1 estoque
    const btnExcluir = document.getElementById('btn-estoque-excluir');
    if (btnExcluir) btnExcluir.disabled = meta.length <= 1;
}

/**
 * Abre o modal de nome para criar ou renomear um estoque.
 * @param {string}   titulo       Título exibido no cabeçalho do modal
 * @param {string}   valorInicial Valor pré-preenchido no input
 * @param {function} onConfirm    Callback(nome: string) chamado ao salvar
 */
function _abrirModalNome(titulo, valorInicial, onConfirm) {
    const modal = document.getElementById('modal-estoque-nome');
    const inp   = document.getElementById('modal-estoque-nome-input');
    const title = document.getElementById('modal-estoque-nome-title');
    if (!modal || !inp) return;

    if (title) title.textContent = titulo;
    inp.value         = valorInicial;
    _onNomeConfirmado = onConfirm;

    modal.style.display = 'flex';
    abrirComFoco(modal);
    requestAnimationFrame(() => inp.focus());
}

function _fecharModalNome() {
    const modal = document.getElementById('modal-estoque-nome');
    if (!modal) return;
    fecharComFoco(modal);
    modal.style.display = 'none';
    _onNomeConfirmado   = null;
}

function _confirmarNome() {
    const inp  = document.getElementById('modal-estoque-nome-input');
    const nome = inp?.value.trim();
    if (!nome) { mostrarToast('Digite um nome para o estoque.', 'aviso'); return; }
    if (typeof _onNomeConfirmado === 'function') _onNomeConfirmado(nome);
    _fecharModalNome();
}

// ── Troca de estoque ──────────────────────────────────────────────

/**
 * Persiste o estado atual da tabela, troca o estoque ativo e
 * re-renderiza toda a UI com os dados do novo estoque.
 * @param {string} novoId
 */
function _trocarEstoque(novoId) {
    // Captura o ID atual de AMBAS as fontes para comparação segura.
    // Após fbPullPrincipal, o localStorage pode ter ID diferente do store.
    // carregarEstoqueAtivoId() lê do localStorage e valida contra o meta —
    // é a fonte mais confiável, evita hardcoding da chave e normaliza o fallback.
    const idAtual = carregarEstoqueAtivoId() || appStore.get('estoqueAtivoId');

    if (!novoId || novoId === idAtual) return;

    // 1. Salva os dados exibidos atualmente no estoque que está sendo DEIXADO.
    //    Usa salvarItensEstoque(id, itens) que aceita o ID explicitamente —
    //    não depende de appStore.estoqueAtivoId que pode estar dessincronizado
    //    do localStorage após fbPullPrincipal.
    const dadosAtuais = coletarDadosDaTabela();
    if (idAtual) {
        salvarItensEstoque(idAtual, dadosAtuais);
    }

    // 2. Troca o ativo no localStorage + store
    salvarEstoqueAtivoId(novoId);

    // 3. Re-renderiza passando o ID explicitamente — evita qualquer
    //    dependência de appStore ou localStorage durante a transição
    _recarregarUIEstoque(novoId);
}

/**
 * Re-renderiza tabela, alertas e compras com o estoque ativo.
 *
 * @param {string} [idExplicito] — ID a usar. Quando fornecido, é fonte de
 *   verdade absoluta e evita a dependência de appStore.get() / localStorage
 *   que pode ter timing inconsistente logo após salvarEstoqueAtivoId().
 *   Quando omitido, usa carregarEstoqueAtivoId() (fallback para operações
 *   que não passam pelo fluxo de troca).
 */
function _recarregarUIEstoque(idExplicito) {
    // Resolve o ID ativo com a fonte mais confiável disponível
    const ativoId = idExplicito
        || appStore.get('estoqueAtivoId')
        || carregarEstoqueAtivoId();

    // Lê os itens diretamente do localStorage pelo ID explícito —
    // evita passar por carregarDados() que depende de appStore.estoqueAtivoId
    // e pode sofrer race condition no milissegundo após a troca
    const dados = carregarItensEstoque(ativoId) || [];

    // Reconstrói o Map completo de estoques com cópias reais dos objetos
    const meta = carregarEstoquesMeta();
    const estoques = new Map();
    meta.forEach(({ id, nome }) => {
        const itens = id === ativoId ? dados : carregarItensEstoque(id);
        estoques.set(id, { id, nome, itens });
    });
    appStore.set({ estoques, estoqueAtivoId: ativoId, estoqueItens: dados });

    renderizarListaCompleta(dados);
    atualizarDropdown();
    atualizarPainelCompras();
    verificarAlertas();
    initSwipe();
    _renderizarSelect();
}

// ── Operações CRUD ────────────────────────────────────────────────

function _acao_criar() {
    _abrirModalNome('Novo estoque', '', (nome) => {
        // FIX BUG 3: persiste o estado atual da tabela antes de criar o novo estoque.
        // Sem isso, itens editados mas não salvos explicitamente eram perdidos.
        salvarDados(coletarDadosDaTabela());

        const { id, nome: nomeSalvo } = criarEstoque(nome);
        salvarEstoqueAtivoId(id);
        _recarregarUIEstoque(id);   // ID explícito — evita race condition
        mostrarToast(`Estoque "${nomeSalvo}" criado!`, 'sucesso');
    });
}

function _acao_renomear() {
    const ativoId = appStore.get('estoqueAtivoId');
    const meta    = carregarEstoquesMeta();
    const atual   = meta.find(m => m.id === ativoId);
    if (!atual) return;

    _abrirModalNome('Renomear estoque', atual.nome, (novoNome) => {
        if (novoNome === atual.nome) return;
        renomearEstoque(ativoId, novoNome);
        _renderizarSelect();
        mostrarToast(`Renomeado para "${novoNome}".`, 'sucesso');
    });
}

function _acao_excluir() {
    const ativoId = appStore.get('estoqueAtivoId');
    const meta    = carregarEstoquesMeta();
    if (meta.length <= 1) {
        mostrarToast('Não é possível excluir o único estoque.', 'aviso');
        return;
    }
    const atual = meta.find(m => m.id === ativoId);
    if (!atual) return;

    mostrarConfirmacao(
        `Excluir o estoque "${atual.nome}" e todos os seus itens?\nEsta ação não pode ser desfeita.`,
        () => {
            // excluirEstoque() atualiza localStorage e o store de forma síncrona.
            // Lemos o novoAtivo de carregarEstoqueAtivoId() — fonte de verdade no
            // localStorage — em vez de appStore.get(), que poderia estar desatualizado
            // se excluirEstoque() ganhar algum caminho assíncrono no futuro.
            excluirEstoque(ativoId);
            const novoAtivo = carregarEstoqueAtivoId();
            _recarregarUIEstoque(novoAtivo);
            mostrarToast(`Estoque "${atual.nome}" excluído.`, 'info');
        }
    );
}

// ── Inicialização pública ─────────────────────────────────────────

/**
 * Registra todos os listeners da UI de múltiplos estoques.
 * Chamado uma única vez em main.js após inicializarEstoques().
 */
export function iniciarMultiEstoque() {
    _renderizarSelect();

    document.getElementById('multi-estoque-select')
        ?.addEventListener('change', e => _trocarEstoque(e.target.value));

    document.getElementById('btn-estoque-novo')
        ?.addEventListener('click', _acao_criar);

    document.getElementById('btn-estoque-renomear')
        ?.addEventListener('click', _acao_renomear);

    document.getElementById('btn-estoque-excluir')
        ?.addEventListener('click', _acao_excluir);

    // Modal de nome
    document.getElementById('modal-estoque-nome-ok')
        ?.addEventListener('click', _confirmarNome);

    document.getElementById('modal-estoque-nome-close')
        ?.addEventListener('click', _fecharModalNome);

    document.getElementById('modal-estoque-nome-input')
        ?.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); _confirmarNome(); }
            if (e.key === 'Escape') _fecharModalNome();
        });

    // Fecha ao clicar no overlay (fora da box)
    document.getElementById('modal-estoque-nome')
        ?.addEventListener('click', e => {
            if (e.target === e.currentTarget) _fecharModalNome();
        });

    // Reage a mudanças programáticas no store (ex.: excluirEstoque redireciona)
    appStore.on('estoqueAtivoId', () => _renderizarSelect());
}
