// producao.js — StockFlow Pro v9.7.6
// ══════════════════════════════════════════════════════════════════
// Aba "Produção Total" — planejamento diário de produção de massas.
//
// BUGS CORRIGIDOS v9.7.6
// ══════════════════════════════════════════════════════════════════
// BUG #1 — _criarListaSeparacao: ml convertido para 'kg' em vez de 'l'
//   PROBLEMA : unidade 'ml' com total ≥ 1000 exibia '1 kg' em vez de '1 l'.
//              Usuário separava água errado.
//   CORREÇÃO : Distingue g→kg e ml→l na formatação de exibição.
//
// BUG #2 — calcularMassaTotal: ignorava unidade dos ingredientes
//   PROBLEMA : Ingrediente '0,5 kg de manteiga' somava 0,5 em vez de 500 g.
//              Massa total completamente errada para ingredientes em kg/l.
//   CORREÇÃO : normalizarParaGramas() converte kg→×1000 e l→×1000 antes de somar.
//
// BUG #3 — renderProducao: auto-cálculo nunca disparava em receitas novas
//   PROBLEMA : .every(r => r.trigoKg > 0) — receitas sem trigoKg no schema
//              retornam undefined > 0 = false. .every() exigia TODAS preenchidas,
//              bastava uma nova para suprimir o auto-cálculo das demais.
//   CORREÇÃO : Troca para .some(r => (r.trigoKg ?? 0) > 0).
//
// BUG #4 — massa-extra.css: classe CSS errada no override do light mode
//   PROBLEMA : .light-mode .prod-config-nome não existe no DOM. A classe real
//              é .prod-config-nome-badge. Badge invisível no tema Arctic/Light.
//   CORREÇÃO : Seletor corrigido para .prod-config-nome-badge com cores de alto contraste.
//
// BUG #5 — _copiarListaSeparacao: '.prod-bolas-total' ausente com receita única
//   PROBLEMA : A linha TOTAL (que tem .prod-bolas-total) só é criada quando há
//              mais de 1 receita. Com receita única, querySelector retornava null
//              e o header da cópia ficava sem a contagem de bolas.
//   CORREÇÃO : Fallback para .prod-td-bolas quando .prod-bolas-total não existe.
//
// BUG #6 — consolidarInsumos: ingredientes em kg/l acumulados sem normalização
//   PROBLEMA : "0,5 kg" e "300 g" do mesmo ingrediente em receitas diferentes
//              somavam 300,5 em vez de 800 g.
//   CORREÇÃO : Normaliza tudo para g/ml antes de acumular; unidade canônica
//              preservada para exibição correta.
// ══════════════════════════════════════════════════════════════════
//   • Lê todas as receitas de 'massaMasterReceitas_v1'.
//   • Por receita: recebe trigoKg + pesoBola → calcula massa total e bolas.
//   • Consolida insumos de todas as receitas num único mapa somado.
//   • Renderiza tabela comparativa + lista de separação consolidada.
//   • Persiste trigoKg e pesoBola de volta ao storage (enriquece schema
//     sem quebrar massa.js — campos adicionais são ignorados por ele).
//   • Renderiza SOMENTE quando a aba 'producao' é ativada (lazy).
// ══════════════════════════════════════════════════════════════════

import { darFeedback, copiarParaClipboard } from './utils.js';
import { mostrarToast }                     from './toast.js';

// ── Constantes ────────────────────────────────────────────────────
const STORAGE_KEY      = 'massaMasterReceitas_v1';
const PESO_BOLA_PADRAO = 250;   // g — default se pesoBola não estiver na receita

// ── Storage ───────────────────────────────────────────────────────
function carregarReceitas() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const estado = JSON.parse(raw);
        return Array.isArray(estado?.receitas) ? estado.receitas : [];
    } catch (e) {
        console.warn('[producao] storage corrompido:', e);
        return [];
    }
}

/** Persiste apenas pesoBola e trigoKg de volta ao storage.
 *  Não altera nenhum outro campo — idempotente para massa.js. */
