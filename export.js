// export.js — StockFlow Pro v9.9.40
// ══════════════════════════════════════════════════════════════════
// v9.9.6  — importarJSON() com validação de schema completa
// v9.9.39 — Multi-estoque
//   exportarJSON(): inclui estoquesMeta + estoques[id] no payload.
//     Mantém campo legado `estoque` (= itens do ativo) para compat
//     com versões anteriores que importem o arquivo.
//   importarJSON(): importa no estoque ativo via salvarDados().
//     Schema aceita tanto o novo formato (estoquesMeta/estoques)
//     quanto o legado (campo estoque).
// ══════════════════════════════════════════════════════════════════

import { darFeedback, copiarParaClipboard } from './utils.js';
import { mostrarToast }     from './toast.js';
import { mostrarConfirmacao } from './confirm.js';
import {
    carregarDados, salvarDados,
    carregarOcultos, salvarOcultos,
    carregarMeus, salvarMeus,
    carregarItensLF, salvarItensLF,
    carregarOrcamentoLF, salvarOrcamentoLF,
    carregarHistoricoCompleto, mesclarHistorico,
    carregarEstoquesMeta,
    carregarItensEstoque,
    fbPushTudo,
} from './storage.js';
import { coletarDadosDaTabela } from './tabela.js';
import { recarregarDados }      from './reload.js';

// ── Constantes de validação ───────────────────────────────────────
const UNIDADES_VALIDAS = new Set(['kg','g','ml','L','uni','pct','cx','bld','crt','frd','rl']);
const MAX_ITENS        = 1000;

