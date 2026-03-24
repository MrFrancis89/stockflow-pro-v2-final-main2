// ft-ingredientes.js — v3.2
// v3.2: _maskDecimal, _maskCurrency, _esc extraídos para ft-format.js (sem duplicação).
import { salvar, carregar, remover }          from './ft-storage.js';
import { calcCustoUnitario, calcVariacaoPreco } from './ft-calc.js';
import { formatCurrency, formatQtdUnid, formatDataCurta,
         generateId, parseNum, n2input, UNIDADE_LABEL,
         esc, applyMaskDecimal, applyMaskCurrency } from './ft-format.js';
import { toast, abrirModal, fecharModal, confirmar,
         renderEmpty, renderTutorial, animateSection } from './ft-ui.js';
import { ico }                                 from './ft-icons.js';

const COL = 'ingredientes';
let _ings = [];

export async function initIngredientes() { _ings = await carregar(COL); }
export function getIngredientes()        { return _ings; }
export function getIngredienteById(id)   { return _ings.find(i => i.id === id) || null; }

// ── Histórico de preços (localStorage, max 5 entradas) ─────────
function _getHist(id) {
    try { return JSON.parse(localStorage.getItem('ft_ph_' + id) || '[]'); } catch { return []; }
}
function _saveHist(id, hist) {
    try { localStorage.setItem('ft_ph_' + id, JSON.stringify(hist.slice(-5))); } catch {}
}
function _registrarPreco(id, preco) {
    const hist = _getHist(id);
    const ult  = hist[hist.length - 1];
    if (!ult || Math.abs(ult.preco - preco) > 0.001) {
        hist.push({ preco, data: Date.now() });
        _saveHist(id, hist);
    }
}

// ── Tutorial ──────────────────────────────────────────────────
function _tut() {
    renderTutorial('ft-sec-ing', 'ing', ico.ingredients, 'Cadastro de ingredientes', [
        'Toque em <strong>+</strong> para adicionar um ingrediente.',
        'Informe nome, unidade, quantidade da embalagem e preço de compra.',
        'O <strong>custo unitário</strong> é calculado automaticamente.',
        'O histórico de preços é salvo ao atualizar o preço de compra.',
    ]);
}

// ── Lista ─────────────────────────────────────────────────────
export function renderIngredientes(busca = '') {
    const wrap = document.getElementById('ft-lista-ing');
    if (!wrap) return;
    _tut();
    animateSection(wrap);
    const q     = busca.trim().toLowerCase();
    const lista = [..._ings]
        .filter(i => !q || i.nome.toLowerCase().includes(q))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!lista.length) {
        renderEmpty(wrap, ico.ingredients,
            q ? 'Nenhum resultado' : 'Nenhum ingrediente cadastrado',
            q ? 'Tente outro termo.' : 'Adicione seu primeiro ingrediente.',
            q ? null : { label: 'Novo ingrediente', fn: () => abrirFormIngrediente() }
        );
        return;
    }

    wrap.innerHTML = `
        <div class="ft-list-header section-enter">${lista.length} ingrediente${lista.length !== 1 ? 's' : ''}</div>
        <div class="ft-list section-enter">
            ${lista.map(i => {
                const hist  = _getHist(i.id);
                const trend = _trendBadge(i.preco_compra, hist);
                return `
                <button class="ft-list-item" data-id="${i.id}" type="button">
                    <span class="ft-item-ico ft-ico-ing">${ico.ingredients}</span>
                    <span class="ft-item-body">
                        <span class="ft-item-name">${esc(i.nome)}</span>
                        <span class="ft-item-sub">
                            ${esc(formatQtdUnid(i.quantidade_embalagem, i.unidade))} · ${formatCurrency(i.preco_compra)}${trend}
                        </span>
                    </span>
                    <span class="ft-item-end">
                        <span class="ft-pill ft-pill-acc">${formatCurrency(i.custo_unitario)}<span class="ft-pill-unit">/${esc(i.unidade)}</span></span>
                        <span class="ft-item-chev">${ico.chevR}</span>
                    </span>
                </button>`;
            }).join('')}
        </div>`;

    wrap.querySelectorAll('.ft-list-item').forEach(b =>
        b.addEventListener('click', () => abrirFormIngrediente(b.dataset.id)));
}

