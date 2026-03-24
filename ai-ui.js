// ai-ui.js — StockFlow Pro · Interface do Assistente IA v1.7
// ══════════════════════════════════════════════════════════════════
// Responsabilidade: FAB flutuante arrastável + modal de chat + painel
// de configuração da API key.
//
// ISOLAMENTO:
//   • Cria todos os elementos DOM dinamicamente — zero alteração em
//     index.html além da tag <script> e <link> do CSS.
//   • Importa apenas:
//       – ai-groq.js (módulo próprio)
//       – store.js     (leitura somente de estoqueItens — zero escrita)
//       – utils.js     (darFeedback — haptic feedback)
//   • Não escreve em nenhum estado externo ao próprio módulo.
//
// SEGURANÇA (segue as convenções do projeto):
//   • Respostas da IA renderizadas com textContent — sem innerHTML com
//     dados externos. Zero risco de XSS com conteúdo da API.
//   • API key exibida como password input — nunca em texto puro no DOM.
// ══════════════════════════════════════════════════════════════════

import {
    enviarMensagem,
    montarContextoEstoque,
    salvarApiKey,
    carregarApiKey,
    removerApiKey,
    apiKeyConfigurada,
    gerarAnaliseAutomatica,
    gerarListaCompras,
} from './ai-groq.js';

import appStore    from './store.js';
import { darFeedback } from './utils.js';

// ── Constantes ────────────────────────────────────────────────────
const LS_POS_KEY    = 'stockflow_ai_btn_pos_v1';
const AI_STUDIO_URL = 'https://console.groq.com/keys';

// Limite de pares de mensagens mantidos no historico.
// llama-3.3-70b-versatile tem janela de ~32k tokens; 20 mensagens (~4k tokens
// de conversa) deixa espaço farto para o prompt do sistema e o contexto de estoque.
// Mensagens mais antigas são descartadas silenciosamente (sliding window).
const MAX_HISTORICO = 20;

// Sugestões de perguntas rápidas
const SUGESTOES = [
    'O que está acabando no estoque?',
    'Sugira uma lista de compras para essa semana.',
    'Quanto de trigo preciso para 100 pizzas?',
    'Quais itens estão abaixo do mínimo?',
];

// ── Estado do módulo ──────────────────────────────────────────────
let historico   = [];   // [{role:'user'|'assistant', content:string}] — formato OpenAI/Groq
let isAberto    = false;
let isCarregando = false;

// ── Referências ao DOM (populadas em _criarDOM) ───────────────────
let elCluster, elBtn, elModal, elOverlay,
    elMsgs, elInput, elSendBtn, elSettingsPanel,
    elKeyInput, elKeyStatus, elSettingsBtn,
    elSugestoes, elLoadingDot, elAcoesRapidas,
    elMicBtn;

// ══════════════════════════════════════════════════════════════════
// CRIAÇÃO DO DOM
// ══════════════════════════════════════════════════════════════════

