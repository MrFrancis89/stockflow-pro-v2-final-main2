// alerta.js — StockFlow Pro v9.9.45
// ══════════════════════════════════════════════════════════════════
// v9.8.4 — Alertas com unidade de medida
// v9.9.0 — Badge no botao da aba Estoque (sem popups)
// v9.9.2 — Indicador visual nas linhas da tabela (opcao B)
// v9.9.4 — Auditoria: 2 bugs críticos corrigidos
// v9.9.5 — verificarAlertas() lê appStore.estoqueItens em vez do DOM
// v9.9.9 — Bottom sheet ao tocar no badge
// v9.9.10 — #15 Focus trap: modal-alerta e bottom sheet
// v9.9.14 — #23 title no ícone de alerta para screen readers
// ══════════════════════════════════════════════════════════════════

import { salvarDados } from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';
import { atualizarPainelCompras } from './compras.js';
import appStore from './store.js';
import { abrirComFoco, fecharComFoco } from './modal.js';

let itemAlertaAtual = null;

// ── Helpers de conversao de unidade ──────────────────────────────

function _familia(unit) {
    if (unit === 'g'  || unit === 'kg') return 'weight';
    if (unit === 'ml' || unit === 'L' || unit === 'l') return 'volume';
    return 'count';
}

function _toBase(value, unit) {
    switch (unit) {
        case 'kg': return value * 1000;
        case 'L':
        case 'l':  return value * 1000;
        default:   return value;
    }
}

function _setSelectValue(id, value) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const existe = [...sel.options].some(o => o.value === value);
    sel.value = existe ? value : 'uni';
}

function _unidadeDoItem(tr) {
    return tr?.querySelector('.select-tabela')?.value || 'uni';
}

// ── Bottom Sheet ──────────────────────────────────────────────────

/** Cache da última lista de alertas para popular o sheet sem re-calcular */
let _ultimosAlertas = [];

/**
 * Abre o bottom sheet com a lista de alertas atual.
 * Cada item é clicável — fecha o sheet e faz scroll até a linha.
 */
export function abrirAlertaSheet() {
    const sheet   = document.getElementById('alerta-sheet');
    const overlay = document.getElementById('alerta-sheet-overlay');
    const lista   = document.getElementById('alerta-sheet-list');
    if (!sheet || !lista) return;

    lista.innerHTML = '';

    if (_ultimosAlertas.length === 0) {
        const li = document.createElement('li');
        li.className = 'alerta-sheet-item alerta-sheet-vazio';
        li.textContent = 'Nenhum alerta no momento.';
        lista.appendChild(li);
    } else {
        _ultimosAlertas.forEach(alerta => {
            const li = document.createElement('li');
            li.className = `alerta-sheet-item alerta-sheet-item--${alerta.tipo}`;
            li.setAttribute('role', 'button');
            li.setAttribute('tabindex', '0');

            const labelTipo  = alerta.tipo === 'min' ? 'Abaixo do mínimo' : 'Acima do máximo';
            const iconeTipo  = alerta.tipo === 'min' ? '↓' : '↑';
            const qtdTexto   = alerta.qtd ? `${alerta.qtd} ${alerta.unit}` : '—';
            const limiteText = `${alerta.tipo === 'min' ? 'Mín' : 'Máx'}: ${alerta.limite} ${alerta.unit}`;

            li.innerHTML = `
                <span class="alerta-sheet-icone" aria-hidden="true">${iconeTipo}</span>
                <span class="alerta-sheet-info">
                    <span class="alerta-sheet-nome"></span>
                    <span class="alerta-sheet-detalhe"></span>
                </span>
                <span class="alerta-sheet-badge" aria-label="${labelTipo}"></span>
            `;
            // textContent — sem risco de XSS com nomes de produto
            li.querySelector('.alerta-sheet-nome').textContent    = alerta.nome;
            li.querySelector('.alerta-sheet-detalhe').textContent = `${qtdTexto} · ${limiteText}`;
            li.querySelector('.alerta-sheet-badge').textContent   = labelTipo;

            // Clique → fecha sheet e scroll até a linha
            const _navegar = () => {
                fecharAlertaSheet();
                // Aguarda animação de fechamento antes de rolar
                setTimeout(() => {
                    const trs = document.querySelectorAll(
                        '#lista-itens-container tr:not(.categoria-header-row)'
                    );
                    for (const tr of trs) {
                        const nomeEl = tr.querySelector('.nome-prod');
                        if (!nomeEl) continue;
                        const nome = nomeEl.textContent.replace(/\r\n|\n|\r/g, ' ').trim();
                        if (nome === alerta.nome) {
                            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Flash visual na linha para chamar atenção
                            tr.classList.add('alerta-sheet-flash');
                            setTimeout(() => tr.classList.remove('alerta-sheet-flash'), 1200);
                            break;
                        }
                    }
                }, 280);
            };
            li.addEventListener('click', _navegar);
            li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _navegar(); } });

            lista.appendChild(li);
        });
    }

    // Exibe sheet e overlay
    sheet.removeAttribute('hidden');
    sheet.setAttribute('aria-hidden', 'false');
    overlay?.removeAttribute('hidden');
    overlay?.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        sheet.classList.add('alerta-sheet--open');
        overlay?.classList.add('alerta-sheet-overlay--open');
    });

    // Focus trap: ativa após animação de entrada
    setTimeout(() => abrirComFoco(sheet), 320);
}

