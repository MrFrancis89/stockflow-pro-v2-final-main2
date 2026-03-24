// ft-negocio.js — StockFlow Pro V2
// ══════════════════════════════════════════════════════════════════
// MODO NEGÓCIO — Gestão Financeira da Operação
// ──────────────────────────────────────────────────────────────────
// Funcionalidades:
//   • Custo fixo mensal (usa gastos do ft-gastos.js)
//   • Custo fixo por unidade (rateio automático)
//   • Ponto de equilíbrio
//   • Meta diária de vendas
//   • Lucro estimado
//   • Simulação de cenários
// ══════════════════════════════════════════════════════════════════

import { calcularPontoEquilibrio, analisarMargemSaude } from './ft-core.js';
import { esc } from './ft-format.js';
import { toast, abrirModal, fecharModal, animateSection } from './ft-ui.js';
import { ico } from './ft-icons.js';
import { salvar, carregar } from './ft-storage.js';
import { getReceitasAtivas } from './ft-receitas.js';

const COL_NEG = 'negocio';

const _R  = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const _N  = v => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _q  = id => document.getElementById(id);
const _set = (id, v) => { const e = _q(id); if (e) e.textContent = v; };

let _cfg = {
    custo_fixo_mensal:    0,
    preco_medio:          0,
    custo_variavel_medio: 0,
    dias_operacao:        26,
    meta_faturamento:     0,
    margem_alvo:          30,
};

// ── Init ─────────────────────────────────────────────────────────

export async function initNegocio() {
    try {
        const dados = await carregar(COL_NEG);
        if (dados && dados.length > 0) {
            _cfg = { ..._cfg, ...dados[0] };
        }
    } catch (e) {
        console.warn('[ft-negocio] Sem config salva:', e.message);
    }
}

// ── Render principal ──────────────────────────────────────────────

