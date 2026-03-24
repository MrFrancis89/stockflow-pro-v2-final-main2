// tabela.js — StockFlow Pro v9.9.41
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — .innerText causa layout reflow (thrashing)
//   CORREÇÃO : .textContent — ~2–10× mais rápido e não força reflow.
//
// BUG #2 — Regex com flag 'm' desnecessária
//   CORREÇÃO : Regex simplificada sem flag 'm'.
//
// BUG #3 — Guard 'c.length === 0' não protege contra empty states
//   PROBLEMA : tr#empty-state-lista e tr#empty-state-busca têm 1 <td
//              colspan=4> — c.length = 1, não 0. O guard deixava passar
//              essas linhas, causando TypeError em c[1].querySelector(...)
//              que interrompia coletarDadosDaTabela() silenciosamente.
//              Efeito: salvarDados() nunca era chamado ao trocar de estoque
//              com empty state visível → dados do estoque atual NÃO eram
//              persistidos → ao voltar, a lista parecia zerada.
//   CORREÇÃO : Guard 'c.length < 4' — linhas com menos de 4 colunas
//              (check, nome, qtd, unidade) são ignoradas com segurança.
// ══════════════════════════════════════════════════════════════════

export function coletarDadosDaTabela() {
    const dados = [];

    document.querySelectorAll('#lista-itens-container tr:not(.categoria-header-row)').forEach(r => {
        const c = r.querySelectorAll('td');
        // BUG FIX #3: guard correto — linhas de item têm exatamente 4 colunas
        // (check, nome, qtd, unidade). Empty states e linhas de busca têm 1 td
        // com colspan=4, então c.length = 1. O guard antigo (=== 0) não pegava.
        if (c.length < 4) return;

        // BUG FIX #1: textContent em vez de innerText (sem reflow).
        // BUG FIX #2: regex sem flag 'm' desnecessária.
        const nome = c[1].querySelector('.nome-prod').textContent.replace(/\r\n|\n|\r/g, ' ').trim();
        const qtd  = c[2].querySelector('input').value.trim();
        const unid = c[3].querySelector('select').value;
        const chk  = c[0].querySelector("input[type='checkbox']").checked;
        const min     = r.dataset.min !== '' ? parseFloat(r.dataset.min) : null;
        const max     = r.dataset.max !== '' ? parseFloat(r.dataset.max) : null;
        const minUnit = r.dataset.minUnit || null;
        const maxUnit = r.dataset.maxUnit || null;

        dados.push({ n: nome, q: qtd, u: unid, c: chk, min, max, minUnit, maxUnit });
    });

    return dados;
}