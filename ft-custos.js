// ft-custos.js — v4.1 (Blindagem)
// v4.1: Blindagem pós-cutover.
//   safe() aplicado em todos os pontos de renderização numérica.
//   validateState() adicionado antes de buildAppState() em _calc() e comparar.
//   Log estruturado via _log() no catch do comparador.
// v4.0: Cutover completo para ft-engine.js.
// v3.3: Auditoria sistemática — 9 correções (ver histórico no repositório).
import { getReceitasAtivas } from './ft-receitas.js';
import { getIngredientes }         from './ft-ingredientes.js';
import { getTotalFixoMensal }      from './ft-gastos.js';
import { getCfgNegocio }           from './ft-negocio.js';
import { buildAppState, validateState, calcularFichaCompleta,
         calcCustoEfetivo, calcPrecoMarkup, calcPrecoMargem,
         calcLucro, calcMargemReal, calcMarkupImplicito, calcCustoPorcao,
         safe, parseNum } from './fichaService.js';
import { formatCurrency, formatPercent, formatQtdUnid, n2input, PORCOES_PADRAO,
         applyMaskDecimalConfig, esc } from './ft-format.js';
import { toast, renderTutorial, debounce, animateSection } from './ft-ui.js';
import { carregarConfig, salvarConfig } from './ft-storage.js';
import { ico } from './ft-icons.js';

let _cfg  = { markup: 200, margem: 40, overhead: 0, maoDeObra: 0, porcoes: 0 };
let _modo = 'markup';   // 'markup' | 'margem' | 'comparar'

// Fix: debounce para salvarConfig — evita write excessivo em cada keypress
const _salvarCfgDebounced = debounce(() => {
    salvarConfig({
        markup_padrao:   _cfg.markup,
        margem_desejada: _cfg.margem,
        overhead_pct:    _cfg.overhead,
        mao_de_obra_r:   _cfg.maoDeObra,
        porcoes_padrao:  _cfg.porcoes,
    }).catch(() => {});
}, 800);

export async function initSimulador() {
    const c = await carregarConfig();
    if (c) {
        _cfg.markup    = c.markup_padrao    ?? 200;
        _cfg.margem    = c.margem_desejada  ?? 40;
        _cfg.overhead  = c.overhead_pct     ?? 0;
        _cfg.maoDeObra = c.mao_de_obra_r    ?? 0;
        _cfg.porcoes   = c.porcoes_padrao   ?? 0;
    }
}

