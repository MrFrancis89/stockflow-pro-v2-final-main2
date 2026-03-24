// main.js — StockFlow Pro v9.9.48
// ══════════════════════════════════════════════════════════════════
// v9.9.5  — Decomposição do God Object
// v9.9.39 — Múltiplos estoques
// v9.9.40 — Correção Pull-to-refresh
// v9.9.41 — Correções de auditoria técnica
// v9.9.42 — Modal PWA + mostrarNovidades() sem fetch (conteúdo hardcoded)
// ══════════════════════════════════════════════════════════════════

import { configurarListenersConfirm, mostrarConfirmacao } from './confirm.js';
import { iniciarNavegacao }           from './navegacao.js';
import { iniciarSidebar, sidebarSetVersion, abrirSidebar } from './sidebar.js';
import { iniciarCalendario, agendarSnapshot, fecharCalendario } from './calendario.js';
import { iniciarMassa }               from './massa.js';
import { iniciarProducao }            from './producao.js';
import { iniciarListaFacil }          from './listafacil.js';
import { initSwipe }                  from './swipe.js';
import { atualizarDropdown }          from './dropdown.js';
import { renderizarListaCompleta, inserirLinhaNoDOM, salvarEAtualizar, atualizarStatusSave } from './ui.js';
import { atualizarPainelCompras, gerarTextoCompras }  from './compras.js';
import { coletarDadosDaTabela }       from './tabela.js';
import { verificarAlertas, fecharModalAlerta, salvarAlerta } from './alerta.js';
import { abrirCalculadora, fecharCalculadora, calcDigito, calcSalvar, getInputCalculadoraAtual } from './calculadora.js';
import { parseAndUpdateQuantity }     from './parser.js';
import { alternarCheck, alternarTodos } from './eventos.js';
import { ativarModoTeclado }          from './teclado.js';
import { copiarParaClipboard, darFeedback, comSpinner } from './utils.js';
import { mostrarToast, mostrarToastUndo } from './toast.js';
import {
    inicializarEstoques,
    STORAGE_KEYS,
    carregarDados, salvarDados,
    carregarOcultos, salvarOcultos,
    carregarMeus, salvarMeus,
    carregarUltimaVersao, salvarUltimaVersao,
    salvarItensLF, salvarOrcamentoLF,
    mesclarHistorico,
    fbPushTudo,
} from './storage.js';
import { produtosPadrao }             from './produtos.js';
import appStore                       from './store.js';
import { initBgUpload }               from './bg-upload.js';
import { aplicarTemaInicial, ciclarTema }              from './theme.js';
import { initAuth, initLogoutButton, initCloudButton } from './auth.js';
import { aplicarFiltro, iniciarLupa }                  from './search.js';
import { exportarJSON, importarJSON, compartilharEstoque, gerarTextoEstoque } from './export.js';
import { recarregarDados }                             from './reload.js';
import { abrirComFoco, fecharComFoco }                 from './modal.js';
import { initPullRefresh }                             from './pullrefresh.js';
import {
    registrarSW,
    iniciarCapturaPWA,
    tentarExibirModalInstalacao,
} from './pwa-install.js';
import { iniciarMultiEstoque }                         from './estoques.js';

// Executar IMEDIATAMENTE ao carregar o módulo — antes do DOMContentLoaded.
// beforeinstallprompt pode disparar muito cedo; registrar agora garante captura.
registrarSW();
iniciarCapturaPWA();

// v9.9.46 — Ficha Técnica movida para sidebar com menu em cascata + auditoria completa
// v9.9.48 — Botões hambúrguer (home + FT) migrados de spans para SVG; correções de auditoria
// v10.0   — Refatoração SaaS premium: calc unificado, UX premium, Firebase profissional
export const VERSAO_ATUAL = '10.0';

// ── Banner offline (UX premium v10.0) ────────────────────────────
function _initOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    function _update() {
        banner.classList.toggle('offline-banner--visible', !navigator.onLine);
    }
    window.addEventListener('online',  _update, { passive: true });
    window.addEventListener('offline', _update, { passive: true });
    _update(); // estado inicial
}