/**
 * Fecha o bottom sheet com animação.
 */
export function fecharAlertaSheet() {
    const sheet   = document.getElementById('alerta-sheet');
    const overlay = document.getElementById('alerta-sheet-overlay');
    if (sheet) fecharComFoco(sheet);
    sheet?.classList.remove('alerta-sheet--open');
    overlay?.classList.remove('alerta-sheet-overlay--open');
    setTimeout(() => {
        sheet?.setAttribute('hidden', '');
        sheet?.setAttribute('aria-hidden', 'true');
        overlay?.setAttribute('hidden', '');
        overlay?.setAttribute('aria-hidden', 'true');
    }, 300);
}

// ── Badge ─────────────────────────────────────────────────────────

/** Flag para registrar o listener do badge apenas uma vez */
let _badgeListenerRegistrado = false;

/**
 * Atualiza o badge de alertas no botao da aba Estoque.
 * Na primeira chamada, registra o listener de clique que abre o sheet.
 * @param {number} count  0 = oculta; >0 = exibe com o numero
 */
export function atualizarBadgeAlertas(count) {
    const badge = document.getElementById('badge-alertas');
    if (!badge) return;

    // Registra listeners uma única vez
    if (!_badgeListenerRegistrado) {
        _badgeListenerRegistrado = true;

        // Badge → abre sheet
        badge.style.cursor = 'pointer';
        badge.addEventListener('click', e => {
            e.stopPropagation(); // não propaga para o btn da aba
            abrirAlertaSheet();
        });

        // Fechar via botão X
        document.getElementById('btn-fechar-alerta-sheet')
            ?.addEventListener('click', fecharAlertaSheet);

        // Fechar via overlay
        document.getElementById('alerta-sheet-overlay')
            ?.addEventListener('click', fecharAlertaSheet);

        // Fechar via Escape
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const sheet = document.getElementById('alerta-sheet');
                if (sheet && !sheet.hasAttribute('hidden')) fecharAlertaSheet();
            }
        });
    }

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.removeAttribute('hidden');
        badge.setAttribute('aria-label',
            `${count} alerta${count > 1 ? 's' : ''} de estoque — toque para ver`);
    } else {
        badge.setAttribute('hidden', '');
        badge.setAttribute('aria-label', '');
    }
}

// ── Indicadores visuais nas linhas ────────────────────────────────

/**
 * Remove todos os indicadores de alerta das linhas da tabela.
 * Chamado antes de reaplicar para garantir estado limpo.
 */