export function renderSimulador() {
    const recs = getReceitasAtivas();
    const wrap = document.getElementById('ft-simulador');
    if (!wrap) return;
    animateSection(wrap);
    renderTutorial('ft-sec-sim', 'sim', ico.simulator, 'Como usar o Simulador', [
        'Selecione uma pizza e ajuste markup ou margem para ver o preço sugerido.',
        'Overhead (%): acrescenta custo de gás, embalagem e energia sobre os ingredientes.',
        'Mão de obra (R$): valor fixo por pizza adicionado ao custo efetivo.',
        'Comparar: veja até 4 pizzas lado a lado com o mesmo markup.',
    ]);

    const opts = recs.length
        ? recs.map(r => `<option value="${r.id}">${esc(r.nome)} (${r.tamanho})</option>`).join('')
        : '';

    const tabs = ['markup','margem','comparar'].map(m =>
        `<button class="ft-sim-tab${_modo === m ? ' active' : ''}" data-m="${m}" type="button">
            ${m === 'markup' ? 'Markup' : m === 'margem' ? 'Margem' : 'Comparar'}
        </button>`).join('');

    wrap.innerHTML = `
        <!-- Seleção -->
        <div class="ft-sim-bloco" id="ft-sim-sel-bloco">
            <div class="ft-sim-bh">${ico.recipes}<span>Selecionar pizza</span></div>
            ${recs.length
                ? `<div class="ft-sim-pad">
                    <select id="ft-sim-sel" class="ft-input ft-select">
                        <option value="">— Selecione —</option>${opts}
                    </select>
                   </div>`
                : `<div class="ft-sim-empty">${ico.warn}
                    <span>Nenhuma receita ativa. Acesse <strong>Receitas</strong> e crie uma.</span>
                   </div>`}
        </div>

        <!-- Tabs -->
        <div class="ft-sim-bloco">
            <div class="ft-sim-tabs">${tabs}</div>

            <!-- Markup -->
            <div id="ft-sm-markup" class="${_modo !== 'markup' ? 'hidden' : ''}">
                <div class="ft-sim-pad">
                    <div class="ft-tip-banner">${ico.info}
                        <span>Markup de <strong>200%</strong> = preço 3× o custo.</span>
                    </div>
                    <input type="range" id="ft-mk-r" class="ft-slider" min="50" max="500" step="10" value="${_cfg.markup}">
                    <div class="ft-slider-val-row">
                        <span>Markup:</span>
                        <input id="ft-mk-i" class="ft-input ft-input-sm" type="number" value="${_cfg.markup}" min="0" step="10" inputmode="decimal">
                        <span>%</span>
                    </div>
                </div>
            </div>

            <!-- Margem -->
            <div id="ft-sm-margem" class="${_modo !== 'margem' ? 'hidden' : ''}">
                <div class="ft-sim-pad">
                    <div class="ft-tip-banner">${ico.info}
                        <span>Margem de <strong>40%</strong> = R$ 40 de lucro a cada R$ 100 vendido.</span>
                    </div>
                    <input type="range" id="ft-mg-r" class="ft-slider" min="5" max="90" step="5" value="${_cfg.margem}">
                    <div class="ft-slider-val-row">
                        <span>Margem:</span>
                        <input id="ft-mg-i" class="ft-input ft-input-sm" type="number" value="${_cfg.margem}" min="1" max="99" step="1" inputmode="decimal">
                        <span>%</span>
                    </div>
                </div>
            </div>

            <!-- Comparar (feat 7) -->
            <div id="ft-sm-comparar" class="${_modo !== 'comparar' ? 'hidden' : ''}">
                <div class="ft-sim-pad" id="ft-cmp-content">
                    ${_renderComparar(recs)}
                </div>
            </div>
        </div>

        <!-- Feat 9: Overhead + mão de obra -->
        <div class="ft-sim-bloco">
            <div class="ft-sim-bh">${ico.gear}<span>Custos operacionais</span></div>
            <div class="ft-sim-pad">
                <div class="ft-tip-banner">${ico.tip}
                    <span>Esses valores são somados ao custo dos ingredientes no cálculo do preço.</span>
                </div>
                <div class="ft-field-row">
                    <div class="ft-field">
                        <label for="ft-ovh">Overhead</label>
                        <div class="ft-input-suf-wrap">
                            <input id="ft-ovh" class="ft-input has-suf" type="text"
                                value="${_cfg.overhead > 0 ? n2input(_cfg.overhead) : ''}" inputmode="decimal" autocomplete="off">
                            <span class="ft-input-suf">%</span>
                        </div>
                        <span class="ft-field-hint">Gás, energia, embalagem…</span>
                    </div>
                    <div class="ft-field">
                        <label for="ft-mdo">Mão de obra</label>
                        <div class="ft-input-pre-wrap">
                            <span class="ft-input-pre">R$</span>
                            <input id="ft-mdo" class="ft-input has-pre" type="text"
                                value="${_cfg.maoDeObra > 0 ? n2input(_cfg.maoDeObra) : ''}" inputmode="decimal" autocomplete="off">
                        </div>
                        <span class="ft-field-hint">Valor fixo por pizza.</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Resultado -->
        <div id="ft-sim-res" class="hidden">
            <div class="ft-sim-bloco">
                <div class="ft-sim-bh">${ico.money}<span>Resultado</span></div>
                <div class="ft-sim-pad">
                    <div class="ft-custo-breakdown" id="ft-breakdown"></div>
                    <div class="ft-res-grid" id="ft-res-cards"></div>
                    <!-- Feat 4: custo por fatia -->
                    <div class="ft-porcao-row">
                        <div class="ft-field">
                            <label for="ft-porcoes">Porções (fatias)</label>
                            <input id="ft-porcoes" class="ft-input ft-input-sm" type="number"
                                min="1" max="24" step="1" value="${_cfg.porcoes || ''}"
                                placeholder="Auto" inputmode="numeric">
                        </div>
                        <div class="ft-porcao-result" id="ft-porcao-val"></div>
                    </div>
                </div>
            </div>
            <div class="ft-sim-bloco">
                <div class="ft-sim-bh">${ico.tag}<span>Composição do custo</span></div>
                <div id="ft-sim-comp"></div>
            </div>
        </div>`;

    // ── Eventos ────────────────────────────────────────────────────
    document.getElementById('ft-sim-sel')?.addEventListener('change', _calc);
    document.querySelectorAll('.ft-sim-tab').forEach(b => b.addEventListener('click', () => {
        _modo = b.dataset.m;
        document.querySelectorAll('.ft-sim-tab').forEach(x => x.classList.toggle('active', x === b));
        document.getElementById('ft-sm-markup')?.  classList.toggle('hidden', _modo !== 'markup');
        document.getElementById('ft-sm-margem')?.  classList.toggle('hidden', _modo !== 'margem');
        document.getElementById('ft-sm-comparar')?.classList.toggle('hidden', _modo !== 'comparar');
        if (_modo !== 'comparar') _calc();
        else _renderComparacaoLive();
    }));

    _bindPair('ft-mk-r', 'ft-mk-i');
    _bindPair('ft-mg-r', 'ft-mg-i');
    // Aplica máscara decimal nos inputs de config (type=text)
    const ovhEl = document.getElementById('ft-ovh');
    const mdoEl = document.getElementById('ft-mdo');
    if (ovhEl) applyMaskDecimalConfig(ovhEl);
    if (mdoEl) applyMaskDecimalConfig(mdoEl);
    document.getElementById('ft-ovh')?.addEventListener('input', () => {
        _cfg.overhead  = parseNum(document.getElementById('ft-ovh')?.value);
        _calc();
    });
    document.getElementById('ft-mdo')?.addEventListener('input', () => {
        _cfg.maoDeObra = parseNum(document.getElementById('ft-mdo')?.value);
        _calc();
    });
    document.getElementById('ft-porcoes')?.addEventListener('input', _calc);

    // Auto-seleciona se só há uma receita
    if (recs.length === 1) {
        const s = document.getElementById('ft-sim-sel');
        if (s) { s.value = recs[0].id; _calc(); }
    }
}