// Event delegation — um único listener cobre todos os botões do app.
// Não importado de ft-ui.js para evitar dependência circular.
let _rippleActive = false;
function _initRipple() {
    if (_rippleActive) return;
    _rippleActive = true;
    document.addEventListener('pointerdown', e => {
        const btn = e.target.closest('button, .btn, [role="button"]');
        if (!btn) return;
        btn.querySelectorAll('.ripple-effect').forEach(r => r.remove());
        const rect = btn.getBoundingClientRect();
        const r = document.createElement('span');
        r.className = 'ripple-effect';
        r.style.left = (e.clientX - rect.left) + 'px';
        r.style.top  = (e.clientY - rect.top)  + 'px';
        // Herda position:relative se não tiver; garante que o ripple fique contido
        if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
        btn.style.overflow = btn.style.overflow || 'hidden';
        btn.appendChild(r);
        r.addEventListener('animationend', () => r.remove(), { once: true });
    }, { passive: true });
}

// ── Handler global de erros não tratados ─────────────────────────
// Captura Promises rejeitadas sem .catch() e erros JS síncronos
// que escapariam silenciosamente. Loga com contexto para facilitar debug.
window.addEventListener('unhandledrejection', e => {
    console.error('[StockFlow] Promise não tratada:', e.reason);
    // Não exibe toast para o usuário — a maioria são erros de rede/Firebase
    // esperados em modo offline. Apenas garante rastreabilidade no console.
});

window.addEventListener('error', e => {
    // Ignora erros de scripts de terceiros (extensões, CDN) sem stack local
    if (!e.filename || !e.filename.includes(location.hostname)) return;
    console.error(`[StockFlow] Erro não capturado em ${e.filename}:${e.lineno}`, e.error);
});

// ── Debounce alertas ──────────────────────────────────────────────
let _alertaDebounceTimer = null;
function verificarAlertasDebounced() {
    clearTimeout(_alertaDebounceTimer);
    _alertaDebounceTimer = setTimeout(verificarAlertas, 600);
}

// ── Microfone ─────────────────────────────────────────────────────
function iniciarMic(inputId, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = false; rec.maxAlternatives = 1;
    btn.addEventListener('click', () => { darFeedback(); try { rec.start(); } catch(e){} });
    rec.onresult = e => {
        const inp = document.getElementById(inputId);
        if (inp) { inp.value = e.results[0][0].transcript; inp.dispatchEvent(new Event('input')); }
    };
}

