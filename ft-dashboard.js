// ft-dashboard.js — StockFlow Pro V2.2 (Blindagem)
// V2.2: Blindagem pós-cutover.
//   safe() aplicado em barW para proteger divisão de ponto flutuante.
//   validateState() adicionado antes de buildAppState().
//   calcularMemo() substitui calcularFichaCompleta() em recs.map() (lista grande).
//   Dead code removido: args órfãos do renderTutorial removido no cutover.
// V2.1: Cutover completo para ft-engine.js.
// V2: Integração com ft-ia.js para painel de Análise Inteligente.
import { getReceitasAtivas } from './ft-receitas.js';
import { getIngredientes } from './ft-ingredientes.js';
import { getTotalFixoMensal } from './ft-gastos.js';
import { getCfgNegocio } from './ft-negocio.js';
import { buildAppState, validateState, calcularMemoSmart,
         calcPrecoMarkup, calcLucro, calcMargemReal, calcRendimento,
         safe } from './fichaService.js';
import { formatCurrency, formatPercent, formatQtdUnid, formatNum, esc } from './ft-format.js';
import { renderEmpty, animateSection } from './ft-ui.js';
import { ico } from './ft-icons.js';
import { renderInsightsPanel } from './ft-ia.js';

export function renderDashboard() {
    const recs = getReceitasAtivas();
    const ings = getIngredientes();
    const wrap = document.getElementById('ft-dashboard');
    if (!wrap) return;
    animateSection(wrap);

    if (!recs.length) {
        renderEmpty(wrap, ico.dashboard,
            'Dashboard vazio',
            'Cadastre receitas para ver as estatísticas de lucratividade.');
        return;
    }

    const MK = 200;
    const n  = recs.length;

    // Contexto construído uma vez e reutilizado para todas as receitas.
    const _as = buildAppState(validateState({
        ingredientes: getIngredientes(),
        receitas:     recs,
        gastos:       getTotalFixoMensal(),
        cfg:          getCfgNegocio() || {},
    }));

    const custos = recs.map(r => {
        const eng = calcularMemoSmart(r, _as);
        return (eng && isFinite(eng.totalCost) && eng.totalCost >= 0) ? eng.totalCost : 0;
    });
    const precos = custos.map(c => calcPrecoMarkup(c, MK));
    const lucros = precos.map((p, i) => calcLucro(p, custos[i]));
    const margs  = precos.map((p, i) => calcMargemReal(p, custos[i]));

    const custoMed  = (Array.isArray(custos) ? custos : []).reduce((a, b) => a + b, 0) / n;
    const margMed   = (Array.isArray(margs)  ? margs  : []).reduce((a, b) => a + b, 0) / n;
    // V2: média do preço de venda real (preco_venda definido pelo usuário)
    const comPreco    = (Array.isArray(recs) ? recs : []).filter(r => (r.preco_venda || 0) > 0);
    const precoMedVenda = comPreco.length
        ? comPreco.reduce((s, r) => s + (r.preco_venda || 0), 0) / comPreco.length : 0;

    const iMC = custos.reduce((mi, v, i, a) => v > a[mi] ? i : mi, 0);
    const imc = custos.reduce((mi, v, i, a) => v < a[mi] ? i : mi, 0);
    const iML = lucros.reduce((mi, v, i, a) => v > a[mi] ? i : mi, 0);

    const ranking = recs
        .map((r, i) => ({ r, c: custos[i], p: precos[i], l: lucros[i], m: margs[i] }))
        .sort((a, b) => b.l - a.l);

    const negativas = ranking.filter(it => it.m <= 0 || it.c === 0);
    _atualizarBadgeAlerta(negativas.length);

    const alertaHtml = negativas.length ? `
        <div class="ft-alerta-margem">
            <div class="ft-alerta-ico">${ico.warn}</div>
            <div class="ft-alerta-body">
                <div class="ft-alerta-titulo">Atenção: margem negativa</div>
                <div class="ft-alerta-sub">
                    ${negativas.map(it =>
                        `<span class="ft-alerta-nome">${esc(it.r.nome)}</span>`
                    ).join('')}
                </div>
                <div class="ft-alerta-hint">Verifique os custos no Simulador.</div>
            </div>
        </div>` : '';

    // Rendimento — calculado uma vez para evitar duplo .filter()
    const ingsComUso    = ings.filter(ig =>
        recs.some(r => r.ingredientes?.some(i => i.ingrediente_id === ig.id))
    );
    const rendimentoHtml = ingsComUso.length ? `
        <div class="ft-dash-sec-title">Rendimento de ingredientes</div>
        <div class="ft-rendilist">
            ${ingsComUso
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                .map(ig => {
                    const usos = recs.flatMap(r =>
                        (r.ingredientes || [])
                            .filter(i => i.ingrediente_id === ig.id)
                            .map(i => ({ pizza: r.nome, qtd: i.quantidade }))
                    );
                    return (
                        '<div class="ft-rend-card">' +
                        '<div class="ft-rend-hd">' +
                        '<span class="ft-rend-nome">' + esc(ig.nome) + '</span>' +
                        '<span class="ft-rend-emb">' + formatQtdUnid(ig.quantidade_embalagem, ig.unidade) + '/emb.</span>' +
                        '</div>' +
                        usos.map(u =>
                            '<div class="ft-rend-row">' +
                            '<span>' + esc(u.pizza) + '</span>' +
                            '<span class="ft-rend-qtd">' + formatQtdUnid(u.qtd, ig.unidade) + '/pizza</span>' +
                            '<span class="ft-rend-res">' + formatNum(calcRendimento(ig.quantidade_embalagem, u.qtd), 1) + ' pizzas/emb.</span>' +
                            '</div>'
                        ).join('') +
                        '</div>'
                    );
                }).join('')}
        </div>` : '';

    wrap.innerHTML = `
        ${alertaHtml}

        <div class="ft-kpis">
            <div class="ft-kpi">
                <div class="ft-kpi-ico">${ico.recipes}</div>
                <div class="ft-kpi-val">${n}</div>
                <div class="ft-kpi-lbl">Receitas</div>
            </div>
            <div class="ft-kpi">
                <div class="ft-kpi-ico">${ico.ingredients}</div>
                <div class="ft-kpi-val">${ings.length}</div>
                <div class="ft-kpi-lbl">Ingredientes</div>
            </div>
            <div class="ft-kpi">
                <div class="ft-kpi-ico">${ico.tag}</div>
                <div class="ft-kpi-val">${formatCurrency(custoMed)}</div>
                <div class="ft-kpi-lbl">Custo médio</div>
            </div>
            ${precoMedVenda > 0 ? `
            <div class="ft-kpi ft-kpi-hi">
                <div class="ft-kpi-ico">${ico.money}</div>
                <div class="ft-kpi-val">${formatCurrency(precoMedVenda)}</div>
                <div class="ft-kpi-lbl">Preço médio venda</div>
            </div>` : `
            <div class="ft-kpi${margMed < 0 ? ' ft-kpi-danger' : ' ft-kpi-hi'}">
                <div class="ft-kpi-ico">${ico.money}</div>
                <div class="ft-kpi-val">${formatPercent(margMed)}</div>
                <div class="ft-kpi-lbl">Margem média</div>
            </div>`}
        </div>

        <div id="ft-ia-insights-container"></div>

        <div class="ft-dash-sec-title section-enter">Destaques</div>
        <div class="ft-destaques">
            <div class="ft-dest ft-dest-green">
                <div class="ft-dest-ico">${ico.trophy}</div>
                <div>
                    <div class="ft-dest-lbl">Mais lucrativa</div>
                    <div class="ft-dest-name">${esc(recs[iML].nome)}</div>
                    <div class="ft-dest-val">${formatCurrency(lucros[iML])} lucro</div>
                </div>
            </div>
            ${n > 1 ? `
            <div class="ft-dest ft-dest-amber">
                <div class="ft-dest-ico">${ico.star}</div>
                <div>
                    <div class="ft-dest-lbl">Mais cara (custo)</div>
                    <div class="ft-dest-name">${esc(recs[iMC].nome)}</div>
                    <div class="ft-dest-val">${formatCurrency(custos[iMC])} custo</div>
                </div>
            </div>
            <div class="ft-dest ft-dest-blue">
                <div class="ft-dest-ico">${ico.check}</div>
                <div>
                    <div class="ft-dest-lbl">Mais barata (custo)</div>
                    <div class="ft-dest-name">${esc(recs[imc].nome)}</div>
                    <div class="ft-dest-val">${formatCurrency(custos[imc])} custo</div>
                </div>
            </div>` : ''}
        </div>

        <div class="ft-dash-sec-title">
            Ranking <span class="ft-dash-sec-sub">markup ${MK}%</span>
        </div>
        <div class="ft-ranking">
            ${ranking.map((it, pos) => {
                const barW  = ranking[0].l > 0
                    ? safe(it.l / ranking[0].l * 100, 0).toFixed(1)
                    : '0.0';
                const medal = pos === 0 ? '1.' : pos === 1 ? '2.' : pos === 2 ? '3.' : '';
                const negCls = it.m <= 0 ? 'ft-rank-item-neg' : '';
                return `
                <div class="ft-rank-item ${negCls}">
                    <div class="ft-rank-pos">${medal || pos + 1}</div>
                    <div class="ft-rank-body">
                        <div class="ft-rank-name">
                            ${esc(it.r.nome)}
                            <span class="ft-tam-pill">${it.r.tamanho}</span>
                            ${it.m <= 0 ? `<span class="ft-warn-badge">${ico.warn}</span>` : ''}
                        </div>
                        <div class="ft-rank-sub">Custo ${formatCurrency(it.c)} · Preço ${formatCurrency(it.p)}</div>
                        <div class="ft-rank-bar-wrap">
                            <div class="ft-rank-bar${it.m <= 0 ? ' red' : ''}" style="width:${barW}%"></div>
                        </div>
                    </div>
                    <div class="ft-rank-right">
                        <div class="ft-rank-lucro${it.l <= 0 ? ' neg' : ''}">${formatCurrency(it.l)}</div>
                        <div class="ft-rank-marg">${formatPercent(it.m)}</div>
                    </div>
                </div>`;
            }).join('')}
        </div>

        ${rendimentoHtml}`;

    // V2: painel IA renderizado após DOM montado
    const receitasParaIA = recs.map((r, i) => ({
        nome:        r.nome,
        custo_total: custos[i],
        preco_venda: r.preco_venda || 0,
    }));
    renderInsightsPanel('ft-ia-insights-container', receitasParaIA, { margem_alvo: 30 });
}

function _atualizarBadgeAlerta(n) {
    const btn = document.querySelector('.ft-nav-btn[data-tab="dash"]');
    if (!btn) return;
    let badge = btn.querySelector('.ft-nav-badge');
    if (n > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ft-nav-badge';
            btn.appendChild(badge);
        }
        badge.textContent = n;
    } else {
        badge?.remove();
    }
}