function _bindPair(rid, iid) {
    const r = document.getElementById(rid), i = document.getElementById(iid);
    if (!r || !i) return;
    r.addEventListener('input', () => { if (i.value !== r.value) i.value = r.value; _calc(); });
    i.addEventListener('input', () => { if (r.value !== i.value) r.value = i.value; _calc(); });
}

function _calc() {
    const selEl = document.getElementById('ft-sim-sel');
    const rec   = selEl?.value ? getReceitasAtivas().find(r => r.id === selEl.value) : null;
    const resEl = document.getElementById('ft-sim-res');
    if (!rec) { resEl?.classList.add('hidden'); return; }
    resEl?.classList.remove('hidden');

    const ovh = parseNum(document.getElementById('ft-ovh')?.value);
    const mdo = parseNum(document.getElementById('ft-mdo')?.value);
    _cfg.overhead  = ovh;
    _cfg.maoDeObra = mdo;

    // Custo base dos ingredientes — sempre via engine (modo strict)
    const _as  = buildAppState(validateState({
        ingredientes: getIngredientes(),
        receitas:     getReceitasAtivas(),
        gastos:       getTotalFixoMensal(),
        cfg:          getCfgNegocio() || {},
    }));
    const _eng   = calcularFichaCompleta(rec, _as);
    const custoIng = (_eng && isFinite(_eng.varCost) && _eng.varCost >= 0) ? _eng.varCost : 0;
    const custoEf  = calcCustoEfetivo(custoIng, ovh, mdo);

    let preco = 0;
    if (_modo === 'markup') {
        const mk = parseNum(document.getElementById('ft-mk-i')?.value);
        preco = calcPrecoMarkup(custoEf, mk);
        if (mk > 0) _cfg.markup = mk;
    } else if (_modo === 'margem') {
        const mg = parseNum(document.getElementById('ft-mg-i')?.value);
        if (mg >= 100) { toast('Margem deve ser menor que 100%.', 'aviso'); _salvarCfgDebounced(); return; }
        preco = calcPrecoMargem(custoEf, mg);
        _cfg.margem = mg;
    } else {
        return; // modo comparar — não usa este path
    }

    const lucro = calcLucro(preco, custoEf);
    const marR  = calcMargemReal(preco, custoEf);
    const mkImp = calcMarkupImplicito(preco, custoEf);

    // Breakdown custo (feat 9)
    const bdEl = document.getElementById('ft-breakdown');
    if (bdEl) {
        const ovhVal = custoIng * (ovh / 100);
        bdEl.innerHTML = `
            <div class="ft-bd-row">
                <span>Ingredientes</span><span>${formatCurrency(custoIng)}</span>
            </div>
            ${ovh > 0 ? `<div class="ft-bd-row">
                <span>Overhead (${ovh}%)</span><span>+${formatCurrency(ovhVal)}</span>
            </div>` : ''}
            ${mdo > 0 ? `<div class="ft-bd-row">
                <span>Mão de obra</span><span>+${formatCurrency(mdo)}</span>
            </div>` : ''}
            <div class="ft-bd-row ft-bd-total">
                <span>Custo efetivo</span><span>${formatCurrency(custoEf)}</span>
            </div>`;
    }

    const cards = document.getElementById('ft-res-cards');
    if (cards) cards.innerHTML = `
        <div class="ft-rcard ft-rcard-preco">
            <div class="ft-rcard-lbl">Preço sugerido</div>
            <div class="ft-rcard-val">${formatCurrency(preco)}</div>
        </div>
        <div class="ft-rcard ft-rcard-lucro">
            <div class="ft-rcard-lbl">Lucro</div>
            <div class="ft-rcard-val">${formatCurrency(lucro)}</div>
        </div>
        <div class="ft-rcard">
            <div class="ft-rcard-lbl">Margem real</div>
            <div class="ft-rcard-val">${formatPercent(marR)}</div>
        </div>
        <div class="ft-rcard">
            <div class="ft-rcard-lbl">Markup impl.</div>
            <div class="ft-rcard-val">${formatPercent(mkImp)}</div>
        </div>`;

    // Feat 4: custo por fatia
    const porcInput = document.getElementById('ft-porcoes');
    const tamPadr   = PORCOES_PADRAO[rec.tamanho] || 8;
    const porcoes   = parseNum(porcInput?.value) || tamPadr;
    _cfg.porcoes    = parseNum(porcInput?.value);
    const custoPrc  = calcCustoPorcao(custoEf, porcoes);
    const precoPrc  = calcCustoPorcao(preco,   porcoes);
    const pvEl      = document.getElementById('ft-porcao-val');
    if (pvEl) pvEl.innerHTML = `
        <div class="ft-porcao-card">
            <div class="ft-porcao-n">${porcoes} fatias</div>
            <div class="ft-porcao-custo">Custo/fatia <strong>${formatCurrency(custoPrc)}</strong></div>
            <div class="ft-porcao-preco">Preço/fatia <strong>${formatCurrency(precoPrc)}</strong></div>
        </div>`;
    if (porcInput && !porcInput.value) porcInput.placeholder = `${tamPadr} (padrão ${rec.tamanho})`;

    // Composição dos ingredientes
    const comp = document.getElementById('ft-sim-comp');
    if (comp) {
        const ings = rec.ingredientes || [];
        comp.innerHTML = ings.length
            ? ings.map(ing => {
                const ingCusto = safe(ing.custo);
                const pct = custoIng > 0
                    ? safe(ingCusto / custoIng * 100, 0).toFixed(1)
                    : '0.0';
                return `<div class="ft-comp-row">
                    <span class="ft-comp-nome">${esc(ing.nome)}</span>
                    <span class="ft-comp-qtd">${formatQtdUnid(ing.quantidade, ing.unidade)}</span>
                    <span class="ft-comp-bar-wrap"><span class="ft-comp-bar" style="width:${Math.min(safe(pct), 100)}%"></span></span>
                    <span class="ft-comp-cost">${formatCurrency(ingCusto)}</span>
                    <span class="ft-comp-pct">${pct}%</span>
                </div>`;
            }).join('')
            : `<div class="ft-sim-empty" style="padding:12px 0">Sem ingredientes.</div>`;
    }

    // Fix: debounced — evita write excessivo
    _salvarCfgDebounced();
}