function iniciarScrollBtns() {
    document.getElementById('btn-scroll-top')?.addEventListener('click', () => {
        darFeedback(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('btn-scroll-bottom')?.addEventListener('click', () => {
        darFeedback(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
}

// ── Lista padrão ──────────────────────────────────────────────────
let itensOcultos = [], meusItens = [];
function carregarListaPadrao() { itensOcultos = carregarOcultos(); meusItens = carregarMeus(); }
function buildDadosPadrao() {
    const dados = [], ocultoSet = new Set(itensOcultos.map(n => n.toLowerCase()));
    produtosPadrao.forEach(linha => {
        const [n, u] = linha.split('|');
        if (!ocultoSet.has(n.toLowerCase()))
            dados.push({ n, q: '', u: u || 'uni', c: false, min: null, max: null });
    });
    meusItens.forEach(item => {
        if (!dados.find(d => d.n.toLowerCase() === item.n.toLowerCase()))
            dados.push({ n: item.n, q: '', u: item.u || 'uni', c: false, min: null, max: null });
    });
    return dados;
}
function restaurarListaPadrao() {
    mostrarConfirmacao('Restaurar lista padrão? Os dados atuais serão perdidos.', () => {
        salvarDados(buildDadosPadrao());
        recarregarDados({ toast: 'Lista padrão restaurada!', toastTipo: 'sucesso' });
    });
}

function novoDia() {
    darFeedback('heavy');
    const dadosAntes   = coletarDadosDaTabela();
    const dadosZerados = dadosAntes.map(d => ({ ...d, q: '', c: false }));
    salvarDados(dadosZerados);
    renderizarListaCompleta(dadosZerados);
    atualizarDropdown();
    atualizarPainelCompras();
    agendarSnapshot();
    verificarAlertas();
    mostrarToastUndo('Quantidades zeradas', () => {
        salvarDados(dadosAntes);
        renderizarListaCompleta(dadosAntes);
        atualizarDropdown();
        atualizarPainelCompras();
        agendarSnapshot();
        verificarAlertas();
        mostrarToast('Ação desfeita!', 'sucesso');
    }, 8000);
}

function adicionarItem() {
    const nomEl = document.getElementById('novoProduto');
    const qtdEl = document.getElementById('novoQtd');
    const undEl = document.getElementById('novoUnidade');
    const nome  = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.', 'aviso'); return; }
    const dados = coletarDadosDaTabela();
    if (dados.find(d => d.n.toLowerCase() === nome.toLowerCase())) {
        mostrarToast('Produto já existe na lista.', 'aviso'); return;
    }
    darFeedback();
    inserirLinhaNoDOM(nome, qtdEl?.value || '', undEl?.value || 'uni', false, null, null, null, null);
    salvarDados(coletarDadosDaTabela());
    atualizarDropdown(); atualizarStatusSave();
    if (nomEl) nomEl.value = '';
    if (qtdEl) qtdEl.value = '';
    agendarSnapshot(); initSwipe();
}

function adicionarFavorito() {
    const nomEl = document.getElementById('novoProduto'), nome = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.', 'aviso'); return; }
    mostrarConfirmacao('Adicionar "' + nome + '" à lista padrão?', () => {
        const u = document.getElementById('novoUnidade')?.value || 'uni';
        meusItens = meusItens.filter(i => i.n.toLowerCase() !== nome.toLowerCase());
        meusItens.push({ n: nome, u });
        salvarMeus(meusItens);
        const jaExiste = !!coletarDadosDaTabela().find(d => d.n.toLowerCase() === nome.toLowerCase());
        adicionarItem();
        if (!jaExiste) mostrarToast('"' + nome + '" adicionado aos favoritos!', 'sucesso');
    });
}

function removerDoPadrao() {
    const nomEl = document.getElementById('novoProduto'), nome = nomEl?.value.trim();
    if (!nome) { mostrarToast('Digite o nome do produto.', 'aviso'); return; }
    mostrarConfirmacao('Remover "' + nome + '" da lista padrão?', () => {
        const nLower = nome.toLowerCase();
        meusItens    = meusItens.filter(i => i.n.toLowerCase() !== nLower);
        itensOcultos = itensOcultos.filter(n => n.toLowerCase() !== nLower);
        if (produtosPadrao.some(p => p.split('|')[0].toLowerCase() === nLower))
            itensOcultos.push(nome);
        salvarMeus(meusItens); salvarOcultos(itensOcultos);
        mostrarToast('"' + nome + '" removido do padrão.', 'info');
    });
}

/**
 * Restaura um snapshot do calendário.
 * v9.9.39: suporta formato multi-estoque (estoquesMeta + estoques[id])
 * e formato legado (campo estoque único).
 * Usa imports estáticos — sem import() dinâmico.
 */
function restaurarSnapshot(snap, data) {
    if (!snap) return;

    if (snap.estoquesMeta && snap.estoques && typeof snap.estoques === 'object') {
        // Formato multi-estoque: restaura todos os estoques diretamente
        localStorage.setItem(STORAGE_KEYS.estoquesMeta, JSON.stringify(snap.estoquesMeta));
        snap.estoquesMeta.forEach(({ id }) => {
            if (Array.isArray(snap.estoques[id])) {
                localStorage.setItem(
                    STORAGE_KEYS.estoquePrefix + id,
                    JSON.stringify(snap.estoques[id])
                );
            }
        });
    } else if (Array.isArray(snap.estoque) && snap.estoque.length > 0) {
        // Formato legado: salva no estoque ativo atual
        salvarDados(snap.estoque);
    }

    if (Array.isArray(snap.ocultos))  salvarOcultos(snap.ocultos);
    if (Array.isArray(snap.meus))     salvarMeus(snap.meus);
    if (Array.isArray(snap.lfItens))  salvarItensLF(snap.lfItens);
    if (snap.lfOrcamento)             salvarOrcamentoLF(snap.lfOrcamento);
    if (snap.lfHistorico)             mesclarHistorico(snap.lfHistorico);

    recarregarDados({ toast: 'Backup de ' + data + ' restaurado!', toastTipo: 'sucesso' });
}

// ── Renderizador interno de Markdown (CHANGELOG) ──────────────────
function _renderMarkdown(md) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    function inline(s) {
        return esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }
    const linhas = md.split('\n'), html = [];
    let emLista = false;
    for (const l of linhas) {
        if (/^---+\s*$/.test(l))   { if (emLista) { html.push('</ul>'); emLista=false; } html.push('<hr>'); continue; }
        if (l.startsWith('## '))   { if (emLista) { html.push('</ul>'); emLista=false; } html.push(`<h2>${inline(l.slice(3).trim())}</h2>`); continue; }
        if (l.startsWith('### '))  { if (emLista) { html.push('</ul>'); emLista=false; } html.push(`<h3>${inline(l.slice(4).trim())}</h3>`); continue; }
        if (/^[-*]\s/.test(l))     { if (!emLista) { html.push('<ul>'); emLista=true; } html.push(`<li>${inline(l.replace(/^[-*]\s/,'').trim())}</li>`); continue; }
        if (l.trim() === '')       { if (emLista) { html.push('</ul>'); emLista=false; } continue; }
        if (emLista)               { html.push('</ul>'); emLista=false; }
        html.push(`<p>${inline(l.trim())}</p>`);
    }
    if (emLista) html.push('</ul>');
    return html.join('\n');
}

// Conteúdo das novidades hardcoded — elimina dependência de fetch('./CHANGELOG.md')
// que falhava quando o app era aberto como arquivo local (file://) sem servidor HTTP.
const _CHANGELOG_INLINE = `## v9.9.42 — Modal PWA + Correções de estoque

### Novo recurso
- **Instalação na tela inicial**: após o login, o app pergunta se você quer instalar na tela inicial do celular. Android: um toque instala. iPhone: mostra os passos do Safari.

### Bugs corrigidos
- **Lista zerada ao trocar estoque**: dados eram gravados na chave errada após sincronização com Firebase. Corrigido em \`storage.js\`, \`estoques.js\` e \`reload.js\`.
- **Estoque anterior sumia ao voltar**: \`_trocarEstoque()\` agora usa ID explícito do localStorage para salvar — independente do estado do store.
- Criação de estoque perdia dados não salvos do estoque anterior.
- Listener \`sf:dados-recarregados\` da Lista Fácil acumulava handlers em re-inicializações.
- ID de item novo na Lista Fácil podia colidir ao adicionar dois itens rapidamente.`;

function mostrarNovidades() {
    // FIX v9.9.45: retorna uma Promise que resolve QUANDO o modal é fechado,
    // não ao abrir. Isso garante que tentarExibirModalInstalacao() só seja
    // chamada após o usuário dispensar o modal — sem polling, sem race condition.
    // Antes: async function resolvia imediatamente ao abrir o modal.
    // O pwa-install.js dependia de setInterval (até 15s) para detectar o fechamento —
    // se o timeout esgotasse antes do usuário fechar, o modal PWA nunca aparecia.
    return new Promise(resolve => {
        const ultima = carregarUltimaVersao();
        if (ultima === VERSAO_ATUAL) { resolve(); return; }

        const div = document.getElementById('whatsnew-content');
        if (div) {
            div.innerHTML = _renderMarkdown(_CHANGELOG_INLINE);
        }
        const modal = document.getElementById('modal-whatsnew');
        if (!modal) { resolve(); return; }

        modal.style.display = 'flex';
        abrirComFoco(modal);

        // Resolve a Promise E salva a versão ao fechar — handler único.
        const _aoFechar = () => {
            salvarUltimaVersao(VERSAO_ATUAL);
            resolve(); // desbloqueia o await no boot
        };

        modal.querySelectorAll('.fechar-whatsnew').forEach(btn => {
            btn.addEventListener('click', _aoFechar, { once: true });
        });
        // Fallback: fechar via Escape dispara sf:whatsnew-fechado
        modal.addEventListener('sf:whatsnew-fechado', _aoFechar, { once: true });
    });
}

// ════════════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    // 0. PWA já iniciado no topo do módulo (registrarSW + iniciarCapturaPWA).
    //    beforeinstallprompt pode disparar antes do DOMContentLoaded —
    //    por isso as chamadas ficam fora deste handler.

    // 1. Tema
    aplicarTemaInicial();
    document.getElementById('btn-tema')?.addEventListener('click', ciclarTema);

    // 2. Firebase: login + pull
    // Nota: o resultado não é mais passado para tentarExibirModalInstalacao()
    // (que agora é independente de auth). initAuth() ainda é necessário para
    // inicializar a sessão e fazer o pull dos dados do Firebase.
    await initAuth();

    // 3. Auth listeners
    initLogoutButton();
    initCloudButton();

    // 4. Confirm modal
    configurarListenersConfirm();

    // 5. Navegação
    iniciarNavegacao();

    // 5.1a Sidebar lateral (v9.9.45)
    iniciarSidebar();
    sidebarSetVersion('v' + VERSAO_ATUAL);

    // 5.1b Escuta SF_OPEN_SIDEBAR enviado pelo iframe da Ficha Técnica
    // quando o usuário clica no botão hambúrguer dentro do iframe.
    // Após abrir/fechar, devolve SF_SIDEBAR_STATE ao iframe para sincronizar
    // o aria-expanded do botão hambúrguer interno.
    window.addEventListener('message', e => {
        if (e.source !== document.getElementById('ft-iframe')?.contentWindow) return;
        if (e.origin !== window.location.origin) return;
        if (e.data?.type !== 'SF_OPEN_SIDEBAR') return;
        abrirSidebar();
        // Notifica o iframe do novo estado (aberto) para atualizar aria-expanded
        const iframe = document.getElementById('ft-iframe');
        iframe?.contentWindow?.postMessage(
            { type: 'SF_SIDEBAR_STATE', open: true },
            window.location.origin
        );
    });

    // Notifica o iframe sempre que a sidebar fechar (via overlay, swipe ou Esc)
    document.addEventListener('sidebarFechou', () => {
        const iframe = document.getElementById('ft-iframe');
        iframe?.contentWindow?.postMessage(
            { type: 'SF_SIDEBAR_STATE', open: false },
            window.location.origin
        );
    });

    // 5.1 Popover de versão no logo
    (function _initLogoVersionPopover() {
        const btn     = document.getElementById('btn-titulo');
        const popover = document.getElementById('logo-ver-popover');
        const verText = document.getElementById('logo-ver-text');
        if (!btn || !popover) return;
        if (verText) verText.textContent = 'v' + VERSAO_ATUAL;
        let _hideTimer = null;
        function _pos() {
            const r = btn.getBoundingClientRect();
            popover.style.top  = (r.bottom + 6) + 'px';
            popover.style.left = r.left + 'px';
        }
        btn.addEventListener('click', () => {
            clearTimeout(_hideTimer);
            if (!popover.hidden) { popover.hidden = true; return; }
            _pos(); popover.hidden = false;
            _hideTimer = setTimeout(() => { popover.hidden = true; }, 3000);
        });
        document.addEventListener('pointerdown', e => {
            if (!popover.hidden && !btn.contains(e.target)) {
                clearTimeout(_hideTimer); popover.hidden = true;
            }
        }, { capture: true, passive: true });
    })();

    // 6. Calendário
    iniciarCalendario(restaurarSnapshot);

    // 6.1 Background
    await initBgUpload();

    // 7. Boot multi-estoque
    // inicializarEstoques() executa migração legada se necessário,
    // garante ≥1 estoque, popula appStore e retorna itens do ativo.
    carregarListaPadrao();
    let dados = inicializarEstoques();
    if (!dados || !Array.isArray(dados) || dados.length === 0) {
        dados = buildDadosPadrao();
        salvarDados(dados);
    }
    renderizarListaCompleta(dados);
    atualizarDropdown();
    atualizarPainelCompras();
    verificarAlertas();

    // 7.1 UI do seletor de estoques
    iniciarMultiEstoque();

    // 8. Swipe + pull-to-refresh + UX premium
    initSwipe();
    initPullRefresh();
    _initRipple();        // micro-interação: ripple em todos os botões
    _initOfflineBanner(); // feedback de conectividade

    // 9–11. Módulos secundários
    iniciarMassa();
    iniciarProducao();
    iniciarListaFacil();

    // 12. Lupa
    iniciarLupa();

    // 13. Microfone
    iniciarMic('filtroBusca', 'btn-mic-busca');
    iniciarMic('novoProduto', 'btn-mic-prod');

    // 14. Scroll
    iniciarScrollBtns();

    // 15. Novidades — await bloqueia até o usuário FECHAR o modal.
    //     mostrarNovidades() retorna uma Promise que só resolve ao fechar
    //     (clique em .fechar-whatsnew ou Escape). Isso garante que o modal
    //     PWA nunca compete com o modal de novidades — sem polling, sem timeout.
    await mostrarNovidades();

    // 16. PWA Install — só chega aqui após o modal de novidades estar fechado
    //     (ou se o usuário já estava na versão atual e o modal não foi exibido).
    //     Não depende de login: mostra para qualquer visitante que ainda não
    //     instalou o atalho (iOS Safari, Android Chrome, Edge, Firefox…)
    tentarExibirModalInstalacao();

    // ── Listeners ─────────────────────────────────────────────────
    document.getElementById('filtroBusca')?.addEventListener('input', aplicarFiltro);
    document.getElementById('filtroSelect')?.addEventListener('change', aplicarFiltro);
    document.querySelectorAll('[data-limpar]').forEach(btn => {
        btn.addEventListener('click', () => {
            const el = document.getElementById(btn.dataset.limpar);
            if (el) { el.value = ''; el.dispatchEvent(new Event('input')); }
        });
    });

    document.getElementById('btn-novo-dia')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, novoDia, 600));
    document.getElementById('btn-exportar')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, () => exportarJSON(VERSAO_ATUAL)));
    document.getElementById('btn-importar')?.addEventListener('click', () => {
        darFeedback(); document.getElementById('input-arquivo')?.click();
    });
    document.getElementById('input-arquivo')?.addEventListener('change', e => {
        importarJSON(e.target.files[0]); e.target.value = '';
    });
    document.getElementById('btn-reset')?.addEventListener('click', restaurarListaPadrao);

    document.getElementById('btn-compartilhar-estoque')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, compartilharEstoque));
    document.getElementById('btn-copiar-estoque')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, () => { darFeedback(); copiarParaClipboard(gerarTextoEstoque()); }));
    document.getElementById('btn-compartilhar-compras')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, () => {
            darFeedback();
            if (navigator.share) return navigator.share({ text: gerarTextoCompras() });
            else copiarParaClipboard(gerarTextoCompras());
        }));
    document.getElementById('btn-copiar-compras')?.addEventListener('click', e =>
        comSpinner(e.currentTarget, () => { darFeedback(); copiarParaClipboard(gerarTextoCompras()); }));

    document.getElementById('add-btn')?.addEventListener('click', adicionarItem);
    document.getElementById('add-star-btn')?.addEventListener('click', adicionarFavorito);
    document.getElementById('remove-star-btn')?.addEventListener('click', removerDoPadrao);
    document.getElementById('novoProduto')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') adicionarItem();
    });

    document.getElementById('modal-calc')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) fecharCalculadora();
    });
    document.querySelector('.calc-close')?.addEventListener('click', fecharCalculadora);
    document.getElementById('novoQtd')?.addEventListener('click', () => {
        abrirCalculadora(document.getElementById('novoQtd'));
    });
    document.getElementById('calc-btn-teclado')?.addEventListener('click', () => {
        const inp = getInputCalculadoraAtual(); fecharCalculadora();
        if (inp) ativarModoTeclado(inp);
    });
    document.querySelectorAll('[data-calc]').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = btn.dataset.calc; if (v === 'OK') calcSalvar(); else calcDigito(v);
        });
    });

    document.getElementById('lista-itens-container')?.addEventListener('change', e => {
        const chk = e.target.closest("input[type='checkbox']");
        if (chk) { alternarCheck(chk); agendarSnapshot(); return; }
        const sel = e.target.closest('select');
        if (sel) { salvarDados(coletarDadosDaTabela()); agendarSnapshot(); atualizarStatusSave(); verificarAlertasDebounced(); }
    });
    document.getElementById('lista-itens-container')?.addEventListener('input', e => {
        const inp = e.target.closest('.input-qtd-tabela');
        if (inp) { salvarDados(coletarDadosDaTabela()); agendarSnapshot(); atualizarStatusSave(); verificarAlertasDebounced(); }
    });
    document.getElementById('lista-itens-container')?.addEventListener('blur', e => {
        const nome = e.target.closest('.nome-prod');
        if (nome) { salvarEAtualizar(); verificarAlertas(); agendarSnapshot(); return; }
        const inp = e.target.closest('.input-qtd-tabela');
        if (inp && !inp.hasAttribute('readonly')) parseAndUpdateQuantity(inp);
    }, true);
    document.getElementById('lista-itens-container')?.addEventListener('dblclick', e => {
        const inp = e.target.closest('.input-qtd-tabela'); if (inp) abrirCalculadora(inp);
    });

    document.getElementById('check-todos')?.addEventListener('change', e => {
        alternarTodos(e.target);
    });
    document.getElementById('filtroSelect')?.addEventListener('touchstart', () => {}, { passive: true });

    document.getElementById('salvar-alerta')?.addEventListener('click', () => {
        darFeedback('medium'); salvarAlerta(); agendarSnapshot();
    });
    document.querySelectorAll('.fechar-modal-alerta').forEach(b =>
        b.addEventListener('click', fecharModalAlerta));
    document.querySelectorAll('.fechar-whatsnew').forEach(b =>
        b.addEventListener('click', () => {
            const el = document.getElementById('modal-whatsnew');
            fecharComFoco(el); el.style.display = 'none';
        }));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            fecharCalendario(); fecharCalculadora();
            const whatsnew = document.getElementById('modal-whatsnew');
            if (whatsnew && whatsnew.style.display !== 'none') {
                fecharComFoco(whatsnew); whatsnew.style.display = 'none';
            }
            return;
        }
        const modalCalc = document.getElementById('modal-calc');
        if (!modalCalc || modalCalc.style.display === 'none') return;
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        const KEY_MAP = {
            '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
            ',':',','.':',','+':'+','-':'-','*':'×','x':'×','X':'×','/':'÷',
            'Backspace':'BACK','Delete':'C','c':'C','C':'C','Enter':'OK',
        };
        const acao = KEY_MAP[e.key];
        if (!acao) return;
        e.preventDefault();
        if (acao === 'OK') calcSalvar(); else calcDigito(acao);
    });

    window.addEventListener('beforeunload', () => {
        salvarDados(coletarDadosDaTabela());
        void fbPushTudo();
    });
});
