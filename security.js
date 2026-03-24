// security.js — StockFlow Pro v9.9.45
// ══════════════════════════════════════════════════════════════════
// Módulo centralizado de sanitização DOM.
//
// CONTEXTO (Relatório de Auditoria v9.9.44 — Recomendação 1):
//   O projeto usa innerHTML amplamente para construir UI dinamicamente.
//   Embora esc() já exista em ft-format.js, a proteção é ad-hoc — cada
//   template precisa lembrar de escapar cada valor individualmente.
//   Um campo esquecido vira vetor de XSS.
//
// ABORDAGEM:
//   Este módulo oferece helpers que tornam o caminho seguro o caminho
//   mais fácil. Em vez de exigir esc() em cada interpolação, os helpers
//   aceitam strings misturadas com marcadores seguros.
//
//   Uso recomendado para novos componentes:
//     import { el, setText, setHTML, safeHTML } from './security.js';
//
// COMPATIBILIDADE:
//   Os templates innerHTML existentes NÃO precisam ser migrados agora —
//   esc() continua funcionando. Este módulo é o padrão para código novo
//   e para refatorações progressivas.
// ══════════════════════════════════════════════════════════════════

// ── Escaping ──────────────────────────────────────────────────────

/**
 * Escapa entidades HTML para uso seguro em contextos de texto.
 * Replica e re-exporta esc() de ft-format.js para que módulos que
 * importam security.js não precisem importar ft-format.js separadamente.
 *
 * @param {*} s — qualquer valor; convertido para string antes de escapar
 * @returns {string}
 */
export function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Escapa uma URL para uso seguro em atributos src/href.
 * Rejeita protocolos javascript:, data: e vbscript:.
 *
 * @param {string} url
 * @returns {string} URL segura ou string vazia se protocolo perigoso
 */
export function escUrl(url) {
    const s = String(url ?? '').trim();
    if (/^(javascript|data|vbscript):/i.test(s)) return '';
    return esc(s);
}

// ── Criação segura de elementos ───────────────────────────────────

/**
 * Cria um elemento DOM com atributos e conteúdo texto seguros.
 * Nunca usa innerHTML — todo conteúdo textual vai para textContent.
 *
 * @param {string} tag — nome da tag HTML
 * @param {Object} [opts]
 * @param {string} [opts.text] — conteúdo de texto (escapado automaticamente)
 * @param {Object} [opts.attrs] — atributos a definir (valores escapados)
 * @param {string[]} [opts.classes] — classes CSS a adicionar
 * @param {Element[]} [opts.children] — elementos filhos a anexar
 * @returns {HTMLElement}
 *
 * @example
 *   const li = el('li', {
 *     text: nomeProduto,
 *     attrs: { 'data-id': item.id, title: item.nome },
 *     classes: ['ft-list-item'],
 *   });
 */
export function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.classes?.length) node.classList.add(...opts.classes);
    if (opts.attrs) {
        for (const [k, v] of Object.entries(opts.attrs)) {
            node.setAttribute(k, String(v ?? ''));
        }
    }
    if (opts.text != null) node.textContent = String(opts.text);
    if (opts.children?.length) opts.children.forEach(c => node.appendChild(c));
    return node;
}

/**
 * Define o texto de um elemento de forma segura (via textContent).
 * Substitui padrões como `el.innerHTML = valor` quando o conteúdo é texto puro.
 *
 * @param {Element} element
 * @param {*} text
 */
export function setText(element, text) {
    if (element) element.textContent = String(text ?? '');
}

// ── innerHTML seguro ──────────────────────────────────────────────

/**
 * Define innerHTML de um elemento aceitando apenas HTML literal (sem dados do usuário).
 * Use esta função para templates HTML estáticos — sinaliza explicitamente
 * que o conteúdo é seguro e não contém dados externos.
 *
 * Para conteúdo com dados dinâmicos, use safeHTML() abaixo.
 *
 * @param {Element} element
 * @param {string} trustedHTML — HTML literal sem interpolações de dados do usuário
 */
export function setTrustedHTML(element, trustedHTML) {
    if (element) element.innerHTML = trustedHTML;
}

/**
 * Gera uma string HTML com interpolações escapadas automaticamente.
 *
 * Uso como tagged template literal:
 *   element.innerHTML = safeHTML`<span class="nome">${nomeUsuario}</span>`;
 *
 * Todos os valores interpolados são escapados com esc() automaticamente.
 * Strings HTML brutas podem ser passadas como objetos { __html: '...' }
 * para indicar explicitamente que são confiáveis.
 *
 * @param {TemplateStringsArray} strings
 * @param {...*} values
 * @returns {string} HTML com valores escapados
 *
 * @example
 *   wrap.innerHTML = safeHTML`
 *     <div class="item" data-id="${item.id}">
 *       <span>${item.nome}</span>
 *       <span>${formatCurrency(item.preco)}</span>
 *     </div>`;
 */
export function safeHTML(strings, ...values) {
    return strings.reduce((acc, str, i) => {
        if (i >= values.length) return acc + str;
        const val = values[i];
        // Aceita { __html: '...' } como marca de conteúdo HTML confiável
        const escaped = (val != null && typeof val === 'object' && '__html' in val)
            ? val.__html
            : esc(val);
        return acc + str + escaped;
    }, '');
}

/**
 * Marca uma string como HTML confiável para uso com safeHTML.
 * Use apenas para:
 *   - Strings retornadas por funções de formatação internas (formatCurrency, ico.*)
 *   - SVG de ícones hardcoded
 *   - HTML gerado internamente sem dados do usuário
 *
 * NUNCA use para dados vindos do Firebase, localStorage ou inputs do usuário.
 *
 * @param {string} html
 * @returns {{ __html: string }}
 *
 * @example
 *   safeHTML`<span>${trusted(ico.check)} ${formatCurrency(valor)}</span>`
 */
export function trusted(html) {
    return { __html: String(html ?? '') };
}

// ── Validação de inputs ───────────────────────────────────────────

/**
 * Normaliza e parseia um número no formato BR (1.500,75 → 1500.75).
 * Retorna null se a string estiver vazia ou não for numérica.
 * Centraliza a lógica de parsing que antes estava duplicada em
 * alerta.js, massa.js e outros módulos.
 *
 * @param {string|null} raw — valor bruto do input
 * @returns {number|null}
 */
export function parseInputBR(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
}

/**
 * Valida se uma URL é segura para uso em src/href de elementos DOM.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
    return escUrl(url) !== '';
}
