// ft-gastos.js — StockFlow Pro · Ficha Técnica v1.0
// ══════════════════════════════════════════════════════════════════
// Módulo de Custos Fixos e Variáveis da operação.
//
// FUNCIONALIDADES:
//   • CRUD completo de gastos (nome, valor, categoria, tipo, recorrência).
//   • Tipos: Fixo (aluguel, luz, água…) e Variável (embalagens, gás…).
//   • Categorias: Instalações, Utilities, Pessoal, Impostos, Outros.
//   • Resumo financeiro: total fixo, total variável, total mensal.
//   • Rateio por receita: quanto cada pizza deve cobrir dos custos fixos.
//   • Storage via ft-storage.js (localStorage + Firebase sync).
//   • Segurança: todos os dados do usuário passam por esc() — zero XSS.
//   • Tutorial descartável (ft-ui.js renderTutorial).
// ══════════════════════════════════════════════════════════════════

import { salvar, carregar, remover }          from './ft-storage.js';
import { toast, abrirModal, fecharModal,
         confirmar, renderEmpty, renderTutorial,
         debounce, animateSection }           from './ft-ui.js';
import { ico }                               from './ft-icons.js';
import { formatCurrency, parseNum, generateId,
         n2input, esc, applyMaskCurrency }   from './ft-format.js';
import { getReceitasAtivas }                 from './ft-receitas.js';

// ─────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────

const COLECAO = 'gastos';

const CATEGORIAS = {
    instalacoes: { label: 'Instalações',  cor: '#0A84FF' },
    utilities:   { label: 'Utilidades',   cor: '#30D158' },
    pessoal:     { label: 'Pessoal',      cor: '#FF9F0A' },
    impostos:    { label: 'Impostos',     cor: '#FF453A' },
    outros:      { label: 'Outros',       cor: '#98989D' },
};

const EXEMPLOS_FIXO = ['Aluguel', 'Água', 'Luz / Energia', 'Telefone / Internet',
                       'Contador', 'Salário fixo', 'Pró-labore'];
const EXEMPLOS_VAR  = ['Embalagens', 'Gás GLP', 'Material de limpeza',
                       'Comissões', 'Taxa cartão', 'Manutenção'];

// ─────────────────────────────────────────────────────────────────
// ESTADO LOCAL
// ─────────────────────────────────────────────────────────────────

/** @type {Array<Object>} Lista em memória dos gastos carregados */
let _gastos = [];

/** Filtro ativo: 'todos' | 'fixo' | 'variavel' */
let _filtro = 'todos';

/** Termo de busca ativo */
let _busca = '';

const _salvarDebounced = debounce(_persistir, 600);

// ─────────────────────────────────────────────────────────────────
// PERSISTÊNCIA
// ─────────────────────────────────────────────────────────────────

