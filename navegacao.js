// navegacao.js — StockFlow Pro v9.9.48
// ══════════════════════════════════════════════════════════════════
// CORREÇÃO v9.7.4: scroll para o topo ao trocar de aba.
// ADIÇÃO   v9.7.6: iframe lazy-load + fix getAttribute('src') + ajuste de
//                  altura dinâmico para #fichatecnica-section.
// FEATURE  v9.7.7: menu de abas retrátil.
//   • Botão pill #btn-nav-toggle recolhe/expande #nav-tabs-panel via
//     classe CSS 'nav-collapsed' (max-height + opacity + transition).
//   • Estado persistido em localStorage('navCollapsed').
//   • Indicador de aba ativa exibido quando o menu está recolhido.
//   • Ao trocar de aba com menu recolhido: expande automaticamente,
//     aguarda a transição e então recolhe de volta (UX: o usuário vê
//     para onde navegou antes do menu fechar).
//
// BUG FIX v9.7.6 — _carregarFichaTecnica:
//   iframe.src (propriedade refletida) retorna URL completa da página pai
//   mesmo sem atributo src → sempre truthy → iframe nunca recebia 'ficha-tecnica.html'.
//   Fix: getAttribute('src') retorna null/'' — falsy.
//
// BUG FIX v9.7.6 — _ajustarAlturaSectionFT:
//   dvh não suportado no iOS ≤ 15; cálculo estático não descontava header+tabs.
//   Fix: JS mede getBoundingClientRect().top após rAF e define style.height exato.
//
// FEATURE  v9.8.5: Ficha Técnica como Full-Screen Overlay nativo.
//   • Substitui window.open → ativa #fichatecnica-section.ft-full-overlay.active
//   • Exibe #ft-back-hint (.ft-hint-visible) ao entrar na aba FT.
//   • Oculta o hint e aciona .ft-leaving (transição CSS) ao sair da FT.
//   • _ajustarAlturaSectionFT desativado para a FT (overlay usa inset:0).
//
// FEATURE  v9.8.6: Swipe-Right para voltar da Ficha Técnica.
//   PROBLEMA ARQUITETURAL:
//     O iframe absorve 100% dos eventos touch dentro de seus bounds —
//     listeners em document ou na section não recebem nada com o dedo
//     sobre o iframe. Isso torna impossível usar a abordagem convencional.
//   SOLUÇÃO — Edge Capture Zone (#ft-swipe-edge):
//     Div transparente position:fixed, left:0, width:28px, z-index:1220,
//     acima do iframe. Captura touchstart na borda esquerda. touchmove e
//     touchend são ouvidos no document (propagam mesmo com o dedo fora da edge).
//     Idêntico ao mecanismo de back-gesture do iOS Safari no nível do browser.
//   REGRAS:
//     • Threshold 100px para confirmar o swipe-right.
//     • Flick (velocidade > 0.4 px/ms) confirma mesmo abaixo do threshold.
//     • Durante o arrasto: translateX ao vivo na section (sem transition),
//       dando sensação de "arrastar para fora da tela".
//     • Commit: desliza até translateX(100vw), limpa estilos, atualiza estado.
//     • Cancel: spring back com cubic-bezier suave.
//     • Ativado apenas quando a aba FT está ativa (AbortController).
//     • Desativado ao sair da FT — zero conflito com swipe.js (que opera
//       no #lista-itens-container, invisível enquanto FT cobre a tela).
// ══════════════════════════════════════════════════════════════════
import { darFeedback } from './utils.js';

const NAV_COLLAPSED_KEY = 'navCollapsed';


// ══════════════════════════════════════════════════════════════════
// HELPERS DE OVERLAY FT (v9.8.5)
// ══════════════════════════════════════════════════════════════════

/**
 * Mostra ou oculta o chevron de "swipe para voltar".
 * Controlado pela classe .ft-hint-visible em #ft-back-hint.
 */
function _mostrarBackHint(mostrar) {
    const hint = document.getElementById('ft-back-hint');
    if (!hint) return;
    hint.classList.toggle('ft-hint-visible', mostrar);
}

/**
 * Fecha o overlay da FT com transição CSS de saída (slide para direita).
 * Remove .active após a transição para que display:none não corte a animação.
 */