function _trendBadge(precoAtual, hist) {
    if (hist.length < 2) return '';
    const ant = hist[hist.length - 2].preco;
    const v   = calcVariacaoPreco(precoAtual, ant);
    if (Math.abs(v) < 0.01) return '';
    const up = v > 0;
    return ` <span class="ft-trend ${up ? 'up' : 'dn'}">${up ? ico.trendUp : ico.trendDn}${Math.abs(v).toFixed(1)}%</span>`;
}

// ── Formulário (síncrono, sem await) ──────────────────────────
export function abrirFormIngrediente(id = null) {
    const ing  = id ? getIngredienteById(id) : null;
    const hist = id ? _getHist(id) : [];

    const unOpts = ['g','kg','ml','l','uni','pct','cx','bld','crt','frd','rl'].map(u =>
        `<option value="${u}"${ing?.unidade === u ? ' selected' : ''}>${UNIDADE_LABEL[u]}</option>`
    ).join('');

    // Histórico de preços
    const histHtml = hist.length > 1 ? `
        <div class="ft-field">
            <label>${ico.history} Histórico de preços</label>
            <div class="ft-hist-list">
                ${[...hist].reverse().map((h, ri) => {
                    const prev = hist[hist.length - 2 - ri];
                    const v    = prev ? calcVariacaoPreco(h.preco, prev.preco) : 0;
                    const badge = Math.abs(v) > 0.01
                        ? `<span class="ft-hist-var ${v > 0 ? 'up' : 'dn'}">${v > 0 ? '▲' : '▼'}${Math.abs(v).toFixed(1)}%</span>`
                        : '';
                    return `<div class="ft-hist-row">
                        <span class="ft-hist-data">${formatDataCurta(h.data)}</span>
                        <span class="ft-hist-preco">${formatCurrency(h.preco)}</span>
                        ${badge}
                    </div>`;
                }).join('')}
            </div>
        </div>` : '';

    // Fix: n2input() para pré-preenchimento — evita bug "2.5" → parseNum = 25
    const qtdVal   = n2input(ing?.quantidade_embalagem);          // ex: 2,5  ou  1.000
    const precoVal = n2input(ing?.preco_compra, 2, 2);            // ex: 35,00

    const html = `
        <div class="ft-mhd">
            <button class="ft-mhd-close" id="_iClose">${ico.close}</button>
            <span class="ft-mhd-title">${ing ? 'Editar ingrediente' : 'Novo ingrediente'}</span>
            ${ing ? `<button class="ft-mhd-del" id="_iDel">${ico.trash}</button>` : `<span style="width:32px"></span>`}
        </div>
        <div class="ft-mbody">
            <div class="ft-tip-banner">${ico.tip}
                <span>Informe os dados da embalagem como você a compra (ex.: pacote 1 kg = 1000 g, R$ 18,90).</span>
            </div>
            <div class="ft-field">
                <label for="ft-ing-nome">Nome do ingrediente</label>
                <input id="ft-ing-nome" class="ft-input" type="text"
                    placeholder="Ex: Mussarela, Molho de tomate…"
                    value="${esc(ing?.nome || '')}" autocomplete="off" autocorrect="off">
            </div>
            <div class="ft-field-row">
                <div class="ft-field">
                    <label for="ft-ing-unid">Unidade</label>
                    <select id="ft-ing-unid" class="ft-input ft-select">${unOpts}</select>
                </div>
                <div class="ft-field">
                    <label for="ft-ing-qtd">Qtd. embalagem</label>
                    <input id="ft-ing-qtd" class="ft-input" type="text"
                        placeholder="Ex: 1.000" value="${esc(qtdVal)}"
                        inputmode="decimal" autocomplete="off">
                </div>
            </div>
            <div class="ft-field">
                <label for="ft-ing-preco">Preço de compra</label>
                <div class="ft-input-pre-wrap">
                    <span class="ft-input-pre">R$</span>
                    <input id="ft-ing-preco" class="ft-input has-pre" type="text"
                        placeholder="0,00" value="${esc(precoVal)}"
                        inputmode="decimal" autocomplete="off">
                </div>
            </div>
            <div class="ft-calc-preview" id="ft-ing-prev">
                <span class="ft-calc-label">${ico.tag} Custo unitário calculado</span>
                <span class="ft-calc-val" id="ft-ing-prev-val">—</span>
            </div>
            ${histHtml}
        </div>
        <div class="ft-mft">
            <button class="ft-btn ft-btn-primary ft-btn-full" id="_iSave">
                <span class="ft-bico">${ico.save}</span><span>Salvar ingrediente</span>
            </button>
        </div>`;

    // SÍNCRONO — DOM existe imediatamente após abrirModal
    const done = abrirModal(html);

    const pEl = document.getElementById('ft-ing-preco');
    const qEl = document.getElementById('ft-ing-qtd');
    const uEl = document.getElementById('ft-ing-unid');

    // Aplica máscaras
    if (qEl) applyMaskDecimal(qEl);
    if (pEl) applyMaskCurrency(pEl);

    function _prev() {
        const p = parseNum(pEl?.value), q = parseNum(qEl?.value), u = uEl?.value || 'g';
        const pv = document.getElementById('ft-ing-prev-val');
        const bx = document.getElementById('ft-ing-prev');
        if (p > 0 && q > 0) {
            if (pv) { pv.textContent = `${formatCurrency(calcCustoUnitario(p, q))} / ${u}`; pv.classList.add('has'); }
            bx?.classList.add('active');
        } else {
            if (pv) { pv.textContent = '—'; pv.classList.remove('has'); }
            bx?.classList.remove('active');
        }
    }

    [pEl, qEl, uEl].forEach(e => e?.addEventListener('input', _prev));
    // Fix: executa imediatamente — custo unitário aparece ao abrir o formulário
    _prev();

    document.getElementById('_iClose')?.addEventListener('click', () => fecharModal(null), { once: true });
    // FIX ALTO #2: { once: true } evita acumulação de handlers a cada reabertura do formulário.
    document.getElementById('_iSave')?.addEventListener('click',  () => _save(id),                     { once: true });
    document.getElementById('_iDel')?.addEventListener('click',   async () => { fecharModal(null); await _del(id); }, { once: true });
    return done;
}