function persistirCamposProducao(id, pesoBola, trigoKg) {
    try {
        const raw    = localStorage.getItem(STORAGE_KEY);
        const estado = raw ? JSON.parse(raw) : { receitas: [], ativaIdx: 0 };
        const idx    = estado.receitas.findIndex(r => r.id === id);
        if (idx === -1) return;
        estado.receitas[idx].pesoBola = pesoBola;
        estado.receitas[idx].trigoKg  = trigoKg;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (e) {
        console.warn('[producao] Falha ao persistir campos:', e);
    }
}

// ── Normalização de unidades ──────────────────────────────────────
/**
 * Converte o valor de um ingrediente para gramas (ou ml, tratados como g).
 * Necessário para calcular a massa total corretamente independente da unidade.
 *   kg  → × 1000
 *   l   → × 1000   (1 l ≈ 1000 g para fins de massa)
 *   g / ml / outros → como está (g ou unidade discreta)
 * @param {number} valor
 * @param {string} unidade
 * @returns {number}  valor normalizado em gramas
 */
function normalizarParaGramas(valor, unidade) {
    // BUG FIX #2: calcularMassaTotal tratava todos os ingredientes como gramas,
    // ignorando a unidade. Um ingrediente '0,5 kg' somava 0,5 em vez de 500,
    // produzindo massa total totalmente errada para receitas com ingredientes em kg ou l.
    switch ((unidade || '').toLowerCase()) {
        case 'kg': return valor * 1000;
        case 'l':  return valor * 1000;
        default:   return valor;   // g, ml, uni, pct, colher, xícara, etc.
    }
}

// ── Cálculo de Rendimento ─────────────────────────────────────────
/**
 * Massa total produzida (em gramas) para uma receita com trigoKg kg de farinha.
 * Soma: trigo (g) + todos os ingredientes normalizados e escalados por trigoKg.
 * @param {object} receita
 * @param {number} trigoKg
 * @returns {number}  massa total em gramas
 */
function calcularMassaTotal(receita, trigoKg) {
    if (!trigoKg || trigoKg <= 0) return 0;
    const somaIngredientG = (receita.ingredientes || [])
        .reduce((acc, ing) => {
            // BUG FIX #2: normaliza para gramas antes de somar.
            return acc + normalizarParaGramas(parseFloat(ing.valor) || 0, ing.unidade);
        }, 0);
    // trigoKg*1000 = trigo em gramas + todos os outros ingredientes em gramas
    return trigoKg * (1000 + somaIngredientG);
}

// ── Contador de Bolas ─────────────────────────────────────────────
/**
 * Número inteiro de bolas que a massa rende.
 * @param {number} massaTotalG   massa total em gramas
 * @param {number} pesoBola      peso por bola em gramas
 * @returns {number}
 */
function calcularBolas(massaTotalG, pesoBola) {
    if (!massaTotalG || !pesoBola || pesoBola <= 0) return 0;
    return Math.floor(massaTotalG / pesoBola);
}

// ── Consolidador de Insumos ───────────────────────────────────────
/**
 * Agrega ingredientes de TODAS as receitas num único mapa.
 * Ingredientes com o mesmo nome (case-insensitive) são somados.
 * O trigo em si é adicionado como entrada "Trigo".
 *
 * BUG FIX #6: ingredientes com unidade 'kg' ou 'l' são convertidos para
 * 'g' / 'ml' antes de acumular, garantindo que "0,5 kg de manteiga" por
 * receita e "300 g de manteiga" de outra receita sejam somados corretamente
 * (300 + 500 = 800 g) em vez de (300 g + 0,5 → valor incoerente).
 * A conversão inversa (g → kg) acontece na exibição quando total >= 1000.
 *
 * @param {Array<{receita, trigoKg}>} configs
 * @returns {Map<string, {nome, total, unidade}>}
 *   chave = nome.toLowerCase().trim()
 */
function consolidarInsumos(configs) {
    const mapa = new Map();

    /** Normaliza unidade para a forma canônica de exibição (g ou ml) */
    function unidadeCanonica(unidade) {
        const u = (unidade || '').toLowerCase();
        if (u === 'kg') return 'g';
        if (u === 'l')  return 'ml';
        return unidade;
    }

    const somar = (nome, valorBruto, unidade) => {
        // BUG FIX #6: converte kg→g e l→ml para que a acumulação seja sempre
        // na mesma escala. A exibição depois converte g≥1000 → kg, ml≥1000 → l.
        const valor   = normalizarParaGramas(valorBruto, unidade);
        const unidCan = unidadeCanonica(unidade);
        const chave   = nome.toLowerCase().trim();
        if (!mapa.has(chave)) {
            mapa.set(chave, { nome, total: 0, unidade: unidCan });
        }
        mapa.get(chave).total += valor;
    };

    for (const { receita, trigoKg } of configs) {
        if (!trigoKg || trigoKg <= 0) continue;
        // Trigo em si (já em kg, exibe diretamente como kg)
        const chaveTrg = 'trigo';
        if (!mapa.has(chaveTrg)) {
            mapa.set(chaveTrg, { nome: 'Trigo', total: 0, unidade: 'kg' });
        }
        mapa.get(chaveTrg).total += trigoKg;
        // Demais ingredientes — normaliza antes de acumular
        for (const ing of (receita.ingredientes || [])) {
            somar(ing.nome, trigoKg * (parseFloat(ing.valor) || 0), ing.unidade);
        }
    }

    return mapa;
}

// ── Formatação ────────────────────────────────────────────────────
function fmtNum(n, casas = 2) {
    // Remove zeros à direita: 1.50 → 1.5, 1.00 → 1
    return parseFloat(n.toFixed(casas)).toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

function fmtKg(g) {
    return g >= 1000
        ? fmtNum(g / 1000, 3) + ' kg'
        : fmtNum(g, 1)        + ' g';
}

// ── Render ────────────────────────────────────────────────────────
let _secao = null;   // cache do elemento DOM

function getSecao() {
    return _secao || (_secao = document.getElementById('producao-section'));
}

export function renderProducao() {
    const secao = getSecao();
    if (!secao) return;

    const receitas = carregarReceitas();

    if (receitas.length === 0) {
        secao.innerHTML = '';
        const aviso = document.createElement('div');
        aviso.className = 'prod-vazio empty-state';
        aviso.innerHTML = `
            <span class="empty-state-icon" aria-hidden="true">🍕</span>
            <span class="empty-state-msg">Nenhuma receita encontrada.</span>
            <span class="empty-state-hint">Crie receitas na aba <strong>Massa</strong> primeiro.</span>
        `;
        secao.appendChild(aviso);
        return;
    }

    // ── Monta DOM via createElement (zero innerHTML em dados do usuário) ──
    secao.innerHTML = '';

    // Cabeçalho
    const header = _criarHeader();
    secao.appendChild(header);

    // ── Seção: Configuração por receita ───────────────────────────
    const configCard = _criarCard('Configurar Producao');
    const configForm = document.createElement('div');
    configForm.className = 'prod-config-list';
    configForm.id        = 'prod-config-list';

    receitas.forEach(r => {
        configForm.appendChild(_criarLinhaConfig(r));
    });

    configCard.appendChild(configForm);
    secao.appendChild(configCard);

    // ── Botão calcular ────────────────────────────────────────────
    const btnCalc = document.createElement('button');
    btnCalc.className   = 'btn-zap prod-btn-calcular';
    btnCalc.id          = 'prod-btn-calcular';
    btnCalc.textContent = 'Calcular Producao';
    secao.appendChild(btnCalc);

    // ── Seção: Tabela resumo (oculta inicialmente) ────────────────
    const resumoCard = _criarCard('Resumo da Producao');
    resumoCard.id      = 'prod-resumo-card';
    resumoCard.style.display = 'none';
    secao.appendChild(resumoCard);

    // ── Seção: Lista consolidada (oculta inicialmente) ────────────
    const sepCard = _criarCard('Lista de Separacao');
    sepCard.id         = 'prod-sep-card';
    sepCard.style.display = 'none';
    secao.appendChild(sepCard);

    // ── Botão copiar (oculto inicialmente) ────────────────────────
    const btnCopy = document.createElement('button');
    btnCopy.className        = 'btn-zap prod-btn-copiar';
    btnCopy.id               = 'prod-btn-copiar';
    btnCopy.style.display    = 'none';
    btnCopy.textContent      = 'Copiar Lista de Separacao';
    secao.appendChild(btnCopy);

    // ── Event Listeners ───────────────────────────────────────────
    btnCalc.addEventListener('click', () => {
        darFeedback();
        _calcularEExibir(receitas);
    });

    btnCopy.addEventListener('click', () => {
        darFeedback();
        _copiarListaSeparacao();
    });

    // Auto-calcular se ao menos uma receita já tiver trigoKg preenchido.
    // BUG FIX #3: usava .every(r => r.trigoKg > 0). Receitas recém-criadas na aba
    // Massa não têm o campo trigoKg no schema — undefined > 0 = false sempre.
    // Com .every(), basta UMA receita nova para suprimir o auto-cálculo para
    // todas as outras já configuradas. Troca para .some() com ?? 0 garante que o
    // cálculo dispara quando qualquer receita tiver trigoKg salvo de sessão anterior.
    const algumPreenchido = receitas.some(r => (r.trigoKg ?? 0) > 0);
    if (algumPreenchido) _calcularEExibir(receitas);
}

// ── Linha de configuração por receita ─────────────────────────────
function _criarLinhaConfig(r) {
    // ── Cartão completo para a receita ────────────────────────────
    // Layout: [Nome da receita — full width] / [Trigo input | Bola input]
    const row = document.createElement('div');
    row.className     = 'prod-config-row prod-config-row--card';
    row.dataset.recId = r.id;

    const inputId     = `prod-trigo-${r.id}`;
    const inputBolaId = `prod-bola-${r.id}`;

    // ── Cabeçalho: nome da receita em destaque ────────────────────
    const header = document.createElement('div');
    header.className = 'prod-config-header';

    const nomeTag = document.createElement('span');
    nomeTag.className   = 'prod-config-nome-badge';
    nomeTag.textContent = r.nome;

    header.appendChild(nomeTag);
    row.appendChild(header);

    // ── Linha de inputs: Trigo + Bola ─────────────────────────────
    const inputsRow = document.createElement('div');
    inputsRow.className = 'prod-config-inputs-row';

    // Grupo Trigo
    const grupoTrigo = document.createElement('div');
    grupoTrigo.className = 'prod-input-group';

    const lblTrigo = document.createElement('label');
    lblTrigo.className   = 'prod-input-label';
    lblTrigo.textContent = 'Trigo (kg)';
    lblTrigo.htmlFor     = inputId;

    const inputTrigo = document.createElement('input');
    inputTrigo.type        = 'number';
    inputTrigo.id          = inputId;
    inputTrigo.className   = 'prod-input prod-input--trigo';
    inputTrigo.dataset.recId = r.id;
    inputTrigo.dataset.field = 'trigoKg';
    inputTrigo.placeholder = '0';
    inputTrigo.min         = '0';
    inputTrigo.step        = '0.5';
    inputTrigo.inputMode   = 'decimal';
    inputTrigo.value       = r.trigoKg > 0 ? r.trigoKg : '';
    inputTrigo.setAttribute('aria-label', `Trigo em kg para ${r.nome}`);

    const sufTrigo = document.createElement('span');
    sufTrigo.className   = 'prod-input-suf';
    sufTrigo.textContent = 'kg';

    grupoTrigo.appendChild(lblTrigo);
    grupoTrigo.appendChild(inputTrigo);
    grupoTrigo.appendChild(sufTrigo);

    // Grupo Bola
    const grupoBola = document.createElement('div');
    grupoBola.className = 'prod-input-group';

    const lblBola = document.createElement('label');
    lblBola.className   = 'prod-input-label';
    lblBola.textContent = 'Peso bola (g)';
    lblBola.htmlFor     = inputBolaId;

    const inputBola = document.createElement('input');
    inputBola.type        = 'number';
    inputBola.id          = inputBolaId;
    inputBola.className   = 'prod-input prod-input--bola';
    inputBola.dataset.recId = r.id;
    inputBola.dataset.field = 'pesoBola';
    inputBola.placeholder = String(PESO_BOLA_PADRAO);
    inputBola.min         = '1';
    inputBola.step        = '10';
    inputBola.inputMode   = 'numeric';
    inputBola.value       = r.pesoBola > 0 ? r.pesoBola : '';
    inputBola.setAttribute('aria-label', `Peso da bola em gramas para ${r.nome}`);

    const sufBola = document.createElement('span');
    sufBola.className   = 'prod-input-suf';
    sufBola.textContent = 'g';

    grupoBola.appendChild(lblBola);
    grupoBola.appendChild(inputBola);
    grupoBola.appendChild(sufBola);

    inputsRow.appendChild(grupoTrigo);
    inputsRow.appendChild(grupoBola);
    row.appendChild(inputsRow);

    // Persiste ao sair do campo (blur)
    [inputTrigo, inputBola].forEach(inp => {
        inp.addEventListener('blur', () => _persistirInputs(inp.closest('.prod-config-row')));
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });

    return row;
}

function _persistirInputs(row) {
    if (!row) return;
    const id     = parseInt(row.dataset.recId);
    const trigo  = parseFloat(row.querySelector('[data-field="trigoKg"]')?.value)  || 0;
    const bola   = parseFloat(row.querySelector('[data-field="pesoBola"]')?.value) || PESO_BOLA_PADRAO;
    persistirCamposProducao(id, bola, trigo);
}

// ── Calcular e Exibir ─────────────────────────────────────────────
function _calcularEExibir(receitas) {
    const secao = getSecao();
    if (!secao) return;

    // NOTA v9.7.4: row.dataset.recId (camelCase JS) == atributo HTML data-rec-id (kebab-case).
    // O seletor [data-rec-id] e dataset.recId são equivalentes e corretos em browsers modernos.
    // Lê inputs atuais da tela (prioridade sobre storage para cálculo ao vivo)
    const configs = receitas.map(r => {
        const row    = secao.querySelector(`.prod-config-row[data-rec-id="${r.id}"]`);
        const trigoKg  = row ? (parseFloat(row.querySelector('[data-field="trigoKg"]')?.value)  || 0)
                             : (r.trigoKg || 0);
        const pesoBola = row ? (parseFloat(row.querySelector('[data-field="pesoBola"]')?.value) || PESO_BOLA_PADRAO)
                             : (r.pesoBola || PESO_BOLA_PADRAO);
        return { receita: r, trigoKg, pesoBola };
    });

    // Valida: precisa de ao menos uma receita com trigo > 0
    const algumPreenchido = configs.some(c => c.trigoKg > 0);
    if (!algumPreenchido) {
        mostrarToast('Informe o trigo (kg) de ao menos uma receita.', 'aviso');
        return;
    }

    // Persiste ao calcular
    configs.forEach(c => persistirCamposProducao(c.receita.id, c.pesoBola, c.trigoKg));

    // ── Tabela Resumo ─────────────────────────────────────────────
    const resumoCard = document.getElementById('prod-resumo-card');
    resumoCard.style.display = '';
    // Remove conteúdo anterior (deixa o título)
    while (resumoCard.children.length > 1) resumoCard.removeChild(resumoCard.lastChild);

    const tabela = _criarTabelaResumo(configs);
    resumoCard.appendChild(tabela);

    // ── Lista Consolidada ─────────────────────────────────────────
    const mapaInsumos = consolidarInsumos(configs);
    const sepCard     = document.getElementById('prod-sep-card');
    sepCard.style.display = '';
    while (sepCard.children.length > 1) sepCard.removeChild(sepCard.lastChild);

    const listaEl = _criarListaSeparacao(mapaInsumos);
    sepCard.appendChild(listaEl);

    // Botão copiar
    const btnCopy = document.getElementById('prod-btn-copiar');
    if (btnCopy) btnCopy.style.display = '';

    // Scroll suave até o resumo
    requestAnimationFrame(() => resumoCard.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// ── Tabela Comparativa ────────────────────────────────────────────
function _criarTabelaResumo(configs) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prod-table-wrapper';

    const table = document.createElement('table');
    table.className = 'prod-table';

    // Thead
    const thead = document.createElement('thead');
    const hrTh  = document.createElement('tr');
    ['Receita', 'Trigo', 'Massa Total', 'Bolas'].forEach(txt => {
        const th = document.createElement('th');
        th.textContent = txt;
        hrTh.appendChild(th);
    });
    thead.appendChild(hrTh);
    table.appendChild(thead);

    // Tbody
    const tbody    = document.createElement('tbody');
    let totTrigo   = 0;
    let totMassa   = 0;
    let totBolas   = 0;

    configs.forEach(({ receita, trigoKg, pesoBola }) => {
        const massaG = calcularMassaTotal(receita, trigoKg);
        const bolas  = calcularBolas(massaG, pesoBola);

        totTrigo += trigoKg;
        totMassa += massaG;
        totBolas += bolas;

        const tr = document.createElement('tr');

        const tdNome = document.createElement('td');
        tdNome.className   = 'prod-td-nome';
        tdNome.textContent = receita.nome;

        const tdTrigo = document.createElement('td');
        tdTrigo.className   = 'prod-td-num';
        tdTrigo.textContent = trigoKg > 0 ? fmtNum(trigoKg, 1) + ' kg' : '—';

        const tdMassa = document.createElement('td');
        tdMassa.className   = 'prod-td-num';
        tdMassa.textContent = massaG > 0 ? fmtKg(massaG) : '—';

        const tdBolas = document.createElement('td');
        tdBolas.className   = 'prod-td-bolas';
        tdBolas.textContent = bolas > 0 ? String(bolas) : '—';

        tr.appendChild(tdNome);
        tr.appendChild(tdTrigo);
        tr.appendChild(tdMassa);
        tr.appendChild(tdBolas);
        tbody.appendChild(tr);
    });

    // Linha de totais
    if (configs.length > 1) {
        const trTot = document.createElement('tr');
        trTot.className = 'prod-tr-total';

        const tdLabel = document.createElement('td');
        tdLabel.textContent = 'TOTAL';

        const tdTrigoTot = document.createElement('td');
        tdTrigoTot.className   = 'prod-td-num';
        tdTrigoTot.textContent = fmtNum(totTrigo, 1) + ' kg';

        const tdMassaTot = document.createElement('td');
        tdMassaTot.className   = 'prod-td-num';
        tdMassaTot.textContent = fmtKg(totMassa);

        const tdBolasTot = document.createElement('td');
        tdBolasTot.className   = 'prod-td-bolas prod-bolas-total';
        tdBolasTot.textContent = String(totBolas);

        trTot.appendChild(tdLabel);
        trTot.appendChild(tdTrigoTot);
        trTot.appendChild(tdMassaTot);
        trTot.appendChild(tdBolasTot);
        tbody.appendChild(trTot);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);

    // Badge total bolas destaque
    if (totBolas > 0) {
        const badge = document.createElement('div');
        badge.className = 'prod-badge-bolas';
        const num = document.createElement('span');
        num.className   = 'prod-badge-num';
        num.textContent = String(totBolas);
        const lbl = document.createElement('span');
        lbl.className   = 'prod-badge-lbl';
        lbl.textContent = 'bolas no total';
        badge.appendChild(num);
        badge.appendChild(lbl);
        wrapper.appendChild(badge);
    }

    return wrapper;
}

// ── Lista de Separação Consolidada ────────────────────────────────
function _criarListaSeparacao(mapa) {
    const lista = document.createElement('ul');
    lista.className = 'prod-sep-list';
    lista.id        = 'prod-sep-list';

    // Ordena: Trigo primeiro, depois alfabético
    const entradas = [...mapa.values()].sort((a, b) => {
        if (a.nome.toLowerCase() === 'trigo') return -1;
        if (b.nome.toLowerCase() === 'trigo') return 1;
        return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    entradas.forEach(({ nome, total, unidade }) => {
        const li = document.createElement('li');
        li.className = 'prod-sep-item';

        const spanNome = document.createElement('span');
        spanNome.className   = 'prod-sep-nome';
        spanNome.textContent = nome;

        const spanVal = document.createElement('span');
        spanVal.className   = 'prod-sep-val';
        // BUG FIX #1: o código anterior convertia TANTO g quanto ml para 'kg'
        // quando total >= 1000. Isso fazia "1000 ml de água" exibir "1 kg" em
        // vez de "1 l". Trigo já vem em 'kg' e é tratado separadamente.
        let textoVal;
        if (unidade === 'g' && total >= 1000) {
            textoVal = fmtNum(total / 1000, 3) + ' kg';
        } else if (unidade === 'ml' && total >= 1000) {
            textoVal = fmtNum(total / 1000, 3) + ' l';
        } else {
            textoVal = fmtNum(total, total < 1 ? 3 : 2) + ' ' + unidade;
        }
        spanVal.textContent = textoVal;

        li.appendChild(spanNome);
        li.appendChild(spanVal);
        lista.appendChild(li);
    });

    return lista;
}

// ── Copiar lista de separação ─────────────────────────────────────
function _copiarListaSeparacao() {
    const lista = document.getElementById('prod-sep-list');
    if (!lista) { mostrarToast('Calcule primeiro.', 'aviso'); return; }

    const hoje   = new Date().toLocaleDateString('pt-BR');
    const linhas = [...lista.querySelectorAll('.prod-sep-item')].map(li => {
        const nome = li.querySelector('.prod-sep-nome')?.textContent || '';
        const val  = li.querySelector('.prod-sep-val')?.textContent  || '';
        return `${nome.padEnd(18)}: ${val}`;
    });

    // BUG FIX #5: .prod-bolas-total só existe na linha TOTAL (configs.length > 1).
    // Com receita única não há linha de totais — busca o único .prod-td-bolas como fallback.
    const totBolas = (
        document.querySelector('.prod-bolas-total')?.textContent ||
        document.querySelector('.prod-td-bolas')?.textContent    ||
        ''
    ).trim();
    const cabecalho = `SEPARACAO — ${hoje}` + (totBolas ? ` — ${totBolas} bolas` : '');

    copiarParaClipboard([cabecalho, '', ...linhas].join('\n'));
}

// ── Utilitários de DOM ────────────────────────────────────────────
function _criarHeader() {
    const div = document.createElement('div');
    div.className = 'prod-header';

    const h2 = document.createElement('h2');
    h2.className   = 'prod-titulo';
    h2.textContent = 'Producao Total';

    const sub = document.createElement('p');
    sub.className   = 'prod-subtitulo';
    sub.textContent = 'Planeje a produção do dia com todas as receitas.';

    div.appendChild(h2);
    div.appendChild(sub);
    return div;
}

function _criarCard(titulo) {
    const card = document.createElement('div');
    card.className = 'card prod-card';

    const h3 = document.createElement('h3');
    h3.className   = 'prod-card-titulo';
    h3.textContent = titulo;

    card.appendChild(h3);
    return card;
}

// ── Inicialização ─────────────────────────────────────────────────
/**
 * Registra listener no evento 'tabChanged' do navegacao.js.
 * A aba é renderizada de forma lazy — somente quando ativada.
 * Deve ser chamada uma única vez em main.js após DOMContentLoaded.
 */
export function iniciarProducao() {
    document.addEventListener('tabChanged', e => {
        if (e.detail?.tab === 'producao') {
            renderProducao();
        }
    });
}