function _fecharOverlayFT(section) {
    section.classList.add('ft-leaving');
    section.classList.remove('active');
    const cleanup = () => section.classList.remove('ft-leaving');
    section.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 400); // fallback se transitionend não disparar
}


// ══════════════════════════════════════════════════════════════════
// SWIPE-RIGHT PARA VOLTAR (v9.8.6) — Edge Capture Zone
// ══════════════════════════════════════════════════════════════════

/**
 * Cria e gerencia o gesto de swipe-right para voltar da Ficha Técnica.
 *
 * @param {function} onVoltar  Callback executado quando o swipe é confirmado.
 *                             Deve atualizar o estado de abas e UI.
 * @returns {{ ativar: function, desativar: function }}
 */
function _criarSwipeFT(onVoltar) {

    // ── Constantes ─────────────────────────────────────────────────
    const EDGE_WIDTH      = 28;   // px — largura da zona de captura na borda esquerda
    const THRESHOLD_PX    = 100;  // px — deslocamento mínimo para confirmar swipe
    const VEL_THRESHOLD   = 0.40; // px/ms — velocidade mínima para confirmar flick curto
    const DIRECTION_LOCK  = 8;    // px — tolerância antes de decidir H vs V
    const ANIM_DURATION   = 320;  // ms — duração da transição de commit/cancel

    // ── Edge Capture Zone ──────────────────────────────────────────
    // Criada uma única vez; mostrada/ocultada por ativar/desativar.
    const edge = document.createElement('div');
    edge.id = 'ft-swipe-edge';
    edge.setAttribute('aria-hidden', 'true');
    document.body.appendChild(edge);

    // ── Referência à section overlay ──────────────────────────────
    const section = document.getElementById('fichatecnica-section');

    // ── AbortController: desativado ao trocar de aba ───────────────
    let _abort = null;

    // ── Estado do gesto em andamento ──────────────────────────────
    let _startX   = 0;
    let _startY   = 0;
    let _lastX    = 0;
    let _lastT    = 0;
    let _vel      = 0;       // velocidade instantânea em px/ms
    let _dragging = false;   // gesto horizontal confirmado
    let _locked   = false;   // gesto vertical — ignorar este toque
    let _gestureActive = false; // touchstart ocorreu na edge zone

    // ── Helpers de animação ────────────────────────────────────────

    /** Aplica translate ao vivo durante o arrasto (sem transition). */
    function _applyDrag(dx) {
        if (!section) return;
        const clamped = Math.max(0, dx); // só para a direita
        section.style.transition = 'none';
        section.style.transform  = `translateX(${clamped}px)`;
        // Opacidade sutil proporcional ao deslocamento (10% no máximo)
        const progress = Math.min(clamped / window.innerWidth, 1);
        section.style.opacity = String((1 - progress * 0.12).toFixed(3));
    }

    /** Cancela o gesto: seção volta à posição original com spring suave. */
    function _snapBack() {
        if (!section) return;
        section.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94),`
                                 + `opacity ${ANIM_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
        section.style.transform  = 'translateX(0)';
        section.style.opacity    = '1';
        // Limpa estilos inline após a transição para não conflitar com o CSS
        const cleanup = () => {
            if (section.style.transform === 'translateX(0px)' ||
                section.style.transform === 'translateX(0)') {
                section.style.transform  = '';
                section.style.opacity    = '';
                section.style.transition = '';
            }
        };
        section.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, ANIM_DURATION + 60);
    }

    /**
     * Confirma o swipe: desliza a seção para fora (translateX → 100vw),
     * limpa estilos inline e chama onVoltar() para atualizar o estado.
     */
    function _commitSlideOut() {
        if (!section) return;
        darFeedback();
        section.style.transition = `transform ${ANIM_DURATION}ms cubic-bezier(0.42, 0, 1, 1),`
                                 + `opacity ${ANIM_DURATION}ms cubic-bezier(0.42, 0, 1, 1)`;
        section.style.transform  = `translateX(${window.innerWidth}px)`;
        section.style.opacity    = '0';
        setTimeout(() => {
            // Limpa estilos inline — CSS (.ft-full-overlay sem .active) toma conta
            section.style.transform  = '';
            section.style.opacity    = '';
            section.style.transition = '';
            onVoltar();
        }, ANIM_DURATION + 10);
    }

    // ── Ativar: mostra edge zone + registra listeners ──────────────
    function ativar() {
        if (_abort) _abort.abort();
        _abort = new AbortController();
        const { signal } = _abort;

        edge.style.display = 'block';

        // touchstart APENAS na edge zone (ponto de entrada do gesto)
        edge.addEventListener('touchstart', e => {
            _startX = e.touches[0].clientX;
            _startY = e.touches[0].clientY;
            _lastX  = _startX;
            _lastT  = performance.now();
            _vel    = 0;
            _dragging      = false;
            _locked        = false;
            _gestureActive = true;
        }, { passive: true, signal });

        // touchmove no DOCUMENT — continua recebendo eventos mesmo com o dedo
        // sobre o iframe (o gesture já foi iniciado na edge zone)
        document.addEventListener('touchmove', e => {
            if (!_gestureActive) return;
            if (_locked) return;

            const dx = e.touches[0].clientX - _startX;
            const dy = e.touches[0].clientY - _startY;

            if (!_dragging) {
                // Ainda na zona de decisão: aguarda deslocamento suficiente
                if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return;

                if (Math.abs(dy) >= Math.abs(dx)) {
                    // Movimento predominantemente vertical → não é back-swipe
                    _locked = true;
                    return;
                }
                if (dx < 0) {
                    // Swipe para a esquerda → não é back-swipe
                    _locked = true;
                    return;
                }
                // Gesto horizontal para a direita confirmado
                _dragging = true;
            }

            // Calcula velocidade instantânea (px/ms)
            const now = performance.now();
            const dt  = now - _lastT;
            if (dt > 0) _vel = (e.touches[0].clientX - _lastX) / dt;
            _lastX = e.touches[0].clientX;
            _lastT = now;

            // Aplica translate ao vivo (cancela o scroll nativo do browser)
            if (e.cancelable) e.preventDefault();
            _applyDrag(dx);

        }, { passive: false, signal });

        // touchend no DOCUMENT — avalia se confirma ou cancela
        document.addEventListener('touchend', e => {
            if (!_gestureActive || !_dragging) {
                _gestureActive = false;
                return;
            }
            _gestureActive = false;

            const dx = e.changedTouches[0].clientX - _startX;

            // Confirma: deslocamento acima do threshold OU flick veloz
            if (dx > THRESHOLD_PX || _vel > VEL_THRESHOLD) {
                _commitSlideOut();
            } else {
                _snapBack();
            }

            _dragging = false;
            _locked   = false;
        }, { signal });

        // touchcancel: reseta sem animação forçada — apenas snap back suave
        document.addEventListener('touchcancel', () => {
            if (!_gestureActive) return;
            _gestureActive = false;
            _dragging      = false;
            _locked        = false;
            _snapBack();
        }, { passive: true, signal });
    }

    // ── Desativar: remove listeners + oculta edge zone ────────────
    function desativar() {
        if (_abort) { _abort.abort(); _abort = null; }
        _gestureActive = false;
        _dragging      = false;
        _locked        = false;
        edge.style.display = 'none';

        // Garante que nenhum estilo inline fique "preso" se o usuário
        // navegou para fora enquanto um gesto estava em andamento
        if (section) {
            section.style.transform  = '';
            section.style.opacity    = '';
            section.style.transition = '';
        }
    }

    return { ativar, desativar };
}


