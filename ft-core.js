// ft-core.js — StockFlow Pro V2
// ══════════════════════════════════════════════════════════════════
// MOTOR CENTRAL — Camada /core
// ──────────────────────────────────────────────────────────────────
// PRINCÍPIOS:
//   1. ZERO dependências de DOM — funções puras, testáveis, portáveis.
//   2. ZERO imports de UI ou Firebase — esta é a camada base.
//   3. Todo cálculo financeiro passa por aqui — única fonte de verdade.
//   4. 100% compatível com ft-calc.js (não substitui, complementa).
//
// API PRINCIPAL:
//   calcularFichaTecnica(receita)    — cálculo completo centralizado
//   precificar({...})                — precificação profissional
//   calcularPontoEquilibrio({...})   — ponto de equilíbrio
//   analisarMargemSaude(margem)      — classificação de saúde
//   calcularMeta({...})              — meta diária de vendas
// ══════════════════════════════════════════════════════════════════

/** Garante número finito ≥ 0 */
const _n = v => Math.max(0, typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0);
/** Garante número finito (pode ser negativo) */
const _nf = v => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0);

// ══════════════════════════════════════════════════════════════════
// 1. CÁLCULO UNIFICADO DA FICHA TÉCNICA
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula todos os custos de uma ficha técnica de forma centralizada.
 *
 * @param {Object} receita
 * @param {string}   receita.nome
 * @param {number}   receita.porcoes            — nº de porções (default 1)
 * @param {Array}    receita.ingredientes        — lista de ingredientes
 * @param {number}   receita.ingredientes[].custo — custo total do ingrediente
 * @param {number}   [receita.overhead_pct]      — overhead % (default 0)
 * @param {number}   [receita.mao_de_obra]       — mão de obra R$ (default 0)
 * @param {number}   [receita.custo_fixo_rateado]— custo fixo rateado R$ (default 0)
 * @param {number}   [receita.fator_variacao]    — fator de tamanho ex: 1.5 para G (default 1)
 * @param {Array}    [receita.sub_receitas]       — ingredientes tipo preparo
 * @param {number}   [receita.perda_pct]         — % de perda no preparo (default 0)
 *
 * @returns {{
 *   custo_ingredientes: number,
 *   custo_preparo: number,
 *   custo_overhead: number,
 *   custo_mao_obra: number,
 *   custo_fixo: number,
 *   custo_total: number,
 *   custo_unitario: number,
 *   porcoes: number,
 *   fator: number
 * }}
 */
export function calcularFichaTecnica(receita) {
    if (!receita || typeof receita !== 'object') {
        return _resultado_vazio();
    }

    const porcoes = Math.max(1, _n(receita.porcoes) || 1);
    const fator   = Math.max(0.01, _n(receita.fator_variacao) || 1);

    // 1. Custo bruto dos ingredientes principais
    const ings = Array.isArray(receita.ingredientes) ? receita.ingredientes : [];
    const custo_ingredientes = ings.reduce((s, i) => s + _n(i.custo), 0) * fator;

    // 2. Custo de preparo (sub-receitas / preparos antecipados)
    const subs = Array.isArray(receita.sub_receitas) ? receita.sub_receitas : [];
    const custo_preparo = subs.reduce((s, i) => s + _n(i.custo), 0) * fator;

    // 3. Overhead sobre custo total de matérias
    const base_overhead = custo_ingredientes + custo_preparo;
    const overhead_pct  = _n(receita.overhead_pct);
    const custo_overhead = base_overhead * (overhead_pct / 100);

    // 4. Mão de obra fixa por lote
    const custo_mao_obra = _n(receita.mao_de_obra);

    // 5. Custo fixo rateado
    const custo_fixo = _n(receita.custo_fixo_rateado);

    // 6. Perda no preparo aplicada sobre matérias-primas
    const perda_pct = _n(receita.perda_pct);
    const fator_perda = 1 + (perda_pct / 100);

    // 7. Custo total do lote
    const custo_total =
        (base_overhead * fator_perda) +
        custo_overhead +
        custo_mao_obra +
        custo_fixo;

    // 8. Custo unitário (por porção)
    const custo_unitario = porcoes > 0 ? custo_total / porcoes : custo_total;

    return {
        custo_ingredientes: _round(custo_ingredientes),
        custo_preparo:      _round(custo_preparo),
        custo_overhead:     _round(custo_overhead),
        custo_mao_obra:     _round(custo_mao_obra),
        custo_fixo:         _round(custo_fixo),
        custo_total:        _round(custo_total),
        custo_unitario:     _round(custo_unitario),
        porcoes,
        fator,
    };
}