async function _save(id) {
    const nome  = document.getElementById('ft-ing-nome')?.value.trim();
    const unid  = document.getElementById('ft-ing-unid')?.value;
    const qtd   = parseNum(document.getElementById('ft-ing-qtd')?.value);
    const preco = parseNum(document.getElementById('ft-ing-preco')?.value);

    if (!nome)    { _err('ft-ing-nome',  'Informe o nome.');              return; }
    if (qtd <= 0) { _err('ft-ing-qtd',   'Informe a quantidade.');        return; }
    if (preco<=0) { _err('ft-ing-preco', 'Informe o preço de compra.');   return; }

    if (!id) {
        const dup = _ings.find(i => i.nome.toLowerCase() === nome.toLowerCase());
        if (dup) { toast(`"${nome}" já existe.`, 'aviso'); return; }
    }

    const obj = {
        id: id || generateId(), nome, unidade: unid,
        quantidade_embalagem: qtd, preco_compra: preco,
        custo_unitario: calcCustoUnitario(preco, qtd), criadoEm: Date.now(),
    };

    _registrarPreco(obj.id, preco);

    const btn = document.getElementById('_iSave');
    if (btn) { btn.disabled = true; btn.lastElementChild.textContent = 'Salvando…'; }
    try {
        await salvar(COL, obj.id, obj);
        if (id) { const i = _ings.findIndex(x => x.id === id); if (i >= 0) _ings[i] = obj; else _ings.push(obj); }
        else _ings.push(obj);
        fecharModal('saved');
        toast(id ? 'Ingrediente atualizado!' : 'Ingrediente adicionado!', 'sucesso');
        renderIngredientes(document.getElementById('ft-busca-ing')?.value || '');
        document.dispatchEvent(new CustomEvent('ft:ings-changed'));
    } catch (e) {
        toast('Erro ao salvar.', 'erro');
        if (btn) { btn.disabled = false; btn.lastElementChild.textContent = 'Salvar ingrediente'; }
        console.error(e);
    }
}

async function _del(id) {
    const ing = getIngredienteById(id);
    if (!ing) return;
    const ok = await confirmar(`Remover <strong>${esc(ing.nome)}</strong>?<br>Não pode ser desfeito.`, { labelOK: 'Remover' });
    if (!ok) return;
    await remover(COL, id);
    localStorage.removeItem('ft_ph_' + id);
    _ings = _ings.filter(i => i.id !== id);
    toast('Ingrediente removido.', 'info');
    renderIngredientes(document.getElementById('ft-busca-ing')?.value || '');
    document.dispatchEvent(new CustomEvent('ft:ings-changed'));
}

