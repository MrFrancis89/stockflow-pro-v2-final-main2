// ai-groq.js — StockFlow Pro · Módulo IA Groq v2.2
// ══════════════════════════════════════════════════════════════════
// v2.0 — Migração Gemini → Groq.
// v2.1 — gerarAnaliseAutomatica(), gerarListaCompras(), modo voz.
// v2.2 — Refatoração CS-10: bloco fetch centralizado em _callGroq().
//         Elimina triplicação de ~30 linhas entre as 3 funções públicas.
//         API pública idêntica — nenhum outro módulo precisa mudar.
//
// API Groq — compatível com OpenAI:
//   Endpoint : https://api.groq.com/openai/v1/chat/completions
//   Auth     : Authorization: Bearer {key}
//   Modelo   : llama-3.3-70b-versatile (gratuito, rápido, multilíngue)
//   Formato  : [{role:'system'|'user'|'assistant', content: string}]
//
// ISOLAMENTO: este arquivo não importa nada do restante do projeto.
// SEGURANÇA: chave armazenada apenas no localStorage do dispositivo.
// ══════════════════════════════════════════════════════════════════

const LS_KEY_API    = 'stockflow_groq_key_v1';
const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
    'Você é um assistente inteligente integrado ao StockFlow Pro, ' +
    'um app de controle de estoque para pizzarias. Sua função é ajudar o usuário ' +
    'a gerenciar o estoque, sugerir compras, calcular quantidades e responder dúvidas ' +
    'sobre o negócio. Seja direto e prático. Use português brasileiro informal. ' +
    'Responda de forma concisa (no máximo 3 parágrafos) a menos que o usuário peça detalhes. ' +
    'Quando tiver acesso ao estoque, use essas informações para dar respostas personalizadas.';

// ── Gestão da chave de API ────────────────────────────────────────

export function salvarApiKey(key) {
    try { localStorage.setItem(LS_KEY_API, key.trim()); return true; }
    catch { return false; }
}

export function carregarApiKey() {
    return localStorage.getItem(LS_KEY_API) || '';
}

export function removerApiKey() {
    localStorage.removeItem(LS_KEY_API);
}

export function apiKeyConfigurada() {
    return carregarApiKey().length > 10;
}

// ── Contexto de estoque ───────────────────────────────────────────

/**
 * Constrói bloco de contexto com o estoque atual para injetar no prompt.
 * @param {Array} itens — [{n, q, u, c, min, max, minUnit}]
 * @returns {string}
 */
export function montarContextoEstoque(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '';

    const abaixoMin = itens.filter(i =>
        i.min != null && i.min !== '' && parseFloat(i.q) < parseFloat(i.min)
    );
    const marcados = itens.filter(i => i.c);

    const linhas = itens.map(i => {
        let linha = `• ${i.n}: ${i.q} ${i.u}`;
        if (i.c) linha += ' [COMPRAR]';
        if (i.min != null && i.min !== '') linha += ` (mín: ${i.min}${i.minUnit || i.u})`;
        return linha;
    });

    return [
        '\n\n[ESTOQUE ATUAL DA PIZZARIA]',
        `Total de itens: ${itens.length}`,
        marcados.length  ? `Marcados para compra: ${marcados.length}` : null,
        abaixoMin.length ? `Abaixo do mínimo: ${abaixoMin.map(i => i.n).join(', ')}` : null,
        '',
        linhas.join('\n'),
    ].filter(l => l !== null).join('\n');
}

// ── Chamada à API — núcleo privado ────────────────────────────────

/**
 * Centraliza toda a comunicação HTTP com a API Groq.
 * Elimina a triplicação dos blocos fetch que existia em v2.1.
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {{temperature:number, max_tokens:number}} opts
 * @returns {Promise<string>}
 * @throws {Error} mensagem em PT-BR pronta para exibir ao usuário
 */
async function _callGroq(messages, { temperature, max_tokens }) {
    const key = carregarApiKey();
    if (!key) throw new Error('Chave de API não configurada.');

    let res;
    try {
        res = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, max_tokens }),
        });
    } catch {
        throw new Error('Sem conexão. Verifique a internet e tente novamente.');
    }

    if (!res.ok) {
        let errMsg = `Erro HTTP ${res.status}`;
        try {
            const d = await res.json();
            errMsg = d?.error?.message || errMsg;
            if (res.status === 401) errMsg = 'Chave de API inválida. Verifique e tente novamente.';
            if (res.status === 403) errMsg = 'Acesso negado. Verifique sua chave Groq.';
            if (res.status === 429) errMsg = 'Limite atingido. Aguarde um momento.';
        } catch { /* usa errMsg padrão */ }
        throw new Error(errMsg);
    }

    const data  = await res.json();
    const texto = data?.choices?.[0]?.message?.content;
    if (!texto) throw new Error('Resposta inesperada da API. Tente novamente.');
    return texto;
}

// ── Análise automática de estoque ────────────────────────────────

/**
 * Gera um prompt de análise proativa do estoque e chama a API.
 * Chamada uma vez ao abrir o chat pela primeira vez.
 *
 * @param {Array} itens — [{n, q, u, c, min, max, minUnit}]
 * @returns {Promise<string>}
 */
export async function gerarAnaliseAutomatica(itens) {
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('Estoque vazio.');

    const promptAnalise =
        'Faça uma análise rápida do estoque abaixo e responda em até 4 linhas curtas. ' +
        'Estruture assim: 1) situação geral em uma frase, ' +
        '2) itens críticos (abaixo do mínimo ou zerados), ' +
        '3) uma sugestão prática imediata. ' +
        'Seja direto, use português brasileiro informal, sem introduções.' +
        montarContextoEstoque(itens);

    return _callGroq(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: promptAnalise }],
        { temperature: 0.5, max_tokens: 256 },
    );
}

// ── Lista de compras inteligente ──────────────────────────────────

/**
 * Gera uma lista de compras inteligente via Groq.
 * Considera itens marcados, abaixo do mínimo e zerados.
 * Devolve texto formatado pronto para copiar/WhatsApp.
 *
 * @param {Array} itens — [{n, q, u, c, min, minUnit}]
 * @returns {Promise<string>}
 */
export async function gerarListaCompras(itens) {
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('Estoque vazio.');

    const promptLista =
        'Com base no estoque abaixo, gere uma lista de compras para a pizzaria. ' +
        'Inclua: todos os itens marcados para compra, itens abaixo do mínimo e itens zerados. ' +
        'Para cada item, sugira uma quantidade razoável de compra considerando a unidade. ' +
        'Formato da resposta: apenas a lista, uma linha por item, sem introdução nem conclusão. ' +
        'Exemplo de linha: "Trigo — comprar 25 kg". ' +
        'Use português brasileiro. Se não houver itens críticos, diga isso em uma linha.' +
        montarContextoEstoque(itens);

    return _callGroq(
        [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: promptLista }],
        { temperature: 0.4, max_tokens: 512 },
    );
}

// ── Envio de mensagem do chat ─────────────────────────────────────

/**
 * Envia o histórico para o Groq e retorna a resposta em texto.
 *
 * Formato OpenAI-compatible:
 *   [{role: 'user'|'assistant', content: string}]
 *
 * @param {Array<{role:'user'|'assistant', content:string}>} historico
 * @returns {Promise<string>}
 * @throws {Error} mensagem em PT-BR
 */
export async function enviarMensagem(historico) {
    return _callGroq(
        [{ role: 'system', content: SYSTEM_PROMPT }, ...historico],
        { temperature: 0.7, max_tokens: 1024 },
    );
}