function _limparIndicadoresLinhas() {
    document.querySelectorAll(
        '#lista-itens-container tr.tr-alerta-min, ' +
        '#lista-itens-container tr.tr-alerta-max'
    ).forEach(tr => {
        tr.classList.remove('tr-alerta-min', 'tr-alerta-max');
        // Remove bolinha do nome, se existir
        tr.querySelector('.alerta-row-icon')?.remove();
    });
}

/**
 * Aplica indicador visual (borda + bolinha) em um <tr> especifico.
 * @param {HTMLElement} tr    Linha da tabela
 * @param {'min'|'max'} tipo  Tipo de alerta
 */
function _marcarLinhaAlerta(tr, tipo) {
    tr.classList.add(`tr-alerta-${tipo}`);

    // Bolinha ao lado do nome (inserida apenas uma vez por linha)
    if (!tr.querySelector('.alerta-row-icon')) {
        const nomeProd = tr.querySelector('.nome-prod');
        if (nomeProd) {
            const dot = document.createElement('span');
            dot.className = `alerta-row-icon alerta-row-icon--${tipo}`;
            dot.setAttribute('aria-hidden', 'true');
            dot.title = tipo === 'min' ? 'Abaixo do mínimo' : 'Acima do máximo';
            nomeProd.after(dot);
        }
    }
}

// ── API publica ───────────────────────────────────────────────────

export function abrirModalAlerta(elemento) {
    const tr = (elemento.tagName === 'TR') ? elemento : elemento.closest('tr');
    if (!tr) return;

    itemAlertaAtual = tr;
    const unidItem = _unidadeDoItem(tr);
    const minVal   = tr.dataset.min     !== '' ? tr.dataset.min     : '';
    const maxVal   = tr.dataset.max     !== '' ? tr.dataset.max     : '';
    const minUnit  = tr.dataset.minUnit || unidItem;
    const maxUnit  = tr.dataset.maxUnit || unidItem;

    document.getElementById('alerta-min').value = minVal;
    document.getElementById('alerta-max').value = maxVal;
    _setSelectValue('alerta-min-unit', minUnit);
    _setSelectValue('alerta-max-unit', maxUnit);

    document.getElementById('modal-alerta').style.display = 'flex';
    abrirComFoco(document.getElementById('modal-alerta'));
}

export function fecharModalAlerta() {
    const el = document.getElementById('modal-alerta');
    fecharComFoco(el);
    el.style.display = 'none';
    itemAlertaAtual = null;
}

export function salvarAlerta() {
    if (!itemAlertaAtual) return;

    const minRaw  = document.getElementById('alerta-min').value.trim();
    const maxRaw  = document.getElementById('alerta-max').value.trim();
    const minUnit = document.getElementById('alerta-min-unit').value;
    const maxUnit = document.getElementById('alerta-max-unit').value;

    // Normaliza formato BR (1.500,75 → 1500.75) antes de parsear
    const _parseInput = raw => {
        if (raw === '') return null;
        const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
        return isNaN(n) ? null : n;
    };

    const min = _parseInput(minRaw);
    const max = _parseInput(maxRaw);

    // Validação: avisa se o campo foi preenchido mas não é um número válido
    if (minRaw !== '' && min === null) {
        document.getElementById('alerta-min')?.classList.add('input-erro');
        return;
    }
    if (maxRaw !== '' && max === null) {
        document.getElementById('alerta-max')?.classList.add('input-erro');
        return;
    }
    // Validação: mínimo não pode ser maior que máximo
    if (min !== null && max !== null && min > max) {
        document.getElementById('alerta-min')?.classList.add('input-erro');
        document.getElementById('alerta-max')?.classList.add('input-erro');
        return;
    }

    itemAlertaAtual.dataset.min     = (min !== null) ? min : '';
    itemAlertaAtual.dataset.max     = (max !== null) ? max : '';
    itemAlertaAtual.dataset.minUnit = minUnit;
    itemAlertaAtual.dataset.maxUnit = maxUnit;

    const dados = coletarDadosDaTabela();
    salvarDados(dados);
    verificarAlertas();
    fecharModalAlerta();
}