export function renderNegocio() {
    const wrap = _q('ft-negocio');
    if (!wrap) return;
    animateSection(wrap);

    // Auto-preenche custo fixo dos gastos se disponível
    const preco = _calcPrecoMedioReceitas();
    const custo = _calcCustoMedioReceitas();
    if (preco > 0 && _cfg.preco_medio === 0) _cfg.preco_medio = preco;
    if (custo > 0 && _cfg.custo_variavel_medio === 0) _cfg.custo_variavel_medio = custo;

    wrap.innerHTML = `
    <div class="neg-root">

      <!-- Header hero -->
      <div class="neg-hero">
        <div class="neg-hero-ico">${ico.business || '🏢'}</div>
        <div>
          <h2 class="neg-hero-title">Modo Negócio</h2>
          <p class="neg-hero-sub">Ponto de equilíbrio · Meta diária · Lucro estimado</p>
        </div>
      </div>

      <!-- Formulário de configuração -->
      <div class="neg-card">
        <div class="neg-card-hd">
          <span class="neg-card-ico">${ico.settings || '⚙️'}</span>
          <span>Parâmetros do Negócio</span>
        </div>
        <div class="neg-form">

          <div class="neg-field-row">
            <div class="neg-field">
              <label class="neg-label">Custo Fixo Mensal (R$)</label>
              <div class="neg-input-pre-wrap">
                <span class="neg-input-pre">R$</span>
                <input class="neg-input has-pre" id="neg-cf" type="text" inputmode="decimal"
                  placeholder="5.000,00" value="${_cfg.custo_fixo_mensal > 0 ? _N(_cfg.custo_fixo_mensal) : ''}"
                  autocomplete="off">
              </div>
              <small class="neg-hint">Total de aluguel, salários, luz, etc.</small>
            </div>
            <div class="neg-field">
              <label class="neg-label">Dias de Operação / Mês</label>
              <input class="neg-input" id="neg-dias" type="text" inputmode="numeric"
                placeholder="26" value="${_cfg.dias_operacao || 26}" autocomplete="off">
            </div>
          </div>

          <div class="neg-field-row">
            <div class="neg-field">
              <label class="neg-label">Preço Médio de Venda (R$)</label>
              <div class="neg-input-pre-wrap">
                <span class="neg-input-pre">R$</span>
                <input class="neg-input has-pre" id="neg-pv" type="text" inputmode="decimal"
                  placeholder="45,00" value="${_cfg.preco_medio > 0 ? _N(_cfg.preco_medio) : ''}"
                  autocomplete="off">
              </div>
              <small class="neg-hint">${preco > 0 ? `Média das suas receitas: ${_R(preco)}` : 'Preço médio por unidade vendida'}</small>
            </div>
            <div class="neg-field">
              <label class="neg-label">Custo Variável Médio (R$)</label>
              <div class="neg-input-pre-wrap">
                <span class="neg-input-pre">R$</span>
                <input class="neg-input has-pre" id="neg-cv" type="text" inputmode="decimal"
                  placeholder="20,00" value="${_cfg.custo_variavel_medio > 0 ? _N(_cfg.custo_variavel_medio) : ''}"
                  autocomplete="off">
              </div>
              <small class="neg-hint">${custo > 0 ? `Média das suas receitas: ${_R(custo)}` : 'Custo por unidade vendida'}</small>
            </div>
          </div>

          <div class="neg-field-row">
            <div class="neg-field">
              <label class="neg-label">Meta de Faturamento Mensal (R$)</label>
              <div class="neg-input-pre-wrap">
                <span class="neg-input-pre">R$</span>
                <input class="neg-input has-pre" id="neg-meta" type="text" inputmode="decimal"
                  placeholder="20.000,00" value="${_cfg.meta_faturamento > 0 ? _N(_cfg.meta_faturamento) : ''}"
                  autocomplete="off">
              </div>
              <small class="neg-hint">Deixe em branco para usar o ponto de equilíbrio</small>
            </div>
            <div class="neg-field">
              <label class="neg-label">Margem Alvo (%)</label>
              <div class="neg-input-suf-wrap">
                <input class="neg-input has-suf" id="neg-marg" type="text" inputmode="decimal"
                  placeholder="30" value="${_cfg.margem_alvo || 30}" autocomplete="off">
                <span class="neg-input-suf">%</span>
              </div>
            </div>
          </div>

          <button class="neg-btn-calc" id="neg-btn-calcular" type="button">
            <span class="neg-btn-ico">${ico.calc || '🧮'}</span>
            Calcular Projeção
          </button>
        </div>
      </div>

      <!-- Resultados -->
      <div class="neg-results neg-hidden" id="neg-results">

        <!-- Break-even -->
        <div class="neg-result-card" id="neg-card-pe">
          <div class="neg-result-hd">
            <span>🎯</span>
            <span>Ponto de Equilíbrio</span>
          </div>
          <div class="neg-big-vals">
            <div class="neg-big">
              <span class="neg-big-val" id="neg-r-pe-un">—</span>
              <span class="neg-big-lbl">unidades / mês</span>
            </div>
            <div class="neg-big">
              <span class="neg-big-val amber" id="neg-r-pe-r">—</span>
              <span class="neg-big-lbl">faturamento mínimo</span>
            </div>
          </div>
          <div class="neg-gauge-wrap">
            <div class="neg-gauge-track"><div class="neg-gauge-fill" id="neg-gauge" style="width:0%"></div></div>
            <div class="neg-gauge-lbl" id="neg-gauge-lbl"></div>
          </div>
        </div>

        <!-- Meta diária -->
        <div class="neg-result-card" id="neg-card-meta">
          <div class="neg-result-hd">
            <span>📅</span>
            <span>Meta Diária</span>
          </div>
          <div class="neg-big-vals">
            <div class="neg-big">
              <span class="neg-big-val green" id="neg-r-meta-un">—</span>
              <span class="neg-big-lbl">unidades / dia</span>
            </div>
            <div class="neg-big">
              <span class="neg-big-val green" id="neg-r-meta-r">—</span>
              <span class="neg-big-lbl">faturamento / dia</span>
            </div>
          </div>
        </div>

        <!-- Margem contribuição e lucro -->
        <div class="neg-stats-grid">
          <div class="neg-stat">
            <span class="neg-stat-val" id="neg-r-mc">—</span>
            <span class="neg-stat-lbl">Margem de Contribuição</span>
          </div>
          <div class="neg-stat">
            <span class="neg-stat-val" id="neg-r-cfu">—</span>
            <span class="neg-stat-lbl">Custo Fixo / Unidade</span>
          </div>
          <div class="neg-stat">
            <span class="neg-stat-val green" id="neg-r-lucro">—</span>
            <span class="neg-stat-lbl">Lucro Estimado / Mês</span>
          </div>
        </div>

        <!-- Cenários -->
        <div class="neg-result-card neg-cenarios" id="neg-cenarios">
          <div class="neg-result-hd">
            <span>📊</span>
            <span>Simulação de Cenários</span>
          </div>
          <div id="neg-cenarios-body"></div>
        </div>

        <button class="neg-btn-salvar" id="neg-btn-salvar" type="button">
          💾 Salvar Configuração
        </button>
      </div>

    </div>`;

    _bindNegocioEvents();
}

// ── Eventos ───────────────────────────────────────────────────────

function _bindNegocioEvents() {
    _q('neg-btn-calcular')?.addEventListener('click', _calcular);
    _q('neg-btn-salvar')?.addEventListener('click', _salvarConfig);

    // Input masks simples
    ['neg-cf', 'neg-pv', 'neg-cv', 'neg-meta'].forEach(id => {
        _q(id)?.addEventListener('input', e => {
            const v = e.target.value.replace(/[^0-9,]/g, '');
            e.target.value = v;
        });
    });
}