// Feat 7: comparação de receitas
function _renderComparar(recs) {
    if (!recs.length) return `<div class="ft-sim-empty">${ico.warn}<span>Nenhuma receita ativa.</span></div>`;
    const opts = recs.map(r => `<option value="${r.id}">${esc(r.nome)} (${esc(r.tamanho)})</option>`).join('');
    return `
        <div class="ft-cmp-setup">
            <div class="ft-tip-banner">${ico.compare}
                <span>Selecione até 4 receitas para comparar lado a lado com o mesmo markup.</span>
            </div>
            <div class="ft-field-row ft-cmp-mk-row">
                <div class="ft-field">
                    <label for="ft-cmp-mk">Markup para comparação</label>
                    <div class="ft-input-suf-wrap">
                        <input id="ft-cmp-mk" class="ft-input has-suf" type="text"
                            value="${n2input(_cfg.markup)}" inputmode="decimal" autocomplete="off">
                        <span class="ft-input-suf">%</span>
                    </div>
                </div>
            </div>
            <select id="ft-cmp-sel" class="ft-input ft-select" multiple size="4">
                ${opts}
            </select>
            <button class="ft-btn ft-btn-primary" id="ft-cmp-btn" style="margin-top:10px">
                <span class="ft-bico">${ico.compare}</span><span>Comparar</span>
            </button>
        </div>
        <div id="ft-cmp-result"></div>`;
}

