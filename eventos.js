// eventos.js — StockFlow Pro v9.7.4
// ══════════════════════════════════════════════════════════════════
// CORREÇÕES APLICADAS
// ══════════════════════════════════════════════════════════════════
// BUG #1 — Traversal frágil com .parentElement.parentElement
//   PROBLEMA : alternarCheck(box) subia dois níveis:
//              box.parentElement → <td>
//              .parentElement    → <tr>
//              Isso assume que o checkbox está sempre exatamente a dois
//              níveis de distância de um <tr>. Se a estrutura do HTML mudar
//              (ex.: wrapper extra por acessibilidade), retorna o nó errado
//              silenciosamente e a classe 'linha-marcada' vai para o elemento
//              incorreto.
//   CORREÇÃO : .closest('tr') sobe quantos níveis forem necessários e
//              é robusto a mudanças de estrutura.
//
// BUG #2 — null-guard ausente em #check-todos
//   PROBLEMA : Se o elemento não existir (aba diferente ou DOM parcial),
//              document.getElementById('check-todos').checked joga TypeError.
//   CORREÇÃO : Guard opcional chaining ou verificação explícita.
// ══════════════════════════════════════════════════════════════════

import { darFeedback } from './utils.js';
import { salvarDados } from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';
import { atualizarPainelCompras } from './compras.js';

export function alternarCheck(box) {
    darFeedback();

    // BUG FIX #1: .closest('tr') é robusto a variações de profundidade do DOM.
    const linha = box.closest('tr');
    if (!linha) return;

    if (box.checked) {
        linha.classList.add('linha-marcada');
    } else {
        linha.classList.remove('linha-marcada');
        // BUG FIX #2: optional chaining — sem TypeError se elemento ausente.
        const master = document.getElementById('check-todos');
        if (master) master.checked = false;
    }

    const dados = coletarDadosDaTabela();
    salvarDados(dados);
    atualizarPainelCompras();
}

export function alternarTodos(masterBox) {
    darFeedback();
    const isChecked = masterBox.checked;

    document.querySelectorAll('#lista-itens-container tr:not(.categoria-header-row)').forEach(r => {
        if (r.style.display === 'none') return;
        const box = r.querySelector("input[type='checkbox']");
        if (!box) return;
        box.checked = isChecked;
        r.classList.toggle('linha-marcada', isChecked);
    });

    const dados = coletarDadosDaTabela();
    salvarDados(dados);
    atualizarPainelCompras();
}