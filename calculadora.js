// calculadora.js — StockFlow Pro v10.0
// ══════════════════════════════════════════════════════════════════
// v10.0 — TAREFA 3/7: parser duplicado removido; agora importa
//         avaliarExpr de expr.js (módulo compartilhado com listafacil.js).
//         Elimina ~55 linhas de código morto. Zero quebra de funcionalidade.
//
// Correções históricas mantidas:
//   BUG #1 — Function() constructor substituído por parser recursivo descente.
//   BUG #2 — .innerText → .textContent em todos os campos da calculadora.
// ══════════════════════════════════════════════════════════════════

import { darFeedback } from './utils.js';
import { mostrarToast } from './toast.js';
import { avaliarExpr }  from './expr.js';
import { salvarDados } from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';
import { verificarAlertas } from './alerta.js';

let inputCalculadoraAtual = null;
let expressaoCalc = '';

export function abrirCalculadora(inputElement) {
    darFeedback();
    inputElement.blur();
    inputCalculadoraAtual = inputElement;

    let titulo = 'Calculadora';
    if (inputElement.id === 'novoQtd') {
        const nomeNovo = document.getElementById('novoProduto')?.value.trim();
        titulo = nomeNovo || 'Novo Item';
    } else {
        const linha = inputElement.closest('tr');
        if (linha) {
            // BUG FIX #2: textContent em vez de innerText.
            titulo = linha.querySelector('.nome-prod')?.textContent.trim() || titulo;
        }
    }

    // BUG FIX #2: textContent em vez de innerText.
    document.getElementById('calc-title').textContent = 'Calc: ' + titulo;
    const val = inputElement.value.replace(',', '.').trim();
    expressaoCalc = val || '';
    atualizarDisplayCalc();
    document.getElementById('modal-calc').style.display = 'flex';
}

export function fecharCalculadora() {
    darFeedback();
    document.getElementById('modal-calc').style.display = 'none';
    inputCalculadoraAtual = null;
}

export function calcDigito(digito) {
    darFeedback();
    if (digito === 'C') {
        expressaoCalc = '';
    } else if (digito === 'BACK') {
        expressaoCalc = expressaoCalc.slice(0, -1);
    } else {
        expressaoCalc += (digito === ',') ? '.' : digito;
    }
    atualizarDisplayCalc();
}

function atualizarDisplayCalc() {
    // BUG FIX #2: textContent em vez de innerText.
    document.getElementById('calc-display').textContent =
        expressaoCalc.replace(/\./g, ',') || '0';
}

// ── Parser delegado a expr.js (módulo compartilhado) ─────────────
// _avaliarExpressao removido em v10.0 — sem duplicação de código.
// avaliarExpr importado de expr.js (mesmo parser, mesma gramática).
// ─────────────────────────────────────────────────────────────────

export function calcSalvar() {
    darFeedback();
    try {
        const expr = expressaoCalc.replace(/×/g, '*').replace(/÷/g, '/');
        if (expr.trim()) {
            let resultado = avaliarExpr(expr);
            if (!isFinite(resultado)) throw new Error('Resultado inválido');
            resultado = Math.round(resultado * 100) / 100;
            inputCalculadoraAtual.value = resultado.toString().replace('.', ',');
        } else {
            inputCalculadoraAtual.value = '';
        }
        const dados = coletarDadosDaTabela();
        salvarDados(dados);
        fecharCalculadora();
        mostrarToast('Quantidade salva', 'sucesso');
        verificarAlertas();
    } catch (e) {
        // BUG FIX #2: textContent em vez de innerText.
        document.getElementById('calc-display').textContent = 'Erro';
        setTimeout(atualizarDisplayCalc, 1000);
    }
}

export function getInputCalculadoraAtual() {
    return inputCalculadoraAtual;
}