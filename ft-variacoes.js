// ft-variacoes.js — StockFlow Pro V2
// ══════════════════════════════════════════════════════════════════
// Sistema de Variações de Tamanho
// ──────────────────────────────────────────────────────────────────
// Permite criar variações de uma receita com fatores de multiplicação.
// Exemplo: receita base P=1x → M=1.3x → G=1.6x → GG=2x
//
// Cada variação herda todos os ingredientes da receita base e aplica
// o fator automaticamente no custo e precificação.
// ══════════════════════════════════════════════════════════════════

import { calcularFichaTecnica, calcularVariacoes, precificar } from './ft-core.js';
import { esc, formatCurrency } from './ft-format.js';
import { toast } from './ft-ui.js';
import { ico } from './ft-icons.js';

const _R  = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const _P  = v => (v || 0).toFixed(1) + '%';
const _q  = id => document.getElementById(id);

// Tamanhos padrão da indústria de pizzas
export const TAMANHOS_PADRAO = [
    { nome: 'P',  fator: 1.0  },
    { nome: 'M',  fator: 1.3  },
    { nome: 'G',  fator: 1.6  },
    { nome: 'GG', fator: 2.0  },
];

// ── Renderiza tabela de variações numa receita aberta ─────────────

/**
 * Renderiza painel de variações dentro de um container.
 * @param {string}  containerId
 * @param {Object}  receita         — receita base com ingredientes e custos
 * @param {number}  [margem_alvo]   — margem para precificação (default 30%)
 */
export function renderVariacoes(containerId, receita, margem_alvo = 30) {
    const container = _q(containerId);
    if (!container) return;

    const custo_base = receita.custo_total || 0;
    if (custo_base <= 0) {
        container.innerHTML = `
            <div class="var-empty">
                <p>Adicione ingredientes para ver as variações de tamanho.</p>
            </div>`;
        return;
    }

    const variacoes = calcularVariacoes(custo_base, TAMANHOS_PADRAO, margem_alvo);

    container.innerHTML = `
    <div class="var-panel">
      <div class="var-header">
        <span class="var-header-ico">${ico.sizes || '📐'}</span>
        <div>
          <div class="var-header-title">Variações por Tamanho</div>
          <div class="var-header-sub">Preços calculados com ${margem_alvo}% de margem</div>
        </div>
      </div>

      <div class="var-table-wrap">
        <table class="var-table">
          <thead>
            <tr>
              <th>Tamanho</th>
              <th>Fator</th>
              <th>Custo</th>
              <th>Preço Sug.</th>
              <th>Lucro</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            ${variacoes.map(v => `
            <tr class="var-row ${v.nome === receita.tamanho ? 'var-row-active' : ''}">
              <td class="var-tam"><span class="var-tam-pill">${esc(v.nome)}</span></td>
              <td class="var-fator">${v.fator}×</td>
              <td class="var-custo">${_R(v.custo)}</td>
              <td class="var-preco">
                <strong>${_R(v.preco_sugerido)}</strong>
              </td>
              <td class="var-lucro" style="color:#30D158">${_R(v.lucro)}</td>
              <td class="var-marg" style="color:${_corMargem(v.margem)}">${_P(v.margem)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="var-dica">
        💡 Os preços acima são sugestões baseadas em ${margem_alvo}% de margem.
        Ajuste conforme seu mercado.
      </div>
    </div>`;
}

// ── Widget inline: badge de custo por variação ────────────────────

/**
 * Retorna HTML de badges de variações para uso em listas.
 */
export function renderVariacoesBadges(custo_base, margem = 30) {
    if (!custo_base || custo_base <= 0) return '';
    const vars = calcularVariacoes(custo_base, TAMANHOS_PADRAO, margem);
    return vars.map(v =>
        `<span class="var-badge" title="Custo: ${_R(v.custo)} · Sugestão: ${_R(v.preco_sugerido)}">
          ${esc(v.nome)}: <strong>${_R(v.preco_sugerido)}</strong>
        </span>`
    ).join('');
}

function _corMargem(m) {
    if (m <= 0)  return '#FF453A';
    if (m < 20)  return '#FF9F0A';
    return '#30D158';
}