function _resultado_vazio() {
    return {
        custo_ingredientes: 0, custo_preparo: 0, custo_overhead: 0,
        custo_mao_obra: 0, custo_fixo: 0, custo_total: 0,
        custo_unitario: 0, porcoes: 1, fator: 1,
    };
}

// ══════════════════════════════════════════════════════════════════
// 2. PRECIFICAÇÃO PROFISSIONAL
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula o preço de venda considerando margem e taxas operacionais.
 *
 * @param {Object} params
 * @param {number} params.custoUnitario   — custo por unidade em R$
 * @param {number} params.margem          — margem desejada em % (ex: 30)
 * @param {number} [params.taxas]         — taxas totais em % (delivery, impostos, cartão)
 * @param {number} [params.taxa_delivery] — taxa delivery em % (ex: 15)
 * @param {number} [params.taxa_impostos] — impostos em % (ex: 6)
 * @param {number} [params.taxa_cartao]   — taxa cartão em % (ex: 3)
 *
 * @returns {{
 *   preco_venda: number,
 *   lucro_bruto: number,
 *   margem_real: number,
 *   total_taxas_pct: number,
 *   total_taxas_r: number,
 *   breakdown: Array<{label, pct, valor}>
 * }}
 */
export function precificar({ custoUnitario, margem, taxas = 0,
    taxa_delivery = 0, taxa_impostos = 0, taxa_cartao = 0 }) {
    const custo = _n(custoUnitario);
    const m     = Math.min(99, _n(margem));

    // Soma todas as taxas variáveis
    const total_taxas = _n(taxas) +
        _n(taxa_delivery) + _n(taxa_impostos) + _n(taxa_cartao);

    // Fórmula: custo / (1 - margem% - taxas%)
    const divisor = 1 - (m / 100) - (total_taxas / 100);
    const preco_venda = divisor > 0.01 ? custo / divisor : 0;

    const lucro_bruto = preco_venda - custo;
    const margem_real = preco_venda > 0
        ? ((preco_venda - custo) / preco_venda) * 100
        : 0;
    const total_taxas_r = preco_venda * (total_taxas / 100);

    const breakdown = [
        { label: 'Custo de produção', pct: preco_venda > 0 ? (custo / preco_venda) * 100 : 0,  valor: custo },
        { label: 'Margem de lucro',   pct: m,                                                   valor: preco_venda * (m / 100) },
        { label: 'Taxas operacionais',pct: total_taxas,                                         valor: total_taxas_r },
    ].map(i => ({ ...i, pct: _round(i.pct), valor: _round(i.valor) }));

    return {
        preco_venda:     _round(preco_venda),
        lucro_bruto:     _round(lucro_bruto),
        margem_real:     _round(margem_real),
        total_taxas_pct: _round(total_taxas),
        total_taxas_r:   _round(total_taxas_r),
        breakdown,
    };
}

// ══════════════════════════════════════════════════════════════════
// 3. MODO NEGÓCIO — Break-even, meta diária, lucro estimado
// ══════════════════════════════════════════════════════════════════