/**
 * Verifica todos os itens, aplica indicadores visuais nas linhas
 * e atualiza o badge. Nao exibe toasts nem popups.
 *
 * v9.9.5: lê dados de appStore.estoqueItens — sem reler o DOM.
 * O DOM é consultado apenas para localizar as <tr> a marcar visualmente.
 *
 * @returns {{ alertas: Array, count: number }}
 */
export function verificarAlertas() {
    // v9.9.5: fonte de verdade é o store, não o DOM
    const dados = appStore.get('estoqueItens') || [];
    const alertas = [];

    // Indexa TRs por nome — O(n)
    const trPorNome = new Map();
    document.querySelectorAll(
        '#lista-itens-container tr:not(.categoria-header-row)'
    ).forEach(tr => {
        const nomEl = tr.querySelector('.nome-prod');
        // BUG FIX A: mesma normalização de nome usada em coletarDadosDaTabela()
        // (.replace evita mismatch com nomes que contenham quebras de linha,
        //  possível em contenteditable no iOS ao colar texto)
        if (nomEl) trPorNome.set(nomEl.textContent.replace(/\r\n|\n|\r/g, ' ').trim(), tr);
    });

    // Limpa todos os indicadores antes de reaplicar
    _limparIndicadoresLinhas();

    // BUG FIX B: flag para disparar salvarDados()/atualizarPainelCompras()
    // uma única vez ao final, em vez de N vezes dentro do loop via alternarCheck().
    let marcouAlgum = false;

    dados.forEach(item => {
        if (!item?.n) return;

        const qtd      = parseFloat((item.q || '').replace(/\./g, '').replace(',', '.')) || 0;
        const itemUnit = item.u || 'uni';
        const qtdBase  = _toBase(qtd, itemUnit);
        const tr       = trPorNome.get(item.n);

        // ── Alerta de minimo ────────────────────────────────────
        if (item.min !== null && item.min !== undefined && item.min !== '') {
            const minVal  = Number(item.min);
            const minUnit = item.minUnit || itemUnit;

            if (_familia(itemUnit) === _familia(minUnit)) {
                if (qtdBase < _toBase(minVal, minUnit)) {
                    alertas.push({
                        nome: item.n, tipo: 'min',
                        qtd, limite: minVal, unit: itemUnit
                    });

                    if (tr) _marcarLinhaAlerta(tr, 'min');

                    // BUG FIX B: marca checkbox/classe diretamente, sem chamar
                    // alternarCheck() que dispararia darFeedback() (som+vibração),
                    // salvarDados() e atualizarPainelCompras() para cada item.
                    if (tr) {
                        const chk = tr.querySelector('input[type="checkbox"]');
                        if (chk && !chk.checked) {
                            chk.checked = true;
                            tr.classList.add('linha-marcada');
                            marcouAlgum = true;
                        }
                    }
                }
            }
        }

        // ── Alerta de maximo ────────────────────────────────────
        if (item.max !== null && item.max !== undefined && item.max !== '') {
            const maxVal  = Number(item.max);
            const maxUnit = item.maxUnit || itemUnit;

            if (_familia(itemUnit) === _familia(maxUnit)) {
                if (qtdBase > _toBase(maxVal, maxUnit)) {
                    alertas.push({
                        nome: item.n, tipo: 'max',
                        qtd, limite: maxVal, unit: itemUnit
                    });

                    if (tr) _marcarLinhaAlerta(tr, 'max');
                }
            }
        }
    });

    // BUG FIX B: um único save + atualização do painel, somente se necessário.
    if (marcouAlgum) {
        salvarDados(coletarDadosDaTabela());
        atualizarPainelCompras();
    }

    // Persiste alertas para o bottom sheet (sem re-calcular ao abrir)
    _ultimosAlertas = alertas;

    // Atualiza badge com total
    atualizarBadgeAlertas(alertas.length);

    return { alertas, count: alertas.length };
}

// ── Exports para testes unitários (#21) ──────────────────────────
// Estas funções são puras e não dependem de DOM.
// O prefixo de underscore indica uso interno; o export é exclusivo
// para os testes em tests/alerta.test.js.
export { _familia as __familiaTest, _toBase as __toBaseTest };