// _svgHTML — retorna string HTML de SVG pronta para ser usada via innerHTML.
// Padrão idêntico ao index.html do projeto: width e height no tag SVG,
// stroke="currentColor" para herdar a cor do CSS.
// path é sempre literal hardcoded — XSS-safe.
function _svgHTML(path, w = 20, h = 20, vb = '0 0 24 24') {
    // class="icon" é obrigatório — .icon em style.css define overflow:visible e
    // display:inline-block que fazem os SVGs aparecerem em todos os browsers.
    // Padrão idêntico aos 40+ botões do index.html do projeto.
    return `<svg class="icon" width="${w}" height="${h}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function _criarDOM() {
    // ── FAB flutuante ─────────────────────────────────────────────
    elCluster = document.createElement('div');
    elCluster.id = 'ai-float-cluster';

    elBtn = document.createElement('button');
    elBtn.id = 'ai-touch-btn';
    elBtn.setAttribute('aria-label', 'Abrir assistente IA');
    elBtn.setAttribute('title', 'Assistente IA');
    elBtn.innerHTML = _svgHTML('<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>');
    elCluster.appendChild(elBtn);

    // ── Overlay de fundo ──────────────────────────────────────────
    elOverlay = document.createElement('div');
    elOverlay.id = 'ai-chat-overlay';
    elOverlay.setAttribute('aria-hidden', 'true');

    // ── Modal de chat ─────────────────────────────────────────────
    elModal = document.createElement('div');
    elModal.id = 'ai-chat-modal';
    elModal.setAttribute('role', 'dialog');
    elModal.setAttribute('aria-modal', 'true');
    elModal.setAttribute('aria-label', 'Assistente IA');

    // Header
    const header = document.createElement('div');
    header.className = 'ai-chat-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'ai-chat-title-wrap';
    const titleIcon = document.createElement('span');
    titleIcon.className = 'ai-chat-title-icon';
    titleIcon.setAttribute('aria-hidden', 'true');
    titleIcon.innerHTML = _svgHTML('<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>');
    const titleTxt = document.createElement('span');
    titleTxt.className = 'ai-chat-title-text';
    titleTxt.textContent = 'Assistente IA';
    const badge = document.createElement('span');
    badge.className = 'ai-chat-badge';
    badge.textContent = 'Groq';
    titleWrap.append(titleIcon, titleTxt, badge);

    const headerActions = document.createElement('div');
    headerActions.className = 'ai-header-actions';

    // Botão limpar conversa
    const clearBtn = document.createElement('button');
    clearBtn.id = 'ai-btn-clear';
    clearBtn.className = 'ai-icon-btn';
    clearBtn.setAttribute('aria-label', 'Limpar conversa');
    clearBtn.setAttribute('title', 'Limpar conversa');
    clearBtn.innerHTML = _svgHTML('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>');

    // Botão configurações
    elSettingsBtn = document.createElement('button');
    elSettingsBtn.id = 'ai-btn-settings';
    elSettingsBtn.className = 'ai-icon-btn';
    elSettingsBtn.setAttribute('aria-label', 'Configurar API key');
    elSettingsBtn.setAttribute('title', 'Configurações');
    elSettingsBtn.innerHTML = _svgHTML('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');

    // Botão fechar
    const closeBtn = document.createElement('button');
    closeBtn.id = 'ai-btn-close';
    closeBtn.className = 'ai-icon-btn';
    closeBtn.setAttribute('aria-label', 'Fechar assistente');
    closeBtn.innerHTML = _svgHTML('<path d="M18 6L6 18M6 6l12 12"/>');

    headerActions.append(clearBtn, elSettingsBtn, closeBtn);
    header.append(titleWrap, headerActions);

    // Painel de configurações (oculto por padrão)
    elSettingsPanel = document.createElement('div');
    elSettingsPanel.id = 'ai-settings-panel';
    elSettingsPanel.hidden = true;
    elSettingsPanel.setAttribute('aria-label', 'Configuração da API key');

    const keyLabel = document.createElement('label');
    keyLabel.className = 'ai-settings-label';
    keyLabel.textContent = 'Chave da API Groq';
    keyLabel.setAttribute('for', 'ai-key-input');

    // Badge "Chave ativa" — visível quando já existe key configurada
    const keyAtivaBadge = document.createElement('span');
    keyAtivaBadge.id = 'ai-key-ativa-badge';
    keyAtivaBadge.className = 'ai-key-ativa-badge';
    keyAtivaBadge.textContent = 'Chave ativa';
    keyAtivaBadge.hidden = !apiKeyConfigurada();

    // Wrapper relativo para o input + botão olho
    const keyInputWrap = document.createElement('div');
    keyInputWrap.className = 'ai-key-input-wrap';

    elKeyInput = document.createElement('input');
    elKeyInput.type = 'password';
    elKeyInput.id = 'ai-key-input';
    elKeyInput.className = 'ai-key-input';
    elKeyInput.placeholder = apiKeyConfigurada() ? 'Chave ativa — digite para substituir...' : 'Cole sua chave gsk_...';
    elKeyInput.setAttribute('autocomplete', 'off');
    elKeyInput.setAttribute('spellcheck', 'false');
    // SEGURANÇA: não pré-preencher o campo com a chave real — o valor ficaria
    // acessível via .value por qualquer extensão de browser ou script de terceiro.
    // O placeholder contextual já comunica ao usuário que existe uma chave ativa.
    // elKeyInput.value é deixado vazio intencionalmente.

    // Botão mostrar/ocultar chave
    const toggleKeyBtn = document.createElement('button');
    toggleKeyBtn.id = 'ai-btn-toggle-key';
    toggleKeyBtn.className = 'ai-btn-toggle-key';
    toggleKeyBtn.setAttribute('type', 'button');
    toggleKeyBtn.setAttribute('aria-label', 'Mostrar chave');
    toggleKeyBtn.setAttribute('title', 'Mostrar/ocultar chave');
    // Ícones como strings — innerHTML é o padrão confiável do projeto
    const icoOlhoStr     = _svgHTML('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', 16, 16);
    const icoOlhoFechStr = _svgHTML('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>', 16, 16);
    toggleKeyBtn.innerHTML = icoOlhoStr;
    let keyVisivel = false;
    toggleKeyBtn.addEventListener('click', () => {
        keyVisivel = !keyVisivel;
        elKeyInput.type = keyVisivel ? 'text' : 'password';
        toggleKeyBtn.innerHTML = keyVisivel ? icoOlhoFechStr : icoOlhoStr;
        toggleKeyBtn.setAttribute('aria-label', keyVisivel ? 'Ocultar chave' : 'Mostrar chave');
        darFeedback(1);
    });

    keyInputWrap.append(elKeyInput, toggleKeyBtn);

    const keyLink = document.createElement('a');
    keyLink.href = AI_STUDIO_URL;
    keyLink.target = '_blank';
    keyLink.rel = 'noopener noreferrer';
    keyLink.className = 'ai-key-link';
    keyLink.textContent = '→ Obter chave gratuita no Groq Console';

    const keyActions = document.createElement('div');
    keyActions.className = 'ai-key-actions';

    const saveKeyBtn = document.createElement('button');
    saveKeyBtn.id = 'ai-btn-save-key';
    saveKeyBtn.className = 'ai-btn-primary';
    saveKeyBtn.textContent = 'Salvar chave';

    const removeKeyBtn = document.createElement('button');
    removeKeyBtn.id = 'ai-btn-remove-key';
    removeKeyBtn.className = 'ai-btn-ghost ai-btn-danger';
    removeKeyBtn.textContent = 'Remover';

    keyActions.append(saveKeyBtn, removeKeyBtn);

    elKeyStatus = document.createElement('p');
    elKeyStatus.id = 'ai-key-status';
    elKeyStatus.className = 'ai-key-status';
    elKeyStatus.setAttribute('role', 'status');
    elKeyStatus.setAttribute('aria-live', 'polite');

    elSettingsPanel.append(keyLabel, keyAtivaBadge, keyInputWrap, keyLink, keyActions, elKeyStatus);

    // Área de mensagens
    elMsgs = document.createElement('div');
    elMsgs.id = 'ai-messages';
    elMsgs.setAttribute('role', 'log');
    elMsgs.setAttribute('aria-live', 'polite');
    elMsgs.setAttribute('aria-label', 'Conversa com o assistente IA');

    // Dot de loading (injetado dentro de elMsgs quando necessário)
    elLoadingDot = document.createElement('div');
    elLoadingDot.className = 'ai-loading-bubble';
    elLoadingDot.setAttribute('aria-label', 'Assistente digitando');
    elLoadingDot.setAttribute('role', 'status');
    for (let i = 0; i < 3; i++) {
        const d = document.createElement('span');
        d.className = 'ai-dot';
        elLoadingDot.appendChild(d);
    }

    // Sugestões rápidas — retráteis
    elSugestoes = document.createElement('div');
    elSugestoes.id = 'ai-sugestoes';
    elSugestoes.setAttribute('aria-label', 'Perguntas sugeridas');

    // Cabeçalho toggle
    const sugestoesToggle = document.createElement('button');
    sugestoesToggle.className = 'ai-sugestoes-toggle';
    sugestoesToggle.setAttribute('aria-expanded', 'false');
    sugestoesToggle.setAttribute('aria-controls', 'ai-sugestoes-chips');
    sugestoesToggle.setAttribute('type', 'button');

    const sugestoesLabel = document.createElement('span');
    sugestoesLabel.className = 'ai-sugestoes-label';
    sugestoesLabel.textContent = 'Sugestões';

    const _chevWrap = document.createElement('span');
    _chevWrap.innerHTML = _svgHTML('<polyline points="6 9 12 15 18 9"/>', 16, 16);
    const sugestoesChevron = _chevWrap.firstElementChild;
    sugestoesChevron.classList.add('ai-sugestoes-chevron');

    sugestoesToggle.append(sugestoesLabel, sugestoesChevron);

    // Conteúdo colapsável
    const sugestoesChips = document.createElement('div');
    sugestoesChips.className = 'ai-sugestoes-chips';
    sugestoesChips.id = 'ai-sugestoes-chips';

    SUGESTOES.forEach(texto => {
        const chip = document.createElement('button');
        chip.className = 'ai-chip';
        chip.textContent = texto; // textContent — sem dados externos
        chip.addEventListener('click', () => {
            elInput.value = texto;
            elInput.focus();
            _autoResize();
            // Colapsa após escolher
            elSugestoes.classList.remove('ai-sugestoes--expandido');
            sugestoesToggle.setAttribute('aria-expanded', 'false');
        });
        sugestoesChips.appendChild(chip);
    });

    sugestoesToggle.addEventListener('click', () => {
        const expandido = elSugestoes.classList.toggle('ai-sugestoes--expandido');
        sugestoesToggle.setAttribute('aria-expanded', String(expandido));
        darFeedback(1);
    });

    elSugestoes.append(sugestoesToggle, sugestoesChips);

    // Prompt de "sem key"
    const noKeyPrompt = document.createElement('div');
    noKeyPrompt.id = 'ai-no-key-prompt';
    noKeyPrompt.hidden = false; // começa visível; _atualizarEstadoKey() esconde se key já existir

    const noKeyIcon = document.createElement('div');
    noKeyIcon.className = 'ai-no-key-icon';
    noKeyIcon.setAttribute('aria-hidden', 'true');
    noKeyIcon.innerHTML = _svgHTML('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');

    const noKeyTitle = document.createElement('p');
    noKeyTitle.className = 'ai-no-key-title';
    noKeyTitle.textContent = 'Configure sua chave de API';

    const noKeyDesc = document.createElement('p');
    noKeyDesc.className = 'ai-no-key-desc';
    noKeyDesc.textContent = 'O Groq é gratuito e sem restrição de região. Basta criar uma chave no Groq Console e colar aqui.';

    const noKeyBtn = document.createElement('button');
    noKeyBtn.className = 'ai-btn-primary';
    noKeyBtn.textContent = 'Configurar agora';
    noKeyBtn.addEventListener('click', _abrirSettings);

    noKeyPrompt.append(noKeyIcon, noKeyTitle, noKeyDesc, noKeyBtn);

    // Barra de ações rápidas — Reanalisar + Lista de Compras
    elAcoesRapidas = document.createElement('div');
    elAcoesRapidas.id = 'ai-acoes-rapidas';
    elAcoesRapidas.hidden = true; // visível só após key configurada

    const btnReanalisar = document.createElement('button');
    btnReanalisar.id = 'ai-btn-reanalisar';
    btnReanalisar.className = 'ai-acao-btn';
    btnReanalisar.setAttribute('title', 'Reanalisar estoque agora');
    btnReanalisar.setAttribute('aria-label', 'Reanalisar estoque');
    btnReanalisar.innerHTML = _svgHTML('<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>') + '<span>Reanalisar</span>';

    const btnListaCompras = document.createElement('button');
    btnListaCompras.id = 'ai-btn-lista-compras';
    btnListaCompras.className = 'ai-acao-btn ai-acao-btn--destaque';
    btnListaCompras.setAttribute('title', 'Gerar lista de compras com IA');
    btnListaCompras.setAttribute('aria-label', 'Gerar lista de compras');
    btnListaCompras.innerHTML = _svgHTML('<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>') + '<span>Lista de Compras</span>';

    elAcoesRapidas.append(btnReanalisar, btnListaCompras);

    // Área de input
    const inputRow = document.createElement('div');
    inputRow.className = 'ai-input-row';

    // Wrapper relativo para posicionar o microfone sobre o textarea
    const inputWrap = document.createElement('div');
    inputWrap.className = 'ai-input-wrap';

    elInput = document.createElement('textarea');
    elInput.id = 'ai-user-input';
    elInput.className = 'ai-user-input';
    elInput.placeholder = 'Pergunte sobre o estoque...';
    elInput.setAttribute('rows', '1');
    elInput.setAttribute('aria-label', 'Mensagem para o assistente');
    elInput.setAttribute('autocorrect', 'off');
    elInput.setAttribute('spellcheck', 'false');

    // Botão de microfone — inserido condicionalmente se API suportada
    elMicBtn = document.createElement('button');
    elMicBtn.id = 'ai-mic-btn';
    elMicBtn.className = 'ai-mic-btn';
    elMicBtn.setAttribute('type', 'button');
    elMicBtn.setAttribute('aria-label', 'Ativar reconhecimento de voz');
    elMicBtn.setAttribute('title', 'Falar pergunta');
    elMicBtn.innerHTML = _svgHTML('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>');

    // Oculta o botão se SpeechRecognition não for suportado
    const temVoz = ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    elMicBtn.hidden = !temVoz;
    // Ajusta padding do textarea para dar espaço ao mic quando suportado
    if (temVoz) elInput.classList.add('ai-user-input--com-mic');

    inputWrap.append(elInput, elMicBtn);

    elSendBtn = document.createElement('button');
    elSendBtn.id = 'ai-send-btn';
    elSendBtn.className = 'ai-send-btn';
    elSendBtn.setAttribute('aria-label', 'Enviar mensagem');
    elSendBtn.innerHTML = _svgHTML('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>');

    inputRow.append(inputWrap, elSendBtn);

    // Monta o modal
    // elSugestoes fica DENTRO de elMsgs — faz parte do fluxo da conversa,
    // não da barra inferior. Assim não sobrepõe elAcoesRapidas.
    elMsgs.appendChild(elSugestoes);

    elModal.append(
        header,
        elSettingsPanel,
        elMsgs,
        noKeyPrompt,
        elAcoesRapidas,
        inputRow
    );

    // Injeta no documento
    document.body.appendChild(elCluster);
    document.body.appendChild(elOverlay);
    document.body.appendChild(elModal);
}

// ══════════════════════════════════════════════════════════════════
// OPEN / CLOSE
// ══════════════════════════════════════════════════════════════════

function _abrirChat() {
    darFeedback();
    isAberto = true;
    elModal.classList.add('ai-modal--open');
    elOverlay.classList.add('ai-overlay--open');
    document.body.classList.add('ai-chat-is-open');
    _atualizarEstadoKey();

    // Análise automática na primeira abertura — chama o Groq com o estoque atual
    if (historico.length === 0 && apiKeyConfigurada()) {
        _executarAnaliseAutomatica();
    }

    // Foca o input após animação
    if (apiKeyConfigurada()) {
        setTimeout(() => elInput?.focus(), 320);
    }

    _scrollMsgsParaBaixo();
}

/**
 * Chama gerarAnaliseAutomatica() e exibe o resultado no chat.
 * Mostra loading durante a chamada. Em caso de erro, cai para
 * mensagem de boas-vindas estática — nunca deixa o chat travado.
 */
async function _executarAnaliseAutomatica() {
    const itens = appStore.get('estoqueItens') || [];

    // Sem itens: boas-vindas genérica sem chamar a API
    if (itens.length === 0) {
        _adicionarMensagemBot(
            'Olá! Sou o assistente IA do StockFlow. ' +
            'Ainda não há itens no estoque. Adicione produtos e vou analisá-los pra você!'
        );
        return;
    }

    // Bloqueia input durante análise inicial
    isCarregando = true;
    _atualizarEstadoKey();
    _mostrarLoading();

    try {
        const analise = await gerarAnaliseAutomatica(itens);

        // Registra no histórico como se o usuário tivesse pedido a análise
        // (o contexto do estoque já foi embutido no prompt interno)
        historico.push({ role: 'user',      content: '[análise automática ao abrir]' });
        historico.push({ role: 'assistant', content: analise });

        _adicionarMensagemBot(analise);
    } catch {
        // Falha silenciosa: exibe boas-vindas estática e libera o chat normalmente
        _adicionarMensagemBot(
            'Olá! Sou o assistente IA do StockFlow. ' +
            'Posso analisar seu estoque, sugerir compras e responder dúvidas. ' +
            'Como posso ajudar?'
        );
    } finally {
        isCarregando = false;
        _atualizarEstadoKey();
    }
}

function _fecharChat() {
    isAberto = false;
    elModal.classList.remove('ai-modal--open');
    elOverlay.classList.remove('ai-overlay--open');
    document.body.classList.remove('ai-chat-is-open');
    // Fecha settings se estiver aberto
    elSettingsPanel.hidden = true;
    elSettingsBtn.classList.remove('ai-icon-btn--active');
}

function _toggleChat() {
    isAberto ? _fecharChat() : _abrirChat();
}

// ── Settings ──────────────────────────────────────────────────────

function _abrirSettings() {
    elSettingsPanel.hidden = false;
    elSettingsBtn.classList.add('ai-icon-btn--active');

    const temKey = apiKeyConfigurada();
    // Atualiza badge de chave ativa
    const badge = document.getElementById('ai-key-ativa-badge');
    if (badge) badge.hidden = !temKey;
    // Placeholder contextual: dica diferente se já tem chave
    elKeyInput.placeholder = temKey ? 'Chave ativa — digite para substituir...' : 'Cole sua chave gsk_...';
    // SEGURANÇA: não pré-preencher — chave real não deve ficar exposta no DOM.
    elKeyInput.value = '';
    elKeyInput.focus();
}

function _fecharSettings() {
    elSettingsPanel.hidden = true;
    elSettingsBtn.classList.remove('ai-icon-btn--active');
    elKeyStatus.textContent = '';
}

function _toggleSettings() {
    elSettingsPanel.hidden ? _abrirSettings() : _fecharSettings();
}

// ── Estado da key ─────────────────────────────────────────────────

function _atualizarEstadoKey() {
    const temKey = apiKeyConfigurada();
    const noKeyEl = document.getElementById('ai-no-key-prompt');
    if (noKeyEl) noKeyEl.hidden = temKey;
    if (elSugestoes)    elSugestoes.hidden    = !temKey;
    if (elAcoesRapidas) elAcoesRapidas.hidden = !temKey || isCarregando;
    if (elInput)     elInput.disabled = !temKey || isCarregando;
    if (elSendBtn)   elSendBtn.disabled = !temKey || isCarregando;
    // Sincroniza badge de chave ativa no painel de settings
    const badge = document.getElementById('ai-key-ativa-badge');
    if (badge) badge.hidden = !temKey;
}

// ══════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════

function _adicionarMensagemUsuario(texto) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--user';

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.textContent = texto; // textContent — dado do usuário, sem risco de XSS

    wrap.appendChild(bubble);
    elMsgs.appendChild(wrap);
    _scrollMsgsParaBaixo();
}

function _adicionarMensagemBot(texto) {
    // Remove loading se presente
    elLoadingDot.remove();

    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--bot';

    const avatar = document.createElement('div');
    avatar.className = 'ai-bot-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = _svgHTML('<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>');

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';

    // Renderiza texto com suporte a quebras de linha — sem innerHTML com dados externos
    // Usamos nós de texto + <br> para segurança
    const linhas = texto.split('\n');
    linhas.forEach((linha, i) => {
        bubble.appendChild(document.createTextNode(linha));
        if (i < linhas.length - 1) bubble.appendChild(document.createElement('br'));
    });

    wrap.append(avatar, bubble);
    elMsgs.appendChild(wrap);
    _scrollMsgsParaBaixo();
}

function _adicionarMensagemErro(textoErro) {
    elLoadingDot.remove();

    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--bot ai-msg--erro';

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble ai-bubble--erro';
    bubble.textContent = '⚠️ ' + textoErro; // textContent — dado de erro interno, sem XSS

    wrap.appendChild(bubble);
    elMsgs.appendChild(wrap);
    _scrollMsgsParaBaixo();
}

function _mostrarLoading() {
    elMsgs.appendChild(elLoadingDot);
    _scrollMsgsParaBaixo();
}

function _scrollMsgsParaBaixo() {
    requestAnimationFrame(() => {
        elMsgs.scrollTop = elMsgs.scrollHeight;
    });
}

async function _enviarMensagem() {
    const texto = elInput.value.trim();
    if (!texto || isCarregando || !apiKeyConfigurada()) return;

    darFeedback();
    isCarregando = true;
    _atualizarEstadoKey();
    elInput.value = '';
    _autoResize();

    // Monta contexto do estoque
    const itens = appStore.get('estoqueItens');
    const contexto = montarContextoEstoque(itens);

    // Adiciona ao histórico — o contexto é injetado apenas na primeira mensagem
    // ou periodicamente para manter o contexto do Groq atualizado
    const textoComContexto = historico.length === 0 && contexto
        ? texto + contexto
        : texto;

    historico.push({ role: 'user', content: textoComContexto });
    // Sliding window: descarta mensagens antigas para não exceder a janela de contexto
    // do modelo (~32k tokens). Mantém as MAX_HISTORICO mais recentes.
    if (historico.length > MAX_HISTORICO) {
        historico = historico.slice(historico.length - MAX_HISTORICO);
    }
    _adicionarMensagemUsuario(texto); // exibe apenas o texto limpo
    _mostrarLoading();

    try {
        const resposta = await enviarMensagem(historico);
        historico.push({ role: 'assistant', content: resposta });
        _adicionarMensagemBot(resposta);
    } catch (err) {
        // Remove a mensagem com erro do histórico para não poluir o contexto
        historico.pop();
        _adicionarMensagemErro(err.message || 'Erro desconhecido. Tente novamente.');
    } finally {
        isCarregando = false;
        _atualizarEstadoKey();
        elInput.focus();
    }
}

// ══════════════════════════════════════════════════════════════════
// AÇÕES RÁPIDAS
// ══════════════════════════════════════════════════════════════════

/**
 * Reanalisar estoque a qualquer momento (botão "Reanalisar").
 * Difere de _executarAnaliseAutomatica: pode ser chamada após
 * o histórico já ter mensagens — adiciona ao contexto existente.
 */
async function _executarAnaliseAgora() {
    if (isCarregando || !apiKeyConfigurada()) return;

    const itens = appStore.get('estoqueItens') || [];
    if (itens.length === 0) {
        _adicionarMensagemUsuario('Reanalisar estoque');
        _adicionarMensagemBot('O estoque está vazio. Adicione produtos primeiro!');
        return;
    }

    isCarregando = true;
    _atualizarEstadoKey();

    // Exibe como ação do usuário
    _adicionarMensagemUsuario('Reanalisar estoque agora');
    historico.push({ role: 'user', content: 'Faça uma nova análise do estoque atual.' });
    _mostrarLoading();

    try {
        const analise = await gerarAnaliseAutomatica(itens);
        historico.push({ role: 'assistant', content: analise });
        _adicionarMensagemBot(analise);
    } catch (err) {
        historico.pop();
        _adicionarMensagemErro(err.message || 'Erro ao analisar. Tente novamente.');
    } finally {
        isCarregando = false;
        _atualizarEstadoKey();
    }
}

/**
 * Gera lista de compras inteligente via Groq (botão "Lista de Compras").
 * Exibe resultado no chat com botão de copiar integrado na bolha.
 */
async function _executarListaCompras() {
    if (isCarregando || !apiKeyConfigurada()) return;

    const itens = appStore.get('estoqueItens') || [];
    if (itens.length === 0) {
        _adicionarMensagemUsuario('Gerar lista de compras');
        _adicionarMensagemBot('O estoque está vazio. Adicione produtos primeiro!');
        return;
    }

    isCarregando = true;
    _atualizarEstadoKey();

    _adicionarMensagemUsuario('Gerar lista de compras inteligente');
    historico.push({ role: 'user', content: 'Gere uma lista de compras para a pizzaria com base no estoque atual.' });
    _mostrarLoading();

    try {
        const lista = await gerarListaCompras(itens);
        historico.push({ role: 'assistant', content: lista });
        _adicionarMensagemBotComCopiar(lista);
    } catch (err) {
        historico.pop();
        _adicionarMensagemErro(err.message || 'Erro ao gerar lista. Tente novamente.');
    } finally {
        isCarregando = false;
        _atualizarEstadoKey();
    }
}

/**
 * Versão especial de _adicionarMensagemBot com botão "Copiar" embutido.
 * Usada para respostas estruturadas como a lista de compras.
 */
function _adicionarMensagemBotComCopiar(texto) {
    elLoadingDot.remove();

    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ai-msg--bot';

    const avatar = document.createElement('div');
    avatar.className = 'ai-bot-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.innerHTML = _svgHTML('<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>');

    const col = document.createElement('div');
    col.className = 'ai-msg-col';

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    const linhas = texto.split('\n');
    linhas.forEach((linha, i) => {
        bubble.appendChild(document.createTextNode(linha));
        if (i < linhas.length - 1) bubble.appendChild(document.createElement('br'));
    });

    // Botão copiar — usa copiarParaClipboard se disponível, fallback para clipboard API
    const btnCopiar = document.createElement('button');
    btnCopiar.className = 'ai-btn-copiar';
    btnCopiar.setAttribute('aria-label', 'Copiar lista');
    btnCopiar.setAttribute('title', 'Copiar lista');
    btnCopiar.innerHTML = _svgHTML('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>') + '<span>Copiar lista</span>';
    const spanCopiar = btnCopiar.querySelector('span');

    btnCopiar.addEventListener('click', () => {
        navigator.clipboard?.writeText(texto).then(() => {
            spanCopiar.textContent = '✓ Copiado!';
            btnCopiar.classList.add('ai-btn-copiar--ok');
            setTimeout(() => {
                spanCopiar.textContent = 'Copiar lista';
                btnCopiar.classList.remove('ai-btn-copiar--ok');
            }, 2000);
        }).catch(() => {
            spanCopiar.textContent = 'Erro ao copiar';
        });
        darFeedback();
    });

    col.append(bubble, btnCopiar);
    wrap.append(avatar, col);
    elMsgs.appendChild(wrap);
    _scrollMsgsParaBaixo();
}

function _limparConversa() {
    historico = [];
    // NÃO usar innerHTML = '' — destruiria elSugestoes (filho de elMsgs),
    // deixando a variável de módulo apontando para nó desconectado do DOM.
    // Fix: remover apenas bolhas de mensagem, preservando elSugestoes e elLoadingDot.
    Array.from(elMsgs.children).forEach(child => {
        if (child !== elSugestoes && child !== elLoadingDot) {
            elMsgs.removeChild(child);
        }
    });
    _atualizarEstadoKey();
}

// ══════════════════════════════════════════════════════════════════
// DRAG — Mesmo padrão do search.js (lupa flutuante)
// ══════════════════════════════════════════════════════════════════

function _iniciarDrag() {
    // Restaura posição salva
    const pos = _carregarPosicao();
    if (pos) {
        // Zerar left/top explicitamente: durante um drag anterior o elemento
        // pode ter sido posicionado via left/top. Se não forem zerados, o
        // browser aplica ambos (left+right ou top+bottom simultaneamente),
        // causando posição incorreta — especialmente após troca de orientação.
        elCluster.style.top    = 'auto';
        elCluster.style.left   = 'auto';
        elCluster.style.right  = pos.right  + 'px';
        elCluster.style.bottom = pos.bottom + 'px';
    }

    let isDragging = false, startX, startY, elX, elY, touchMoved = false;

    elBtn.addEventListener('touchstart', e => {
        isDragging = false;
        touchMoved = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        const rect = elCluster.getBoundingClientRect();
        elX = rect.left;
        elY = rect.top;
    }, { passive: true });

    elBtn.addEventListener('touchmove', e => {
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isDragging = true;
            touchMoved = true;
        }
        if (isDragging) {
            const novoX = Math.max(0, Math.min(window.innerWidth  - 60, elX + dx));
            const novoY = Math.max(0, Math.min(window.innerHeight - 60, elY + dy));
            elCluster.style.bottom = 'auto';
            elCluster.style.right  = 'auto';
            elCluster.style.left   = novoX + 'px';
            elCluster.style.top    = novoY + 'px';
        }
    }, { passive: true });

    elBtn.addEventListener('touchend', e => {
        e.preventDefault();
        if (!touchMoved) {
            _toggleChat();
        } else {
            // Salva posição em formato right/bottom para ser resiliente a resize
            const rect = elCluster.getBoundingClientRect();
            _salvarPosicao({
                right:  window.innerWidth  - rect.right,
                bottom: window.innerHeight - rect.bottom,
            });
        }
        isDragging = false;
    });

    // Click para desktop
    elBtn.addEventListener('click', _toggleChat);
}

function _salvarPosicao(pos) {
    try { localStorage.setItem(LS_POS_KEY, JSON.stringify(pos)); } catch { /* quota */ }
}

function _carregarPosicao() {
    try {
        const raw = localStorage.getItem(LS_POS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════
// INPUT — Auto-resize do textarea
// ══════════════════════════════════════════════════════════════════

function _autoResize() {
    if (!elInput) return;
    elInput.style.height = 'auto';
    elInput.style.height = Math.min(elInput.scrollHeight, 120) + 'px';
}

// ══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════

function _configurarListeners() {
    // Fechar ao clicar no overlay
    elOverlay.addEventListener('click', _fecharChat);

    // Botão fechar
    document.getElementById('ai-btn-close')
        ?.addEventListener('click', () => { darFeedback(); _fecharChat(); });

    // Botão limpar conversa
    document.getElementById('ai-btn-clear')
        ?.addEventListener('click', () => { darFeedback(); _limparConversa(); });

    // Toggle settings
    elSettingsBtn?.addEventListener('click', () => { darFeedback(); _toggleSettings(); });

    // Salvar API key
    document.getElementById('ai-btn-save-key')?.addEventListener('click', () => {
        const key = elKeyInput.value.trim();
        if (!key || key.length < 10) {
            elKeyStatus.textContent = 'Chave inválida. Verifique e tente novamente.';
            elKeyStatus.className = 'ai-key-status ai-key-status--erro';
            return;
        }
        salvarApiKey(key);
        darFeedback();

        // Fecha o painel IMEDIATAMENTE e atualiza o estado de uma vez
        // (evita janela inconsistente entre salvar e o antigo setTimeout de 800ms)
        _fecharSettings();
        _atualizarEstadoKey();

        // Mostra boas-vindas se for a primeira configuração
        if (historico.length === 0) {
            _adicionarMensagemBot(
                'Chave configurada! Agora posso ajudar com o seu estoque. O que deseja saber?'
            );
        }

        // Foca o input de mensagem
        setTimeout(() => elInput?.focus(), 80);
    });

    // Remover API key
    document.getElementById('ai-btn-remove-key')?.addEventListener('click', () => {
        removerApiKey();
        elKeyInput.value = '';
        elKeyStatus.textContent = 'Chave removida.';
        elKeyStatus.className = 'ai-key-status';
        darFeedback();
        _atualizarEstadoKey();
    });

    // Input: Enter envia, Shift+Enter nova linha
    elInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            _enviarMensagem();
        }
    });

    // Auto-resize do textarea
    elInput.addEventListener('input', _autoResize);

    // Botão enviar
    elSendBtn.addEventListener('click', () => _enviarMensagem());

    // Botão reanalisar estoque
    document.getElementById('ai-btn-reanalisar')?.addEventListener('click', () => {
        darFeedback();
        _executarAnaliseAgora();
    });

    // Botão lista de compras IA
    document.getElementById('ai-btn-lista-compras')?.addEventListener('click', () => {
        darFeedback();
        _executarListaCompras();
    });

    // Fechar com Escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isAberto) _fecharChat();
    });
}

// ══════════════════════════════════════════════════════════════════
// RECONHECIMENTO DE VOZ
// ══════════════════════════════════════════════════════════════════

/**
 * Inicializa o SpeechRecognition para o textarea do chat.
 * Segue exatamente o mesmo padrão de iniciarMic() em main.js.
 * Não lança exceções — falhas são silenciosas para não bloquear o chat.
 */
function _iniciarVoz() {
    if (!elMicBtn) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { elMicBtn.hidden = true; return; }

    const rec = new SR();
    rec.lang            = 'pt-BR';
    rec.interimResults  = true;   // exibe texto parcial enquanto fala
    rec.maxAlternatives = 1;
    rec.continuous      = false;

    let ouvindo = false;

    elMicBtn.addEventListener('click', () => {
        if (isCarregando || !apiKeyConfigurada()) return;
        darFeedback();
        if (ouvindo) {
            try { rec.stop(); } catch { /* já parou */ }
        } else {
            elInput.value = '';
            _autoResize();
            elInput.placeholder = 'Ouvindo...';
            try { rec.start(); } catch { /* sem permissão ou já ativo */ }
        }
    });

    rec.onstart = () => {
        ouvindo = true;
        elMicBtn.classList.add('ai-mic-ouvindo');
        elMicBtn.setAttribute('aria-label', 'Parar gravação');
        elInput.disabled = true;
        elSendBtn.disabled = true;
    };

    rec.onresult = e => {
        // Exibe resultado parcial (interimResults=true) em tempo real
        const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join('');
        elInput.value = transcript;
        _autoResize();
    };

    rec.onend = () => {
        ouvindo = false;
        elMicBtn.classList.remove('ai-mic-ouvindo');
        elMicBtn.setAttribute('aria-label', 'Ativar reconhecimento de voz');
        elInput.placeholder = 'Pergunte sobre o estoque...';
        elInput.disabled = false;
        elSendBtn.disabled = false;

        // Se captou algo, envia automaticamente após 400ms
        // (tempo para o usuário ver o que foi transcrito)
        const texto = elInput.value.trim();
        if (texto) {
            setTimeout(() => {
                if (elInput.value.trim()) _enviarMensagem();
            }, 400);
        }
    };

    rec.onerror = e => {
        ouvindo = false;
        elMicBtn.classList.remove('ai-mic-ouvindo');
        elMicBtn.setAttribute('aria-label', 'Ativar reconhecimento de voz');
        elInput.placeholder = 'Pergunte sobre o estoque...';
        elInput.disabled = false;
        elSendBtn.disabled = false;

        // Erros esperados: 'no-speech' (silêncio), 'aborted' (cancelado)
        // Erros reais: 'not-allowed' (sem permissão) — mostra feedback visual
        if (e.error === 'not-allowed') {
            elMicBtn.hidden = true; // esconde se sem permissão permanente
        }
    };
}

// ══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════════════════════════

function init() {
    _criarDOM();
    _iniciarDrag();
    _configurarListeners();
    _iniciarVoz();
    _atualizarEstadoKey();
}

// Inicializa assim que o DOM estiver pronto — sem depender do main.js
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