function _parseInput(id) {
    const v = _q(id)?.value || '';
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

function _calcular() {
    const cf   = _parseInput('neg-cf');
    const pv   = _parseInput('neg-pv');
    const cv   = _parseInput('neg-cv');
    const dias = parseInt(_q('neg-dias')?.value || '26', 10) || 26;
    const meta = _parseInput('neg-meta');
    const marg = parseFloat(_q('neg-marg')?.value || '30') || 30;

    if (!cf && !pv) {
        toast('Informe o custo fixo e o preço médio de venda.', 'warn');
        return;
    }
    if (pv <= cv) {
        toast('O preço de venda deve ser maior que o custo variável.', 'warn');
        return;
    }

    _cfg = { custo_fixo_mensal: cf, preco_medio: pv, custo_variavel_medio: cv,
             dias_operacao: dias, meta_faturamento: meta, margem_alvo: marg };

    const res = calcularPontoEquilibrio({
        custo_fixo_mensal: cf,
        preco_medio: pv,
        custo_variavel_medio: cv,
        dias_operacao: dias,
        meta_faturamento: meta,
    });

    _renderResultados(res, pv, meta);

    _q('neg-results')?.classList.remove('neg-hidden');
    _q('neg-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _renderResultados(res, pv, meta) {
    // Break-even
    _set('neg-r-pe-un', res.ponto_equilibrio_un !== null
        ? `${res.ponto_equilibrio_un.toLocaleString('pt-BR')} un.` : '∞');
    _set('neg-r-pe-r', res.ponto_equilibrio_r !== null ? _R(res.ponto_equilibrio_r) : '∞');

    // Meta diária
    _set('neg-r-meta-un', `${res.meta_diaria_un.toLocaleString('pt-BR')} un.`);
    _set('neg-r-meta-r', _R(res.meta_diaria_r));

    // Stats
    _set('neg-r-mc', _R(res.margem_contribuicao));
    _set('neg-r-cfu', _R(res.custo_fixo_por_un));
    _set('neg-r-lucro', meta > 0 ? _R(res.lucro_estimado) : '—');

    // Gauge
    const gauge = _q('neg-gauge');
    const gaugeLbl = _q('neg-gauge-lbl');
    if (gauge && res.ponto_equilibrio_r !== null && meta > 0) {
        const pct = Math.min(100, (res.ponto_equilibrio_r / meta) * 100);
        gauge.style.width = pct + '%';
        gauge.style.background = pct > 80 ? '#FF453A' : pct > 50 ? '#FF9F0A' : '#30D158';
        if (gaugeLbl) gaugeLbl.textContent =
            `Break-even: ${Math.round(pct)}% da meta · ${_R(res.ponto_equilibrio_r)} de ${_R(meta)}`;
    }

    // Cenários
    _renderCenarios(res, pv, _cfg.custo_variavel_medio, _cfg.custo_fixo_mensal);
}

function _renderCenarios(res, pv, cv, cf) {
    const body = _q('neg-cenarios-body');
    if (!body) return;

    const cenarios = [
        { label: 'Ponto de Equilíbrio', un: res.ponto_equilibrio_un || 0, cor: '#FF9F0A' },
        { label: '+20% acima do PE',    un: Math.ceil((res.ponto_equilibrio_un || 0) * 1.2), cor: '#30D158' },
        { label: '+50% acima do PE',    un: Math.ceil((res.ponto_equilibrio_un || 0) * 1.5), cor: '#0A84FF' },
    ];

    body.innerHTML = cenarios.map(c => {
        const fat   = c.un * pv;
        const cvar  = c.un * cv;
        const lucro = fat - cvar - cf;
        const marg  = fat > 0 ? (lucro / fat) * 100 : 0;
        return `
        <div class="neg-cenario-row">
          <div class="neg-cen-label" style="color:${c.cor}">${esc(c.label)}</div>
          <div class="neg-cen-vals">
            <span><strong>${c.un.toLocaleString('pt-BR')}</strong> un.</span>
            <span>${_R(fat)}</span>
            <span class="neg-cen-lucro" style="color:${lucro >= 0 ? '#30D158' : '#FF453A'}">${_R(lucro)}</span>
            <span style="color:${_corMargem(marg)}">${marg.toFixed(1)}%</span>
          </div>
        </div>`;
    }).join('');
}

async function _salvarConfig() {
    try {
        await salvar(COL_NEG, 'config', { id: 'config', ..._cfg });
        toast('Configuração salva com sucesso!', 'success');
    } catch (e) {
        toast('Erro ao salvar configuração.', 'error');
    }
}

// ── Helpers de auto-preenchimento ─────────────────────────────────

function _calcPrecoMedioReceitas() {
    try {
        const recs = getReceitasAtivas ? getReceitasAtivas() : [];
        const validos = recs.filter(r => (r.preco_venda || 0) > 0);
        if (!validos.length) return 0;
        return validos.reduce((s, r) => s + (r.preco_venda || 0), 0) / validos.length;
    } catch { return 0; }
}

function _calcCustoMedioReceitas() {
    try {
        const recs = getReceitasAtivas ? getReceitasAtivas() : [];
        const validos = recs.filter(r => (r.custo_total || 0) > 0);
        if (!validos.length) return 0;
        return validos.reduce((s, r) => s + (r.custo_total || 0), 0) / validos.length;
    } catch { return 0; }
}

function _corMargem(m) {
    if (m <= 0)  return '#FF453A';
    if (m < 15)  return '#FF9F0A';
    return '#30D158';
}