async function _persistir() {
    // Salva cada gasto individualmente (padrão dos outros módulos ft-*)
    for (const g of _gastos) {
        try { await salvar(COLECAO, g.id, g); } catch(e) {
            console.warn('[ft-gastos] _persistir falhou para', g.id, e);
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────

export async function initGastos() {
    try {
        _gastos = await carregar(COLECAO);
    } catch(e) {
        console.warn('[ft-gastos] Erro ao carregar:', e);
        _gastos = [];
    }
}

// ─────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────

export function renderGastos() {
    const wrap = document.getElementById('ft-gastos');
    if (!wrap) return;

    // Tutorial descartável
    renderTutorial('ft-sec-gas', 'gas', ico.money, 'Custos Fixos e Variáveis', [
        'Cadastre todos os gastos mensais da sua operação.',
        'Fixos: valores constantes (aluguel, salários, luz).',
        'Variáveis: oscilam com o volume (embalagens, gás, comissões).',
        'O rateio mostra quanto cada pizza deve cobrir dos custos fixos.',
    ]);

    const fixos     = _gastos.filter(g => g.tipo === 'fixo');
    const variaveis = _gastos.filter(g => g.tipo === 'variavel');
    const totalFixo = fixos.reduce((s, g) => s + (g.valor || 0), 0);
    const totalVar  = variaveis.reduce((s, g) => s + (g.valor || 0), 0);
    const totalMes  = totalFixo + totalVar;

    wrap.innerHTML = `
        <!-- Resumo financeiro -->
        <div class="ft-gas-resumo">
            <div class="ft-gas-card ft-gas-card--fixo">
                <div class="ft-gas-card-lbl">Fixos / mês</div>
                <div class="ft-gas-card-val">${formatCurrency(totalFixo)}</div>
            </div>
            <div class="ft-gas-card ft-gas-card--var">
                <div class="ft-gas-card-lbl">Variáveis / mês</div>
                <div class="ft-gas-card-val">${formatCurrency(totalVar)}</div>
            </div>
            <div class="ft-gas-card ft-gas-card--total">
                <div class="ft-gas-card-lbl">Total mensal</div>
                <div class="ft-gas-card-val">${formatCurrency(totalMes)}</div>
            </div>
        </div>

        <!-- Rateio por receita -->
        ${_renderRateio(totalFixo)}

        <!-- Filtro + busca -->
        <div class="ft-gas-toolbar">
            <div class="ft-gas-filtros" role="group" aria-label="Filtrar gastos">
                ${['todos','fixo','variavel'].map(f => `
                    <button class="ft-gas-filtro-btn${_filtro === f ? ' active' : ''}"
                            data-filtro="${f}" type="button">
                        ${f === 'todos' ? 'Todos' : f === 'fixo' ? 'Fixos' : 'Variáveis'}
                    </button>`).join('')}
            </div>
            <div class="ft-gas-busca-wrap">
                <input id="ft-gas-busca" class="ft-search" type="search"
                       placeholder="Buscar gasto…" value="${esc(_busca)}"
                       autocomplete="off" autocorrect="off">
            </div>
        </div>

        <!-- Lista -->
        <div id="ft-gas-lista"></div>
    `;

    _renderLista();
    _bindToolbar();
}

// ─────────────────────────────────────────────────────────────────
// RATEIO
// ─────────────────────────────────────────────────────────────────

function _renderRateio(totalFixo) {
    if (totalFixo <= 0) return '';

    let receitasHtml = `
        <div class="ft-gas-rateio-row">
            <span class="ft-gas-rateio-hint">
                ${ico.info} Cadastre receitas no módulo <strong>Receitas</strong> para ver o rateio por pizza.
            </span>
        </div>`;

    try {
        const ativas = getReceitasAtivas();
        if (ativas.length) {
            receitasHtml = ativas.map(r => {
                const rateioPorPizza = totalFixo / ativas.length;
                return `
                <div class="ft-gas-rateio-row">
                    <span class="ft-gas-rateio-nome">${esc(r.nome)} <span class="ft-tam-pill">${esc(r.tamanho || '')}</span></span>
                    <span class="ft-gas-rateio-val">${formatCurrency(rateioPorPizza)}</span>
                </div>`;
            }).join('');
        }
    } catch(_) {}

    return `
        <details class="ft-gas-rateio" id="ft-gas-rateio-details">
            <summary class="ft-gas-rateio-summary">
                ${ico.slice}
                <span>Rateio dos custos fixos por pizza</span>
                <span class="ft-gas-rateio-total">${formatCurrency(totalFixo)} / mês</span>
            </summary>
            <div class="ft-gas-rateio-body">
                <p class="ft-gas-rateio-desc">
                    Informe quantas unidades você vende por mês para calcular o rateio exato e a meta diária.
                </p>
                <div class="ft-gas-rateio-input-row">
                    <label for="ft-gas-qtd-pizzas">Pizzas / mês</label>
                    <input id="ft-gas-qtd-pizzas" class="ft-input ft-input-sm" type="number"
                           min="1" step="1" placeholder="Ex: 200"
                           value="${esc(String(localStorage.getItem('ft_gas_qtd_pizzas') || ''))}"
                           inputmode="numeric">
                    <label for="ft-gas-dias-mes" style="margin-left:8px">Dias / mês</label>
                    <input id="ft-gas-dias-mes" class="ft-input ft-input-sm" type="number"
                           min="1" max="31" step="1" placeholder="26"
                           value="${esc(String(localStorage.getItem('ft_gas_dias_mes') || '26'))}"
                           inputmode="numeric" style="width:64px">
                </div>
                <div id="ft-gas-rateio-result"></div>
            </div>
        </details>`;
}

// ─────────────────────────────────────────────────────────────────
// LISTA
// ─────────────────────────────────────────────────────────────────

function _gastosFiltrados() {
    return _gastos.filter(g => {
        if (_filtro !== 'todos' && g.tipo !== _filtro) return false;
        if (_busca) {
            const q = _busca.toLowerCase();
            if (!g.nome?.toLowerCase().includes(q) &&
                !g.categoria?.toLowerCase().includes(q)) return false;
        }
        return true;
    });
}

function _renderLista() {
    const lista = document.getElementById('ft-gas-lista');
    if (!lista) return;

    const filtrados = _gastosFiltrados();

    if (!_gastos.length) {
        renderEmpty(lista, ico.money, 'Nenhum custo cadastrado',
            'Adicione aluguel, luz, água e outros gastos mensais.',
            { label: 'Adicionar gasto', fn: abrirFormGasto });
        return;
    }

    if (!filtrados.length) {
        lista.innerHTML = `
            <div class="ft-empty">
                <div class="ft-empty-ico">${ico.search}</div>
                <div class="ft-empty-title">Nenhum resultado</div>
                <p class="ft-empty-sub">Tente outro filtro ou termo de busca.</p>
            </div>`;
        return;
    }

    // Agrupa por tipo para exibição
    const grupos = [
        { tipo: 'fixo',     label: 'Fixos',     items: filtrados.filter(g => g.tipo === 'fixo') },
        { tipo: 'variavel', label: 'Variáveis',  items: filtrados.filter(g => g.tipo === 'variavel') },
    ].filter(g => g.items.length);

    lista.innerHTML = grupos.map(grupo => {
        const totalGrupo = grupo.items.reduce((s, g) => s + (g.valor || 0), 0);
        return `
        <div class="ft-gas-grupo">
            <div class="ft-gas-grupo-hd">
                <span class="ft-gas-grupo-label ft-gas-tipo-${grupo.tipo}">${grupo.label}</span>
                <span class="ft-gas-grupo-total">${formatCurrency(totalGrupo)}/mês</span>
            </div>
            ${grupo.items.map(g => _cardGasto(g)).join('')}
        </div>`;
    }).join('');

    // Bind dos botões de editar/excluir
    lista.querySelectorAll('.ft-gas-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const g = _gastos.find(x => x.id === btn.dataset.id);
            if (g) abrirFormGasto(g);
        });
    });
    lista.querySelectorAll('.ft-gas-btn-del').forEach(btn => {
        btn.addEventListener('click', () => _excluirGasto(btn.dataset.id));
    });

    // Bind do rateio dinâmico
    const qtdEl = document.getElementById('ft-gas-qtd-pizzas');
    const diasEl = document.getElementById('ft-gas-dias-mes');
    if (qtdEl) { qtdEl.addEventListener('input', _atualizarRateio); _atualizarRateio(); }
    if (diasEl)  diasEl.addEventListener('input', _atualizarRateio);
}