function _renderComparacaoLive() {
    const div = document.getElementById('ft-cmp-content');
    if (!div) return;
    const recs = getReceitasAtivas();
    div.innerHTML = _renderComparar(recs);

    const cmpMkEl = document.getElementById('ft-cmp-mk');
    if (cmpMkEl) applyMaskDecimalConfig(cmpMkEl);

    document.getElementById('ft-cmp-btn')?.addEventListener('click', () => {
        const sel   = document.getElementById('ft-cmp-sel');
        const mk    = parseNum(document.getElementById('ft-cmp-mk')?.value) || _cfg.markup;
        const ids   = sel ? [...sel.selectedOptions].map(o => o.value) : [];
        if (!ids.length) { toast('Selecione ao menos uma receita.', 'aviso'); return; }
        if (ids.length > 4) { toast('Máximo 4 receitas para comparar.', 'aviso'); return; }
        const ovh = parseNum(document.getElementById('ft-ovh')?.value);
        const mdo = parseNum(document.getElementById('ft-mdo')?.value);

        const resultEl = document.getElementById('ft-cmp-result');
        if (!resultEl) return;

        const _as = buildAppState(validateState({
            ingredientes: getIngredientes(),
            receitas:     recs,
            gastos:       getTotalFixoMensal(),
            cfg:          getCfgNegocio() || {},
        }));

        resultEl.innerHTML = `<div class="ft-cmp-grid">
            ${ids.map(id => {
                const r = recs.find(x => x.id === id);
                if (!r) return '';
                // Custo base sempre via engine (modo strict)
                let custoIng = 0;
                try {
                    const _eng = calcularFichaCompleta(r, _as);
                    if (_eng && isFinite(_eng.varCost) && _eng.varCost >= 0) custoIng = _eng.varCost;
                } catch (e) {
                    console.warn({ '[StockFlow]': 'comparar', receitaId: r.id, error: e?.message ?? e, ts: Date.now() });
                }
                const custoEf  = calcCustoEfetivo(custoIng, ovh, mdo);
                const preco    = calcPrecoMarkup(custoEf, mk);
                const lucro    = calcLucro(preco, custoEf);
                const marg     = calcMargemReal(preco, custoEf);
                return `
                <div class="ft-cmp-card">
                    <div class="ft-cmp-card-title">${esc(r.nome)} <span class="ft-tam-pill">${r.tamanho}</span></div>
                    <div class="ft-cmp-row-data"><span>Custo</span><strong>${formatCurrency(custoEf)}</strong></div>
                    <div class="ft-cmp-row-data ft-cmp-preco"><span>Preço</span><strong>${formatCurrency(preco)}</strong></div>
                    <div class="ft-cmp-row-data"><span>Lucro</span><strong class="green">${formatCurrency(lucro)}</strong></div>
                    <div class="ft-cmp-row-data"><span>Margem</span><strong>${formatPercent(marg)}</strong></div>
                </div>`;
            }).join('')}
        </div>`;
    });
}