/**
 * Calcula o ponto de equilíbrio e projeta resultados do negócio.
 *
 * @param {Object} params
 * @param {number} params.custo_fixo_mensal     — R$ total custos fixos/mês
 * @param {number} params.preco_medio           — R$ preço médio de venda por unidade
 * @param {number} params.custo_variavel_medio  — R$ custo variável médio por unidade
 * @param {number} [params.dias_operacao]       — dias úteis/mês (default 26)
 * @param {number} [params.meta_faturamento]    — R$ meta de faturamento mensal
 *
 * @returns {{
 *   ponto_equilibrio_un: number,
 *   ponto_equilibrio_r:  number,
 *   meta_diaria_un:      number,
 *   meta_diaria_r:       number,
 *   margem_contribuicao: number,
 *   lucro_estimado:      number,
 *   custo_fixo_por_un:   number
 * }}
 */
export function calcularPontoEquilibrio({
    custo_fixo_mensal,
    preco_medio,
    custo_variavel_medio,
    dias_operacao = 26,
    meta_faturamento = 0,
}) {
    const cf   = _n(custo_fixo_mensal);
    const pv   = _n(preco_medio);
    const cv   = _n(custo_variavel_medio);
    const dias = Math.max(1, _n(dias_operacao));
    const meta = _n(meta_faturamento);

    const margem_contribuicao = pv - cv; // MC unitária

    // Break-even em unidades e R$
    const pe_un = margem_contribuicao > 0
        ? Math.ceil(cf / margem_contribuicao) : Infinity;
    const pe_r  = isFinite(pe_un) ? pe_un * pv : Infinity;

    // Meta diária
    const meta_ref  = meta > 0 ? meta : pe_r;
    const meta_un   = pv > 0 ? Math.ceil(meta_ref / (pv * dias)) : 0;
    const meta_r    = meta_un * pv;

    // Lucro estimado se vender o que precisar para break-even
    const lucro_estimado = isFinite(pe_r)
        ? (meta > pe_r ? (meta - pe_r) * (margem_contribuicao / (pv || 1)) : 0)
        : 0;

    const custo_fixo_por_un = isFinite(pe_un) && pe_un > 0
        ? _round(cf / pe_un) : 0;

    return {
        ponto_equilibrio_un: isFinite(pe_un) ? pe_un : null,
        ponto_equilibrio_r:  isFinite(pe_r)  ? _round(pe_r) : null,
        meta_diaria_un:      meta_un,
        meta_diaria_r:       _round(meta_r),
        margem_contribuicao: _round(margem_contribuicao),
        lucro_estimado:      _round(lucro_estimado),
        custo_fixo_por_un,
    };
}

// ══════════════════════════════════════════════════════════════════
// 4. ANÁLISE DE SAÚDE DA MARGEM
// ══════════════════════════════════════════════════════════════════

/**
 * Classifica a saúde de uma margem % e retorna diagnóstico.
 *
 * @param {number} margem — margem % (0-100)
 * @returns {{ nivel: 'critica'|'baixa'|'boa'|'otima', emoji: string, label: string, cor: string }}
 */
export function analisarMargemSaude(margem) {
    const m = _nf(margem);
    if (m <= 0)   return { nivel:'critica', emoji:'🔴', label:'Prejuízo',      cor:'#FF453A', sugestao:'Preço abaixo do custo — ajuste urgente.' };
    if (m < 15)   return { nivel:'critica', emoji:'🔴', label:'Crítica',       cor:'#FF453A', sugestao:'Margem muito baixa — revise custos ou aumente o preço.' };
    if (m < 25)   return { nivel:'baixa',   emoji:'🟡', label:'Atenção',       cor:'#FF9F0A', sugestao:'Margem aceitável — busque otimizar custos.' };
    if (m < 40)   return { nivel:'boa',     emoji:'🟢', label:'Boa',           cor:'#30D158', sugestao:'Margem saudável — mantenha ou expanda.' };
    return         { nivel:'otima',   emoji:'✨', label:'Excelente',     cor:'#0A84FF', sugestao:'Margem excelente — produto estratégico.' };
}

// ══════════════════════════════════════════════════════════════════
// 5. VARIAÇÕES DE TAMANHO
// ══════════════════════════════════════════════════════════════════

/**
 * Aplica fator de variação a um custo base e retorna preços sugeridos.
 *
 * @param {number} custo_base   — custo unitário do tamanho base (P)
 * @param {Array}  tamanhos     — [{nome, fator}]
 * @param {number} margem_pct   — margem desejada %
 * @returns {Array<{nome, fator, custo, preco_sugerido, lucro, margem}>}
 */
