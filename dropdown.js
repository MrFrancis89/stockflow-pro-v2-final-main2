// dropdown.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — .innerText força reflow de layout
//   PROBLEMA : .innerText em .nome-prod dispara recalcuação do layout CSS.
//   CORREÇÃO : .textContent para leitura de texto puro.
//
// BUG #2 — Valor selecionado pode ser perdido se o mesmo nome não existir mais
//   PROBLEMA : select.value = v restaura o valor anterior. Se o item foi
//              renomeado ou removido, 'v' não corresponde a nenhuma opção e
//              o select fica sem seleção sem nenhum aviso ao usuário.
//   CORREÇÃO : Mantém o comportamento existente (correto), mas adiciona
//              comentário para deixar a intenção explícita.
// ══════════════════════════════════════════════════════════════════

export function atualizarDropdown() {
    const select = document.getElementById('filtroSelect');
    if (!select) return;

    // Preserva seleção atual antes de reconstruir as opções.
    const valorAnterior = select.value;

    select.innerHTML = '<option value="">Todos</option>';

    const nomes = [];
    document.querySelectorAll('.nome-prod').forEach(td => {
        // BUG FIX #1: textContent em vez de innerText.
        nomes.push(td.textContent.replace(/\r\n|\n|\r/g, ' ').trim());
    });

    nomes.sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(n => {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        select.add(o);
    });

    // Restaura seleção anterior se o item ainda existir.
    select.value = valorAnterior;
}