function _cardGasto(g) {
    const cat = CATEGORIAS[g.categoria] || CATEGORIAS.outros;
    const recLabel = g.recorrencia === 'anual'
        ? `${formatCurrency((g.valor || 0) / 12)}/mês (anual)`
        : 'por mês';

    return `
    <div class="ft-gas-item" data-id="${esc(g.id)}">
        <div class="ft-gas-item-cat-dot" style="background:${cat.cor}" aria-hidden="true"></div>
        <div class="ft-gas-item-info">
            <span class="ft-gas-item-nome">${esc(g.nome)}</span>
            <span class="ft-gas-item-meta">
                <span class="ft-gas-cat-pill">${esc(cat.label)}</span>
                <span class="ft-gas-rec-label">${recLabel}</span>
            </span>
        </div>
        <span class="ft-gas-item-valor">${formatCurrency(g.recorrencia === 'anual' ? (g.valor || 0) / 12 : (g.valor || 0))}</span>
        <div class="ft-gas-item-actions">
            <button class="ft-icon-btn ft-gas-btn-edit" data-id="${esc(g.id)}"
                    aria-label="Editar ${esc(g.nome)}" type="button">${ico.edit}</button>
            <button class="ft-icon-btn ft-gas-btn-del ft-icon-btn--danger" data-id="${esc(g.id)}"
                    aria-label="Excluir ${esc(g.nome)}" type="button">${ico.trash}</button>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// RATEIO DINÂMICO
// ─────────────────────────────────────────────────────────────────

function _atualizarRateio() {
    const qtdEl   = document.getElementById('ft-gas-qtd-pizzas');
    const diasEl  = document.getElementById('ft-gas-dias-mes');
    const resEl   = document.getElementById('ft-gas-rateio-result');
    if (!resEl) return;

    const qtd  = parseNum(qtdEl?.value);
    const dias = parseNum(diasEl?.value) || 26;

    const totalFixo = _gastos
        .filter(g => g.tipo === 'fixo')
        .reduce((s, g) => s + (g.recorrencia === 'anual' ? (g.valor || 0) / 12 : (g.valor || 0)), 0);

    if (!qtd || qtd <= 0) {
        resEl.innerHTML = `<p class="ft-gas-rateio-hint-inline">Informe a quantidade de pizzas para calcular.</p>`;
        return;
    }

    try { localStorage.setItem('ft_gas_qtd_pizzas', String(qtd)); } catch(_) {}
    try { localStorage.setItem('ft_gas_dias_mes', String(dias)); }  catch(_) {}

    const custoPorPizza  = totalFixo / qtd;
    const custoPorDia    = totalFixo / dias;

    // Média de preço de venda das receitas ativas
    let mediaPreco = 0;
    let metaDiaria = 0;
    try {
        const ativas = getReceitasAtivas ? getReceitasAtivas() : [];
        const comPreco = ativas.filter(r => (r.preco_venda || 0) > 0);
        if (comPreco.length) {
            mediaPreco = comPreco.reduce((s, r) => s + (r.preco_venda || 0), 0) / comPreco.length;
        }
        // Margem de contribuição = preço médio - custo variável médio
        const custoMedioVar = ativas.length ? ativas.reduce((s, r) => s + (r.custo_total || 0), 0) / ativas.length : 0;
        const mc = mediaPreco - custoMedioVar;
        metaDiaria = mc > 0 ? Math.ceil(totalFixo / mc / dias) : 0;
    } catch(_) {}

    const mediaPrecoHtml = mediaPreco > 0
        ? `<div class="gas-kpi"><span class="gas-kpi-val">${formatCurrency(mediaPreco)}</span><span class="gas-kpi-lbl">Preço médio das pizzas</span></div>`
        : '';
    const metaDiariaHtml = metaDiaria > 0
        ? `<div class="gas-kpi gas-kpi-hi"><span class="gas-kpi-val">${metaDiaria} un.</span><span class="gas-kpi-lbl">Meta diária (break-even)</span></div>`
        : '';

    resEl.innerHTML = `
        <div class="gas-kpis-grid">
            <div class="gas-kpi gas-kpi-acc">
                <span class="gas-kpi-val">${formatCurrency(custoPorPizza)}</span>
                <span class="gas-kpi-lbl">Custo fixo / pizza</span>
            </div>
            <div class="gas-kpi">
                <span class="gas-kpi-val">${formatCurrency(custoPorDia)}</span>
                <span class="gas-kpi-lbl">Custo fixo / dia</span>
            </div>
            ${mediaPrecoHtml}
            ${metaDiariaHtml}
        </div>
        <div class="gas-rateio-formula">
            ${formatCurrency(totalFixo)} ÷ ${qtd.toLocaleString('pt-BR')} pizzas
            = <strong>${formatCurrency(custoPorPizza)}/pizza</strong>
        </div>`;
}

// ─────────────────────────────────────────────────────────────────
// TOOLBAR (filtros + busca)
// ─────────────────────────────────────────────────────────────────

function _bindToolbar() {
    document.querySelectorAll('.ft-gas-filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _filtro = btn.dataset.filtro;
            document.querySelectorAll('.ft-gas-filtro-btn').forEach(b =>
                b.classList.toggle('active', b === btn));
            _renderLista();
        });
    });

    const buscaEl = document.getElementById('ft-gas-busca');
    if (buscaEl) {
        buscaEl.addEventListener('input', () => {
            _busca = buscaEl.value;
            _renderLista();
        });
    }
}

// ─────────────────────────────────────────────────────────────────
// FORMULÁRIO (criar / editar)
// ─────────────────────────────────────────────────────────────────

export async function abrirFormGasto(gasto = null) {
    const editando = !!gasto;
    const g = gasto || { id: generateId(), nome: '', valor: 0,
                         tipo: 'fixo', categoria: 'instalacoes',
                         recorrencia: 'mensal', obs: '' };

    const catOpts = Object.entries(CATEGORIAS).map(([k, v]) =>
        `<option value="${k}"${g.categoria === k ? ' selected' : ''}>${v.label}</option>`
    ).join('');

    const html = `
        <div class="ft-mhd">
            <span class="ft-mhd-title">${editando ? 'Editar gasto' : 'Novo gasto'}</span>
            <button class="ft-mhd-close" id="_gasClose" type="button" aria-label="Fechar">${ico.close}</button>
        </div>
        <div class="ft-mbody">

            <!-- Nome -->
            <div class="ft-field">
                <label for="_gasNome">Nome do gasto <span class="ft-req">*</span></label>
                <input id="_gasNome" class="ft-input" type="text"
                       placeholder="Ex: Aluguel, Luz, Embalagens…"
                       maxlength="80" autocomplete="off" autocorrect="off">
                <div class="ft-gas-sugestoes" id="_gasSug"></div>
            </div>

            <!-- Tipo -->
            <div class="ft-field-row">
                <div class="ft-field">
                    <label>Tipo <span class="ft-req">*</span></label>
                    <div class="ft-gas-tipo-toggle" role="group">
                        <button class="ft-gas-tipo-btn${g.tipo === 'fixo' ? ' active' : ''}"
                                data-tipo="fixo" type="button">Fixo</button>
                        <button class="ft-gas-tipo-btn${g.tipo === 'variavel' ? ' active' : ''}"
                                data-tipo="variavel" type="button">Variável</button>
                    </div>
                </div>
                <div class="ft-field">
                    <label for="_gasCat">Categoria</label>
                    <select id="_gasCat" class="ft-input ft-select">${catOpts}</select>
                </div>
            </div>

            <!-- Valor + Recorrência -->
            <div class="ft-field-row">
                <div class="ft-field">
                    <label for="_gasVal">Valor <span class="ft-req">*</span></label>
                    <div class="ft-input-pre-wrap">
                        <span class="ft-input-pre">R$</span>
                        <input id="_gasVal" class="ft-input has-pre" type="text"
                               inputmode="decimal" autocomplete="off"
                               placeholder="0,00">
                    </div>
                </div>
                <div class="ft-field">
                    <label for="_gasRec">Recorrência</label>
                    <select id="_gasRec" class="ft-input ft-select">
                        <option value="mensal"${g.recorrencia === 'mensal' ? ' selected' : ''}>Mensal</option>
                        <option value="anual"${g.recorrencia === 'anual' ? ' selected' : ''}>Anual (÷12)</option>
                    </select>
                </div>
            </div>
            <div class="ft-tip-banner" id="_gasRecTip" style="${g.recorrencia === 'anual' ? '' : 'display:none'}">
                ${ico.info}
                <span>O valor anual será dividido por 12 para o rateio mensal.</span>
            </div>

            <!-- Observação -->
            <div class="ft-field">
                <label for="_gasObs">Observação <span class="ft-field-opt">(opcional)</span></label>
                <input id="_gasObs" class="ft-input" type="text"
                       maxlength="120" autocomplete="off" autocorrect="off"
                       placeholder="Ex: Vence todo dia 10">
            </div>
        </div>
        <div class="ft-mft">
            <button class="ft-btn ft-btn-ghost" id="_gasCancel" type="button">Cancelar</button>
            <button class="ft-btn ft-btn-primary" id="_gasSalvar" type="button">
                <span class="ft-bico">${ico.save}</span>
                <span>${editando ? 'Salvar' : 'Adicionar'}</span>
            </button>
        </div>`;

    abrirModal(html);

    // Preenche via textContent/value — zero XSS
    const nomeEl = document.getElementById('_gasNome');
    const valEl  = document.getElementById('_gasVal');
    const obsEl  = document.getElementById('_gasObs');
    if (nomeEl) nomeEl.value = g.nome || '';
    if (valEl)  valEl.value  = g.valor ? n2input(g.valor, 2, 2) : '';
    if (obsEl)  obsEl.value  = g.obs   || '';

    // Máscara monetária
    if (valEl) applyMaskCurrency(valEl);

    // Sugestões de nome baseadas no tipo
    let _tipoAtual = g.tipo;
    function _atualizarSugestoes() {
        const sugEl = document.getElementById('_gasSug');
        if (!sugEl) return;
        const lista = _tipoAtual === 'fixo' ? EXEMPLOS_FIXO : EXEMPLOS_VAR;
        sugEl.innerHTML = lista.map(s =>
            `<button class="ft-gas-sug-pill" type="button">${esc(s)}</button>`
        ).join('');
        sugEl.querySelectorAll('.ft-gas-sug-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                if (nomeEl) nomeEl.value = pill.textContent;
            });
        });
    }
    _atualizarSugestoes();

    // Toggle tipo
    document.querySelectorAll('.ft-gas-tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _tipoAtual = btn.dataset.tipo;
            document.querySelectorAll('.ft-gas-tipo-btn').forEach(b =>
                b.classList.toggle('active', b === btn));
            _atualizarSugestoes();
        });
    });

    // Toggle tip recorrência anual
    document.getElementById('_gasRec')?.addEventListener('change', e => {
        const tip = document.getElementById('_gasRecTip');
        if (tip) tip.style.display = e.target.value === 'anual' ? '' : 'none';
    });

    // Fechar
    document.getElementById('_gasClose')?.addEventListener('click',  () => fecharModal(null), { once: true });
    document.getElementById('_gasCancel')?.addEventListener('click', () => fecharModal(null), { once: true });

    // Salvar
    document.getElementById('_gasSalvar')?.addEventListener('click', async () => {
        const nome = nomeEl?.value.trim();
        const val  = parseNum(valEl?.value);
        const cat  = document.getElementById('_gasCat')?.value   || 'outros';
        const rec  = document.getElementById('_gasRec')?.value   || 'mensal';
        const obs  = obsEl?.value.trim() || '';
        const tipo = _tipoAtual;

        if (!nome)       { toast('Informe o nome do gasto.', 'aviso');     return; }
        if (val <= 0)    { toast('Informe um valor maior que zero.', 'aviso'); return; }

        const item = { id: g.id, nome, valor: val, tipo, categoria: cat,
                       recorrencia: rec, obs, ts: Date.now() };

        // Atualiza memória
        const idx = _gastos.findIndex(x => x.id === g.id);
        if (idx >= 0) _gastos[idx] = item;
        else          _gastos.push(item);

        fecharModal(true);

        try {
            await salvar(COLECAO, item.id, item);
            toast(editando ? 'Gasto atualizado.' : 'Gasto adicionado.', 'sucesso');
        } catch(e) {
            toast('Erro ao salvar. Tente novamente.', 'erro');
            console.error('[ft-gastos] salvar:', e);
        }

        renderGastos();
    }, { once: true });
}

// ─────────────────────────────────────────────────────────────────
// EXCLUSÃO
// ─────────────────────────────────────────────────────────────────

async function _excluirGasto(id) {
    const g = _gastos.find(x => x.id === id);
    if (!g) return;

    const ok = await confirmar(
        `Excluir "${g.nome}"? Esta ação não pode ser desfeita.`,
        { labelOK: 'Excluir', perigo: true }
    );
    if (!ok) return;

    _gastos = _gastos.filter(x => x.id !== id);
    try {
        await remover(COLECAO, id);
        toast('Gasto excluído.', 'sucesso');
    } catch(e) {
        toast('Erro ao excluir.', 'erro');
        console.error('[ft-gastos] remover:', e);
    }
    renderGastos();
}

// ─────────────────────────────────────────────────────────────────
// API PÚBLICA — acesso externo ao total mensal (para o Simulador)
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna o total mensal de gastos fixos.
 * Usado por ft-custos.js para incluir no cálculo de overhead.
 */
export function getTotalFixoMensal() {
    return _gastos
        .filter(g => g.tipo === 'fixo')
        .reduce((s, g) => s + (g.recorrencia === 'anual' ? (g.valor || 0) / 12 : (g.valor || 0)), 0);
}

/**
 * Retorna o total mensal de todos os gastos (fixo + variável).
 */
export function getTotalMensal() {
    return _gastos.reduce((s, g) =>
        s + (g.recorrencia === 'anual' ? (g.valor || 0) / 12 : (g.valor || 0)), 0);
}