// ══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════

export function iniciarNavegacao() {
    const tabs     = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    const panel    = document.getElementById('nav-tabs-panel');
    const toggle   = document.getElementById('btn-nav-toggle');
    const ftSection = document.getElementById('fichatecnica-section');

    let _prevTab = 'estoque'; // aba anterior à Ficha Técnica

    // ── Indicador de aba ativa (visível quando menu recolhido) ────
    const indicator = document.createElement('div');
    indicator.id = 'nav-active-indicator';
    indicator.className = 'nav-collapsed-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    if (panel && toggle) {
        toggle.parentNode.insertBefore(indicator, panel);
    }

    function _getActiveTab() {
        return document.querySelector('.nav-tab.active');
    }

    function _atualizarIndicador() {
        const aba = _getActiveTab();
        if (!aba) return;
        const svgOrig   = aba.querySelector('svg.tab-icon');
        const labelOrig = aba.querySelector('.tab-label');
        if (!svgOrig || !labelOrig) return;
        const svg   = svgOrig.cloneNode(true);
        const label = document.createElement('span');
        label.textContent = labelOrig.textContent;
        indicator.innerHTML = '';
        indicator.appendChild(svg);
        indicator.appendChild(label);
    }

    // ── Estado recolhido ──────────────────────────────────────────
    function _isCollapsed() {
        return panel?.classList.contains('nav-collapsed');
    }

    function _setCollapsed(collapsed, save = true) {
        if (!panel || !toggle) return;
        if (collapsed) {
            panel.classList.add('nav-collapsed');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Expandir menu');
            indicator.classList.add('visible');
        } else {
            panel.classList.remove('nav-collapsed');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Recolher menu');
            indicator.classList.remove('visible');
        }
        if (save) {
            try { localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch(e) {}
        }
    }

    (function _restaurarEstado() {
        try {
            const salvo = localStorage.getItem(NAV_COLLAPSED_KEY);
            if (salvo === '1') {
                _setCollapsed(true, false);
                _atualizarIndicador();
            }
        } catch(e) {}
    })();

    if (toggle) {
        toggle.addEventListener('click', () => {
            darFeedback();
            _setCollapsed(!_isCollapsed());
        });
    }

    // ── Lazy-load iframe da Ficha Técnica ─────────────────────────
    let _ftCarregado = false;

    function _carregarFichaTecnica() {
        if (_ftCarregado) return;
        const iframe = document.getElementById('ft-iframe');
        if (!iframe) return;
        const attrSrc = iframe.getAttribute('src');
        if (!attrSrc) iframe.src = 'ficha-tecnica.html';
        _ftCarregado = true;
    }

    // ── _ajustarAlturaSectionFT mantido para eventuais usos externos ──
    function _ajustarAlturaSectionFT() {
        // No-op enquanto a FT usa overlay inset:0 (v9.8.5+).
        // Preservado para compatibilidade com chamadas existentes.
    }

    // ── Voltar da FT programaticamente (via swipe ou botão futuro) ──
    /**
     * Restaura o estado de abas para _prevTab.
     * Chamado tanto pelo swipe-right quanto (futuramente) por um botão de fechar.
     * NÃO aciona _fecharOverlayFT — a animação de saída já foi tratada
     * por _commitSlideOut() antes desta chamada.
     */
    function _voltarDeFT() {
        // Atualiza visual dos botões de aba
        tabs.forEach(t => t.classList.remove('active'));
        const prevBtn = document.querySelector(`.nav-tab[data-tab="${_prevTab}"]`);
        if (prevBtn) prevBtn.classList.add('active');

        // Ativa a section da aba anterior
        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(_prevTab + '-section')?.classList.add('active');

        // Remove .active da FT (o CSS .ft-full-overlay sem .active → display:none)
        ftSection?.classList.remove('active');

        // Oculta hints e indicadores
        _mostrarBackHint(false);
        swipeFT.desativar();
        document.body.classList.remove('ft-overlay-active');
        _atualizarIndicador();

        // Restaura setas de scroll e UI geral
        const scrollArrows = document.querySelector('.scroll-arrows');
        if (scrollArrows) scrollArrows.style.display = '';

        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.dispatchEvent(new CustomEvent('tabChanged', {
            detail: { tab: _prevTab, from: 'fichatecnica', method: 'swipe' }
        }));
    }

    // ── Inicializa o sistema de swipe-right da FT ─────────────────
    const swipeFT = _criarSwipeFT(_voltarDeFT);

    // ── Bottom sheet Receitas ─────────────────────────────────────
    const receitasSheet   = document.getElementById('receitas-sheet');
    const receitasOverlay = document.getElementById('receitas-sheet-overlay');
    const btnTabReceitas  = document.getElementById('btn-tab-receitas');

    /** Subtab ativo dentro de Receitas (massa | producao | fichatecnica) */
    let _receitasSubtab = null;

    function _abrirReceitasSheet() {
        if (!receitasSheet) return;
        receitasSheet.removeAttribute('hidden');
        receitasSheet.setAttribute('aria-hidden', 'false');
        receitasOverlay?.removeAttribute('hidden');
        receitasOverlay?.setAttribute('aria-hidden', 'false');
        btnTabReceitas?.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            receitasSheet.classList.add('open');
            receitasOverlay?.classList.add('open');
        });
        // Foco no primeiro item
        setTimeout(() => receitasSheet.querySelector('.receitas-sheet-item')?.focus(), 320);
    }

    function _fecharReceitasSheet() {
        receitasSheet?.classList.remove('open');
        receitasOverlay?.classList.remove('open');
        btnTabReceitas?.setAttribute('aria-expanded', 'false');
        setTimeout(() => {
            receitasSheet?.setAttribute('hidden', '');
            receitasSheet?.setAttribute('aria-hidden', 'true');
            receitasOverlay?.setAttribute('hidden', '');
            receitasOverlay?.setAttribute('aria-hidden', 'true');
        }, 300);
    }

    /** Activa uma subsecção de receitas (massa|producao|fichatecnica) */
    function _ativarSubtab(subtab) {
        _receitasSubtab = subtab;
        _fecharReceitasSheet();

        // Marca o ícone do sheet como ativo
        receitasSheet?.querySelectorAll('.receitas-sheet-item').forEach(b => {
            b.classList.toggle('active-subtab', b.dataset.subtab === subtab);
        });

        // Ativa a section correspondente
        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(subtab + '-section')?.classList.add('active');

        // Trata Ficha Técnica igual ao handler original
        if (subtab === 'fichatecnica') {
            _carregarFichaTecnica();
            _mostrarBackHint(true);
            swipeFT.ativar();
            document.body.classList.add('ft-overlay-active');
        } else {
            if (ftSection?.classList.contains('active') &&
                !ftSection.classList.contains('ft-leaving')) {
                _fecharOverlayFT(ftSection);
            }
            _mostrarBackHint(false);
            swipeFT.desativar();
            document.body.classList.remove('ft-overlay-active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        document.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: subtab } }));
    }

    // Listeners dos itens do sheet
    receitasSheet?.querySelectorAll('.receitas-sheet-item').forEach(btn => {
        btn.addEventListener('click', () => {
            darFeedback();
            _ativarSubtab(btn.dataset.subtab);
        });
    });

    // Fechar ao clicar no overlay ou pressionar Escape
    receitasOverlay?.addEventListener('click', _fecharReceitasSheet);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && receitasSheet && !receitasSheet.hasAttribute('hidden')) {
            _fecharReceitasSheet();
        }
    });

    // ── Navegação entre abas ──────────────────────────────────────
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // Aba Receitas — abre sheet em vez de navegar diretamente
            if (target === 'receitas') {
                darFeedback();
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                _atualizarIndicador();
                _abrirReceitasSheet();
                return;
            }

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(target + '-section')?.classList.add('active');

            darFeedback();
            _atualizarIndicador();

            if (target === 'fichatecnica') {
                // ── Entrando na FT ────────────────────────────────
                _carregarFichaTecnica();
                _mostrarBackHint(true);
                swipeFT.ativar();
                _prevTab = _prevTab || 'estoque';
                document.body.classList.add('ft-overlay-active');

            } else {
                // ── Saindo da FT (via clique em outra aba) ────────
                if (ftSection?.classList.contains('active') &&
                    !ftSection.classList.contains('ft-leaving')) {
                    _fecharOverlayFT(ftSection);
                }
                _mostrarBackHint(false);
                swipeFT.desativar();
                _prevTab = target;
                document.body.classList.remove('ft-overlay-active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Oculta setas de scroll quando a FT está ativa
            const scrollArrows = document.querySelector('.scroll-arrows');
            if (scrollArrows) {
                scrollArrows.style.display = target === 'fichatecnica' ? 'none' : '';
            }

            document.dispatchEvent(new CustomEvent('tabChanged', {
                detail: { tab: target }
            }));
        });
    });

    // Reavalia ao redimensionar (manto de compatibilidade)
    const _onResize = () => {
        if (ftSection?.classList.contains('active')) {
            requestAnimationFrame(_ajustarAlturaSectionFT);
        }
    };
    window.addEventListener('resize', _onResize, { passive: true });
    window.addEventListener('orientationchange', _onResize, { passive: true });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _onResize, { passive: true });
    }
}