// ── Picker (modal-2) ──────────────────────────────────────────
export function abrirPickerIngrediente(jaAdicionados = []) {
    const disp = [..._ings]
        .filter(i => !jaAdicionados.includes(i.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    if (!disp.length) {
        toast('Todos os ingredientes já foram adicionados ou nenhum cadastrado.', 'aviso');
        return Promise.resolve(null);
    }

    const opts = disp.map(i =>
        `<option value="${i.id}">${esc(i.nome)} · ${formatCurrency(i.custo_unitario)}/${esc(i.unidade)}</option>`
    ).join('');

    const html = `
        <div class="ft-mhd">
            <button class="ft-mhd-close" id="_pkClose">${ico.close}</button>
            <span class="ft-mhd-title">Adicionar ingrediente</span>
            <span style="width:32px"></span>
        </div>
        <div class="ft-mbody">
            <div class="ft-field">
                <label for="ft-pk-ing">Ingrediente</label>
                <select id="ft-pk-ing" class="ft-input ft-select">
                    <option value="">— Selecione —</option>${opts}
                </select>
            </div>
            <div class="ft-field">
                <label for="ft-pk-qtd">Quantidade por pizza</label>
                <div class="ft-input-suf-wrap">
                    <input id="ft-pk-qtd" class="ft-input has-suf" type="text"
                        placeholder="Ex: 120" inputmode="decimal" autocomplete="off">
                    <span class="ft-input-suf" id="ft-pk-unid">—</span>
                </div>
                <span class="ft-field-hint">Ex.: 120 (g) · 0,05 (kg) · 2 (uni)</span>
            </div>
            <div class="ft-calc-preview" id="ft-pk-prev">
                <span class="ft-calc-label">${ico.tag} Custo desta quantidade</span>
                <span class="ft-calc-val" id="ft-pk-val">—</span>
            </div>
        </div>
        <div class="ft-mft">
            <button class="ft-btn ft-btn-ghost" id="_pkCancel">Cancelar</button>
            <button class="ft-btn ft-btn-primary" id="_pkOk">
                <span class="ft-bico">${ico.plus}</span><span>Adicionar</span>
            </button>
        </div>`;

    const ov2 = document.getElementById('ft-modal-2');
    const bx2 = document.getElementById('ft-modal-2-box');
    if (!ov2 || !bx2) return Promise.resolve(null);
    bx2.innerHTML = html;
    ov2.classList.add('open');
    requestAnimationFrame(() => document.getElementById('ft-pk-ing')?.focus());

    const selEl  = document.getElementById('ft-pk-ing');
    const qtdEl  = document.getElementById('ft-pk-qtd');
    const unidEl = document.getElementById('ft-pk-unid');
    const valEl  = document.getElementById('ft-pk-val');
    const prevBx = document.getElementById('ft-pk-prev');

    // Aplica máscara decimal ao campo de quantidade do picker
    if (qtdEl) applyMaskDecimal(qtdEl);

    const _upd = () => {
        const ing = disp.find(i => i.id === selEl?.value);
        if (unidEl) unidEl.textContent = ing?.unidade || '—';
        const qtd = parseNum(qtdEl?.value);
        if (ing && qtd > 0) {
            if (valEl) { valEl.textContent = formatCurrency(qtd * ing.custo_unitario); valEl.classList.add('has'); }
            prevBx?.classList.add('active');
        } else {
            if (valEl) { valEl.textContent = '—'; valEl.classList.remove('has'); }
            prevBx?.classList.remove('active');
        }
    };
    selEl?.addEventListener('change', _upd);
    qtdEl?.addEventListener('input',  _upd);

    return new Promise(resolve => {
        const _close = res => { ov2.classList.remove('open'); resolve(res); };
        document.getElementById('_pkClose')?.addEventListener('click',  () => _close(null), { once: true });
        document.getElementById('_pkCancel')?.addEventListener('click', () => _close(null), { once: true });
        ov2.addEventListener('click', e => { if (e.target === ov2) _close(null); }, { once: true });
        document.getElementById('_pkOk')?.addEventListener('click', () => {
            const ing = disp.find(i => i.id === selEl?.value);
            const qtd = parseNum(qtdEl?.value);
            if (!ing)    { toast('Selecione um ingrediente.', 'erro'); return; }
            if (qtd <= 0){ toast('Informe a quantidade.',     'erro'); return; }
            _close({ ing, qtd });
        });
    });
}