export function calcularVariacoes(custo_base, tamanhos, margem_pct = 30) {
    const cb = _n(custo_base);
    const arr = Array.isArray(tamanhos) ? tamanhos : [
        { nome: 'P',  fator: 1   },
        { nome: 'M',  fator: 1.3 },
        { nome: 'G',  fator: 1.6 },
        { nome: 'GG', fator: 2   },
    ];
    return arr.map(t => {
        const custo = cb * _n(t.fator);
        const { preco_venda, lucro_bruto, margem_real } = precificar({ custoUnitario: custo, margem: margem_pct });
        return {
            nome:          t.nome,
            fator:         t.fator,
            custo:         _round(custo),
            preco_sugerido:preco_venda,
            lucro:         lucro_bruto,
            margem:        margem_real,
        };
    });
}

// ══════════════════════════════════════════════════════════════════
// 6. INTELIGÊNCIA — Detecção automática de problemas
// ══════════════════════════════════════════════════════════════════

/**
 * Analisa uma lista de receitas e retorna insights automáticos.
 *
 * @param {Array<{nome, custo_total, preco_venda, porcoes}>} receitas
 * @returns {{
 *   total: number,
 *   com_problema: number,
 *   insights: Array<{tipo, prioridade, receita, mensagem, acao}>
 * }}
 */
export function analisarReceitas(receitas) {
    if (!Array.isArray(receitas) || !receitas.length) {
        return { total: 0, com_problema: 0, insights: [] };
    }

    const insights = [];

    receitas.forEach(r => {
        const custo = _n(r.custo_total || r.custo);
        const preco = _n(r.preco_venda || r.preco);
        const nome  = r.nome || 'Sem nome';

        if (custo <= 0) return; // sem dados suficientes

        const margem = preco > 0
            ? ((preco - custo) / preco) * 100
            : -100;
        const saude = analisarMargemSaude(margem);

        if (saude.nivel === 'critica') {
            insights.push({
                tipo:      'margem_critica',
                prioridade: 1,
                receita:   nome,
                mensagem:  `${nome}: margem de ${_round(margem)}% é crítica`,
                acao:      preco <= 0
                    ? 'Defina um preço de venda'
                    : `Aumente o preço para pelo menos ${_fmtR(custo * 1.25)} (margem 20%)`,
                cor:       saude.cor,
                emoji:     saude.emoji,
            });
        } else if (saude.nivel === 'baixa') {
            insights.push({
                tipo:      'margem_baixa',
                prioridade: 2,
                receita:   nome,
                mensagem:  `${nome}: margem de ${_round(margem)}% pode melhorar`,
                acao:      `Revise ingredientes ou ajuste o preço para ${_fmtR(custo / 0.75)}`,
                cor:       saude.cor,
                emoji:     saude.emoji,
            });
        }
    });

    // Ingrediente mais caro em geral
    const maiorCusto = receitas.reduce((max, r) => {
        const c = _n(r.custo_total || r.custo);
        return c > max.custo ? { nome: r.nome, custo: c } : max;
    }, { nome: '', custo: 0 });

    if (maiorCusto.custo > 0) {
        insights.push({
            tipo:      'custo_alto',
            prioridade: 3,
            receita:   maiorCusto.nome,
            mensagem:  `${maiorCusto.nome} tem o maior custo: ${_fmtR(maiorCusto.custo)}`,
            acao:      'Analise ingredientes e negocie com fornecedores',
            cor:       '#FF9F0A',
            emoji:     '💡',
        });
    }

    insights.sort((a, b) => a.prioridade - b.prioridade);
    const com_problema = new Set(insights.map(i => i.receita)).size;

    return { total: receitas.length, com_problema, insights };
}

// ══════════════════════════════════════════════════════════════════
// UTILITÁRIOS INTERNOS
// ══════════════════════════════════════════════════════════════════

function _round(v, dec = 4) {
    return Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec);
}

function _fmtR(v) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