// ── Validadores privados ──────────────────────────────────────────
function _isStringNaoVazia(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

function _validarItemEstoque(item) {
    if (!item || typeof item !== 'object') return null;
    const n = typeof item.n === 'string' ? item.n.trim().slice(0, 200) : '';
    if (!n) return null;
    const q       = typeof item.q === 'string' ? item.q.trim().slice(0, 30) : '';
    const u       = UNIDADES_VALIDAS.has(item.u) ? item.u : 'uni';
    const c       = item.c === true;
    const min     = (typeof item.min === 'number' && isFinite(item.min) && item.min >= 0) ? item.min : null;
    const max     = (typeof item.max === 'number' && isFinite(item.max) && item.max >= 0) ? item.max : null;
    const minUnit = UNIDADES_VALIDAS.has(item.minUnit) ? item.minUnit : null;
    const maxUnit = UNIDADES_VALIDAS.has(item.maxUnit) ? item.maxUnit : null;
    return { n, q, u, c, min, max, minUnit, maxUnit };
}

function _validarItemLF(item) {
    if (!item || typeof item !== 'object') return null;
    const n = typeof item.n === 'string' ? item.n.trim().slice(0, 200) : '';
    if (!n) return null;
    const id   = typeof item.id === 'number' ? item.id : Date.now();
    const q    = (typeof item.q === 'number' && isFinite(item.q) && item.q >= 0) ? item.q : 1;
    const p    = (typeof item.p === 'number' && isFinite(item.p) && item.p >= 0) ? item.p : 0;
    const fone = typeof item.fone === 'string' ? item.fone.trim().slice(0, 30) : '';
    return { id, n, q, p, fone };
}

function _validarArray(arr, validador) {
    if (!Array.isArray(arr)) return { itens: [], descartados: 0 };
    const limitado = arr.slice(0, MAX_ITENS);
    const validos  = []; let descartados = 0;
    for (const item of limitado) {
        const s = validador(item);
        if (s) validos.push(s); else descartados++;
    }
    return { itens: validos, descartados };
}

function _validarPayload(d) {
    const erros = [];
    if (!d || typeof d !== 'object')
        return { ok: false, dados: null, erros: ['Formato de arquivo inválido.'] };

    const { itens: estoque, descartados: descEst } = _validarArray(d.estoque, _validarItemEstoque);
    if (descEst > 0) erros.push(`${descEst} item(s) de estoque com formato inválido foram ignorados.`);
    if (d.estoque !== undefined && !Array.isArray(d.estoque))
        erros.push('Campo "estoque" não é um array — ignorado.');

    const ocultos = Array.isArray(d.ocultos)
        ? d.ocultos.filter(v => _isStringNaoVazia(v)).slice(0, MAX_ITENS) : [];
    const meus    = Array.isArray(d.meus)
        ? d.meus
            .filter(m => m && _isStringNaoVazia(m.n))
            .map(m => ({ n: String(m.n).trim().slice(0, 200), u: UNIDADES_VALIDAS.has(m.u) ? m.u : 'uni' }))
            .slice(0, MAX_ITENS)
        : [];

    const { itens: lfItens, descartados: descLF } = _validarArray(d.lfItens, _validarItemLF);
    if (descLF > 0) erros.push(`${descLF} item(s) da Lista Fácil com formato inválido foram ignorados.`);

    const lfOrcamento = (typeof d.lfOrcamento === 'number' && isFinite(d.lfOrcamento) && d.lfOrcamento > 0)
        ? d.lfOrcamento : null;
    const lfHistorico = (d.lfHistorico && typeof d.lfHistorico === 'object' && !Array.isArray(d.lfHistorico))
        ? d.lfHistorico : null;

    const ok = Array.isArray(d.estoque);
    if (!ok) erros.push('O arquivo não contém um campo "estoque" válido.');

    return { ok, dados: { estoque, ocultos, meus, lfItens, lfOrcamento, lfHistorico }, erros };
}

// ── API pública ───────────────────────────────────────────────────

/**
 * Gera texto do estoque ativo para compartilhamento.
 */
export function gerarTextoEstoque() {
    const dados = coletarDadosDaTabela();
    const hoje  = new Date().toLocaleDateString('pt-BR');
    const itens = [...dados]
        .sort((a, b) => a.n.localeCompare(b.n, 'pt-BR', { sensitivity: 'base' }))
        .map(d => d.n + (d.q ? ' — ' + d.q + ' ' + d.u : ''));
    return `*ESTOQUE*\n*${hoje}*\n\n` + itens.join('\n') + '\n';
}

/**
 * Exporta todos os dados do app como JSON.
 * v9.9.39: inclui estoquesMeta e estoques[id] para preservar
 * todos os estoques; mantém campo legado `estoque` (ativo) para
 * compatibilidade com importações em versões anteriores.
 */
export function exportarJSON(versao) {
    darFeedback('medium');

    const meta     = carregarEstoquesMeta();
    const estoques = {};
    meta.forEach(({ id }) => { estoques[id] = carregarItensEstoque(id); });

    const payload = {
        v:            versao || 'desconhecida',
        // Multi-estoque
        estoquesMeta: meta,
        estoques,
        // Legado (ativo) — compat com versões < 9.9.39
        estoque:      carregarDados()             || [],
        ocultos:      carregarOcultos()           || [],
        meus:         carregarMeus()              || [],
        lfItens:      carregarItensLF()           || [],
        lfOrcamento:  carregarOrcamentoLF()       || 3200,
        lfHistorico:  carregarHistoricoCompleto() || {},
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `stockflow_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    // FIX ALTO: revogar após o click, não após 60s. O evento 'click' é síncrono;
    // 100ms é suficiente para o browser iniciar o download antes da revogação.
    a.addEventListener('click', () => setTimeout(() => URL.revokeObjectURL(url), 100), { once: true });
    a.click();
    document.body.removeChild(a);
    mostrarToast('Lista salva!', 'sucesso');
}

/**
 * Importa dados de um arquivo JSON com validação completa.
 * Importa o campo `estoque` (ativo ou legado) no estoque ativo.
 */
export function importarJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        let d;
        try { d = JSON.parse(e.target.result); }
        catch { mostrarToast('Arquivo inválido — não é um JSON bem formado.', 'erro'); return; }

        const { ok, dados, erros } = _validarPayload(d);
        if (!ok) { mostrarToast('Arquivo inválido: ' + erros[0], 'erro'); return; }

        const avisos   = erros.length > 0 ? '\n\nAvisos:\n' + erros.map(e => '• ' + e).join('\n') : '';
        const totalEst = dados.estoque.length;
        const msg = `Carregar ${totalEst} item(s) do arquivo?\nOs dados do estoque ativo serão substituídos.${avisos}`;

        mostrarConfirmacao(msg, async () => {
            if (dados.estoque.length > 0)  salvarDados(dados.estoque);
            if (dados.ocultos.length > 0)  salvarOcultos(dados.ocultos);
            if (dados.meus.length > 0)     salvarMeus(dados.meus);
            if (dados.lfItens.length > 0)  salvarItensLF(dados.lfItens);
            if (dados.lfOrcamento !== null) salvarOrcamentoLF(dados.lfOrcamento);
            if (dados.lfHistorico !== null) mesclarHistorico(dados.lfHistorico);
            await fbPushTudo();
            recarregarDados({ toast: `${totalEst} item(s) importados com sucesso!`, toastTipo: 'sucesso' });
        });
    };
    reader.readAsText(file);
}

export function compartilharEstoque() {
    darFeedback();
    const texto = gerarTextoEstoque();
    if (navigator.share) navigator.share({ text: texto });
    else copiarParaClipboard(texto);
}
