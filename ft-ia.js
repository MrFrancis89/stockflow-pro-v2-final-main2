// ft-ia.js — StockFlow Pro V2
// ══════════════════════════════════════════════════════════════════
// Inteligência Automática — Análise de Margem + Sugestões de Preço
// ──────────────────────────────────────────────────────────────────
// Responsabilidade: detectar problemas financeiros automaticamente
// e exibir insights acionáveis no Dashboard.
// ══════════════════════════════════════════════════════════════════

import { analisarReceitas, analisarMargemSaude, precificar } from './ft-core.js';
import { esc } from './ft-format.js';

const _R = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const _P = v => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';

// ── Renderiza painel de insights na Dashboard ─────────────────────

/**
 * Renderiza o painel de inteligência dentro de um container.
 * @param {string}  containerId — ID do elemento container
 * @param {Array}   receitas    — lista de receitas com custo e preço
 * @param {Object}  [opcoes]    — { margem_alvo, custo_fixo }
 */
export function renderInsightsPanel(containerId, receitas, opcoes = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const analise = analisarReceitas(receitas);

    if (!analise.total) {
        container.innerHTML = '';
        return;
    }

    // Estatísticas rápidas
    const stats = _calcStats(receitas);

    container.innerHTML = `
    <div class="ia-panel" id="ia-panel-root">

      <!-- Header -->
      <div class="ia-header">
        <div class="ia-header-left">
          <span class="ia-header-ico">🤖</span>
          <div>
            <div class="ia-header-title">Análise Inteligente</div>
            <div class="ia-header-sub">${analise.total} receita${analise.total !== 1 ? 's' : ''} analisada${analise.total !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${analise.com_problema > 0
          ? `<span class="ia-badge ia-badge-alerta">${analise.com_problema} alerta${analise.com_problema !== 1 ? 's' : ''}</span>`
          : `<span class="ia-badge ia-badge-ok">✓ Tudo OK</span>`
        }
      </div>

      <!-- KPIs rápidos -->
      <div class="ia-kpis">
        <div class="ia-kpi">
          <span class="ia-kpi-val" style="color:${_corMargem(stats.margem_media)}">${_P(stats.margem_media)}</span>
          <span class="ia-kpi-lbl">Margem média</span>
        </div>
        <div class="ia-kpi">
          <span class="ia-kpi-val">${_R(stats.custo_medio)}</span>
          <span class="ia-kpi-lbl">Custo médio</span>
        </div>
        <div class="ia-kpi">
          <span class="ia-kpi-val" style="color:#30D158">${analise.total - analise.com_problema}</span>
          <span class="ia-kpi-lbl">Saudáveis</span>
        </div>
      </div>

      <!-- Insights -->
      ${analise.insights.length
        ? `<div class="ia-insights-list">
            ${analise.insights.map(i => _renderInsight(i)).join('')}
          </div>`
        : `<div class="ia-ok-msg">
            <span class="ia-ok-ico">🎉</span>
            <span>Todas as receitas têm margens saudáveis!</span>
          </div>`
      }

      <!-- Dica final -->
      ${opcoes.margem_alvo ? _renderDicaMargem(stats, opcoes.margem_alvo) : ''}

    </div>`;
}

function _renderInsight(insight) {
    return `
    <div class="ia-insight ia-insight-${insight.tipo}">
      <div class="ia-insight-top">
        <span class="ia-insight-emoji">${insight.emoji}</span>
        <div class="ia-insight-body">
          <div class="ia-insight-msg">${esc(insight.mensagem)}</div>
          <div class="ia-insight-acao">${esc(insight.acao)}</div>
        </div>
      </div>
    </div>`;
}

function _renderDicaMargem(stats, alvo) {
    if (stats.margem_media >= alvo) return '';
    const delta = alvo - stats.margem_media;
    return `
    <div class="ia-dica">
      <span class="ia-dica-ico">💡</span>
      <span>Para atingir ${_P(alvo)} de margem média, você precisa aumentar os preços
      em aproximadamente ${_P(delta)} ou reduzir custos na mesma proporção.</span>
    </div>`;
}

// ── Renderiza badge inline numa receita ───────────────────────────

/**
 * Retorna HTML de badge de saúde para uso em listas de receita.
 * @param {number} margem — margem % da receita
 */
export function renderMargemBadge(margem) {
    const s = analisarMargemSaude(margem);
    return `<span class="ia-marg-badge" style="background:${s.cor}20;color:${s.cor}" title="${esc(s.sugestao)}">${s.emoji} ${_P(margem)}</span>`;
}

/**
 * Retorna preço sugerido com margem target.
 * @param {number} custo      — custo unitário
 * @param {number} margem_alvo — margem desejada %
 */
export function sugerirPreco(custo, margem_alvo = 30) {
    return precificar({ custoUnitario: custo, margem: margem_alvo }).preco_venda;
}

// ── Utilitários internos ─────────────────────────────────────────

function _calcStats(receitas) {
    const validos = receitas.filter(r => {
        const c = parseFloat(r.custo_total || r.custo) || 0;
        return c > 0;
    });
    if (!validos.length) return { margem_media: 0, custo_medio: 0 };

    const margens = validos.map(r => {
        const c = parseFloat(r.custo_total || r.custo) || 0;
        const p = parseFloat(r.preco_venda  || r.preco)  || 0;
        return p > 0 ? ((p - c) / p) * 100 : 0;
    });
    const custos = validos.map(r => parseFloat(r.custo_total || r.custo) || 0);

    return {
        margem_media: margens.reduce((a, b) => a + b, 0) / margens.length,
        custo_medio:  custos.reduce((a, b) => a + b, 0)  / custos.length,
    };
}

function _corMargem(m) {
    if (m <= 0)  return '#FF453A';
    if (m < 15)  return '#FF453A';
    if (m < 25)  return '#FF9F0A';
    return '#30D158';
}
