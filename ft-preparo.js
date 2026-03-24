// ft-preparo.js — Ficha Técnica v1.2  Preparo Antecipado
// v1.2: _esc() extraído para ft-format.js; CSS movido para ft-style.css.
// ══════════════════════════════════════════════════════════════════
// v1.1 — Layout redesenhado mobile-first:
//   PROBLEMA v1.0: tabela de 5 colunas (1fr 80px 88px 76px 32px)
//   totalizava 276px fixos. Em iPhone (modal ≈ 358px útil), a coluna
//   de nome ficava com ~62px → header "VALOR" truncado para "VA",
//   inputs cortados, layout quebrado.
//   SOLUÇÃO: layout card por ingrediente (2 linhas):
//     Linha 1: [nome                              ] [×]
//     Linha 2: [Peso (g)] [R$/kg] [= R$ calculado]
//   Zero truncamento, legível em qualquer iPhone.
// ══════════════════════════════════════════════════════════════════

import { salvar, carregar, remover } from './ft-storage.js';
import { formatCurrency, formatNum, generateId, esc } from './ft-format.js';
import { toast, abrirModal, fecharModal, confirmar, renderEmpty, renderTutorial, animateSection } from './ft-ui.js';
import { ico } from './ft-icons.js';

const COL  = 'preparos';
let _preps  = [];
let _editIng = [];


/* ══════════════════════════════════════════════════════════════════
   CARDS DE INGREDIENTES — layout 2 linhas, sem tabela de colunas
   fixas que trunca em iPhone.

   Linha 1:  [   Nome do ingrediente…   ]  [ × ]
   Linha 2:  Peso(g)  R$/kg   =Valor
             [input]  [input]  [R$0,00]
   ══════════════════════════════════════════════════════════════════ */

// ─── Cálculos ─────────────────────────────────────────────────────
function _calcValor(peso_g, valor_kg) {
  return (Number(peso_g) / 1000) * Number(valor_kg);
}

function _calcTotais(ings, peso_depois_pronto) {
  const peso_total  = ings.reduce((s, i) => s + (Number(i.peso_g) || 0), 0);
  const custo_total = ings.reduce((s, i) => s + (Number(i.valor)  || 0), 0);
  const pdp         = Number(peso_depois_pronto) > 0 ? Number(peso_depois_pronto) : peso_total;
  const preco_kg    = pdp > 0 ? (custo_total / (pdp / 1000)) : 0;
  return { peso_total, custo_total, preco_kg };
}

// ─── Estado ───────────────────────────────────────────────────────
export async function initPreparo() {
  _preps = await carregar(COL);
}

export function getPreparos() { return _preps; }

// ─── Render lista ─────────────────────────────────────────────────
export function renderPreparo(busca = '') {
  const wrap = document.getElementById('ft-preparo');
  if (!wrap) return;
  animateSection(wrap);
  renderTutorial('ft-sec-pre', 'pre', ico.prep,
    'Como usar o Preparo Antecipado', [
      'Cadastre receitas de preparo em lote, como <strong>Massa de Pizza</strong>.',
      'Informe o <strong>peso (g)</strong> e o <strong>valor por kg (R$/kg)</strong> de cada ingrediente.',
      'O custo total e o <strong>preço/kg</strong> do produto final são calculados automaticamente.',
      '"Peso depois de pronto" calcula o custo real após perdas de cocção ou fermentação.',
    ]);

  const q     = busca.trim().toLowerCase();
  const lista = [..._preps]
    .filter(p => !q || p.nome.toLowerCase().includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  if (!lista.length) {
    renderEmpty(
      wrap, ico.prep,
      q ? 'Nenhum preparo encontrado' : 'Nenhum preparo cadastrado',
      q ? 'Tente outro termo.' : 'Cadastre sua primeira receita de preparo antecipado.',
      q ? null : { label: 'Novo preparo', fn: () => abrirFormPreparo() }
    );
    return;
  }

  wrap.innerHTML = `
    <div class="ft-list-header">
      ${lista.length} preparo${lista.length !== 1 ? 's' : ''} antecipado${lista.length !== 1 ? 's' : ''}
    </div>
    <div class="ft-list">
      ${lista.map(p => {
        const { peso_total, custo_total, preco_kg } =
          _calcTotais(p.ingredientes || [], p.peso_depois_pronto || 0);
        const nIng = (p.ingredientes || []).length;
        return `
        <button class="ft-list-item" data-id="${p.id}" type="button">
          <span class="ft-item-ico ft-ico-pre">${ico.prep}</span>
          <span class="ft-item-body">
            <span class="ft-item-name">${esc(p.nome)}</span>
            <span class="ft-item-sub">
              ${nIng} ingrediente${nIng !== 1 ? 's' : ''} ·
              ${formatNum(peso_total, 0)} g · custo ${formatCurrency(custo_total)}
            </span>
          </span>
          <span class="ft-item-end">
            <span class="ft-pill ft-pill-acc">${formatCurrency(preco_kg)}/kg</span>
            <span class="ft-item-chev">${ico.chevR}</span>
          </span>
        </button>`;
      }).join('')}
    </div>`;

  wrap.querySelectorAll('.ft-list-item').forEach(b =>
    b.addEventListener('click', () => abrirFormPreparo(b.dataset.id)));
}

// ─── Formulário ───────────────────────────────────────────────────
export function abrirFormPreparo(id = null) {
  const prep   = id ? _preps.find(p => p.id === id) : null;
  _editIng = prep ? (prep.ingredientes || []).map(i => ({ ...i })) : [];

  const html = `
    <div class="ft-mhd">
      <button class="ft-mhd-close" id="_prClose" aria-label="Fechar">${ico.close}</button>
      <span class="ft-mhd-title">${prep ? 'Editar preparo' : 'Novo preparo antecipado'}</span>
      ${prep
        ? `<button class="ft-mhd-del" id="_prDel" aria-label="Apagar">${ico.trash}</button>`
        : `<span style="width:32px"></span>`}
    </div>

    <div class="ft-mbody">

      <!-- Nome -->
      <div class="ft-field">
        <label for="ft-pr-nome">Nome do preparo</label>
        <input id="ft-pr-nome" class="ft-input" type="text"
          placeholder="Ex: Massa de Pizza, Molho de Tomate…"
          value="${esc(prep?.nome || '')}"
          autocomplete="off" autocorrect="off" autocapitalize="words">
      </div>

      <!-- Ingredientes -->
      <div class="ft-field">
        <div class="ft-label-row">
          <label>Ingredientes</label>
          <button class="ft-btn ft-btn-sm ft-btn-ghost" id="_prAddIng" type="button">
            <span class="ft-bico">${ico.plus}</span><span>Adicionar linha</span>
          </button>
        </div>
        <div id="ft-pr-cards"></div>
      </div>

      <!-- Peso depois de pronto -->
      <div class="ft-field">
        <label for="ft-pr-pdp">Peso depois de pronto (g)</label>
        <div class="ft-tip-banner">
          ${ico.info}
          <span>Pese o produto final após assar ou fermentar. Deixe em branco se igual ao peso total.</span>
        </div>
        <input id="ft-pr-pdp" class="ft-input" type="number"
          placeholder="Ex: 8000" min="0.1" step="1" inputmode="decimal"
          value="${prep?.peso_depois_pronto || ''}">
      </div>

      <!-- Resultado -->
      <div class="ft-field">
        <label>Resultado</label>
        <div class="ft-pre-result">
          <div class="ft-pre-res-row">
            <span class="ft-pre-res-lbl">Peso total ingredientes</span>
            <span class="ft-pre-res-val" id="ft-pr-r-ptotal">—</span>
          </div>
          <div class="ft-pre-res-row hi">
            <span class="ft-pre-res-lbl">Custo total do lote</span>
            <span class="ft-pre-res-val" id="ft-pr-r-custo">—</span>
          </div>
          <div class="ft-pre-res-row acc">
            <span class="ft-pre-res-lbl">${ico.tag} Preço/kg do produto</span>
            <span class="ft-pre-res-val" id="ft-pr-r-pkg">—</span>
          </div>
        </div>
      </div>

    </div>

    <div class="ft-mft">
      <button class="ft-btn ft-btn-primary ft-btn-full" id="_prSave" type="button">
        <span class="ft-bico">${ico.save}</span><span>Salvar preparo</span>
      </button>
    </div>`;

  // SÍNCRONO: registrar listeners imediatamente após abrirModal
  const done = abrirModal(html, { largo: true });

  _renderCards();
  _calcResult();

  document.getElementById('_prClose')
    ?.addEventListener('click', () => fecharModal(null), { once: true });
  document.getElementById('_prSave')
    ?.addEventListener('click', () => _save(id));
  document.getElementById('_prDel')
    ?.addEventListener('click', async () => { fecharModal(null); await _del(id); });

  document.getElementById('_prAddIng')
    ?.addEventListener('click', () => {
      _editIng.push({ nome: '', peso_g: 0, valor_kg: 0, valor: 0 });
      _renderCards();
      _calcResult();
      const nomes = document.querySelectorAll('.ft-pre-nome-input');
      nomes[nomes.length - 1]?.focus();
    });

  document.getElementById('ft-pr-pdp')
    ?.addEventListener('input', _calcResult);

  return done;
}

// ─── Cards de ingredientes ────────────────────────────────────────
function _renderCards() {
  const wrap = document.getElementById('ft-pr-cards');
  if (!wrap) return;

  if (!_editIng.length) {
    wrap.innerHTML = `
      <div class="ft-pre-empty-card">
        ${ico.ingredients}
        <span>Nenhum ingrediente. Toque em <strong>+ Adicionar linha</strong> acima.</span>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="ft-pre-cards">
      ${_editIng.map((ing, idx) => `
      <div class="ft-pre-card">

        <!-- Linha 1: nome + remover -->
        <div class="ft-pre-card-top">
          <input class="ft-pre-nome-input" type="text"
            placeholder="Nome do ingrediente"
            value="${esc(ing.nome || '')}"
            autocomplete="off" autocorrect="off" autocapitalize="words"
            data-idx="${idx}" data-field="nome">
          <button class="ft-pre-card-rm" data-rm="${idx}" aria-label="Remover ingrediente">
            ${ico.close}
          </button>
        </div>

        <!-- Linha 2: peso, R$/kg, valor -->
        <div class="ft-pre-card-nums">

          <div class="ft-pre-num-group">
            <span class="ft-pre-num-label">Peso (g)</span>
            <input class="ft-pre-num-input" type="number"
              inputmode="decimal" placeholder="0" min="0" step="1"
              value="${ing.peso_g > 0 ? ing.peso_g : ''}"
              data-idx="${idx}" data-field="peso_g">
          </div>

          <div class="ft-pre-num-group">
            <span class="ft-pre-num-label">R$/kg</span>
            <input class="ft-pre-num-input" type="number"
              inputmode="decimal" placeholder="0,00" min="0" step="0.01"
              value="${ing.valor_kg > 0 ? ing.valor_kg : ''}"
              data-idx="${idx}" data-field="valor_kg">
          </div>

          <div class="ft-pre-num-group valor-col">
            <span class="ft-pre-num-label">Valor</span>
            <div class="ft-pre-valor-box">
              <span class="ft-pre-valor-text" id="ft-pr-vc-${idx}">
                ${ing.valor > 0 ? formatCurrency(ing.valor) : '—'}
              </span>
            </div>
          </div>

        </div>
      </div>`).join('')}
    </div>`;

  // Listeners inputs
  wrap.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const idx   = parseInt(input.dataset.idx, 10);
      const field = input.dataset.field;
      if (field === 'nome') {
        _editIng[idx].nome = input.value;
      } else {
        _editIng[idx][field] = parseFloat(input.value) || 0;
        _editIng[idx].valor  = _calcValor(
          _editIng[idx].peso_g  || 0,
          _editIng[idx].valor_kg || 0
        );
        const span = document.getElementById(`ft-pr-vc-${idx}`);
        if (span) {
          span.textContent = _editIng[idx].valor > 0
            ? formatCurrency(_editIng[idx].valor) : '—';
        }
      }
      _calcResult();
    });
  });

  // Listeners remover
  wrap.querySelectorAll('[data-rm]').forEach(btn => {
    btn.addEventListener('click', () => {
      _editIng.splice(parseInt(btn.dataset.rm, 10), 1);
      _renderCards();
      _calcResult();
    });
  });
}

// ─── Resultado em tempo real ──────────────────────────────────────
function _calcResult() {
  const pdp = parseFloat(document.getElementById('ft-pr-pdp')?.value) || 0;
  const { peso_total, custo_total, preco_kg } = _calcTotais(_editIng, pdp);

  const elP = document.getElementById('ft-pr-r-ptotal');
  const elC = document.getElementById('ft-pr-r-custo');
  const elK = document.getElementById('ft-pr-r-pkg');

  if (elP) elP.textContent = peso_total  > 0 ? `${formatNum(peso_total, 0)} g`       : '—';
  if (elC) elC.textContent = custo_total > 0 ? formatCurrency(custo_total)            : '—';
  if (elK) elK.textContent = preco_kg    > 0 ? `${formatCurrency(preco_kg)}/kg`       : '—';
}

// ─── Salvar ───────────────────────────────────────────────────────
async function _save(id) {
  const nome = document.getElementById('ft-pr-nome')?.value.trim();
  const pdp  = parseFloat(document.getElementById('ft-pr-pdp')?.value) || 0;

  if (!nome) {
    const el = document.getElementById('ft-pr-nome');
    if (el) {
      el.classList.add('err');
      el.addEventListener('input', () => el.classList.remove('err'), { once: true });
    }
    toast('Informe o nome do preparo.', 'erro');
    return;
  }
  if (!_editIng.length) {
    toast('Adicione ao menos um ingrediente.', 'aviso');
    return;
  }
  if (_editIng.some(i => !i.nome?.trim())) {
    toast('Preencha o nome de todos os ingredientes.', 'aviso');
    return;
  }

  const ings = _editIng.map(i => ({
    nome:     (i.nome || '').trim(),
    peso_g:   Number(i.peso_g)   || 0,
    valor_kg: Number(i.valor_kg) || 0,
    valor:    _calcValor(Number(i.peso_g) || 0, Number(i.valor_kg) || 0),
  }));
  const { peso_total, custo_total, preco_kg } = _calcTotais(ings, pdp);

  const obj = {
    id:                 id || generateId(),
    nome,
    ingredientes:       ings,
    peso_depois_pronto: pdp > 0 ? pdp : peso_total,
    peso_total,
    custo_total,
    preco_kg,
    criadoEm:           Date.now(),
  };

  const btn = document.getElementById('_prSave');
  if (btn) { btn.disabled = true; btn.lastElementChild.textContent = 'Salvando…'; }

  try {
    await salvar(COL, obj.id, obj);
    if (id) {
      const i = _preps.findIndex(p => p.id === id);
      if (i >= 0) _preps[i] = obj; else _preps.push(obj);
    } else {
      _preps.push(obj);
    }
    fecharModal('saved');
    toast(id ? 'Preparo atualizado!' : 'Preparo salvo!', 'sucesso');
    renderPreparo(document.getElementById('ft-busca-pre')?.value || '');
  } catch (e) {
    toast('Erro ao salvar. Tente novamente.', 'erro');
    if (btn) { btn.disabled = false; btn.lastElementChild.textContent = 'Salvar preparo'; }
    console.error('[ft-preparo] save error:', e);
  }
}

// ─── Deletar ──────────────────────────────────────────────────────
async function _del(id) {
  const prep = _preps.find(p => p.id === id);
  if (!prep) return;
  const ok = await confirmar(
    `Remover <strong>${esc(prep.nome)}</strong>?<br>Esta ação não pode ser desfeita.`,
    { labelOK: 'Remover', perigo: true }
  );
  if (!ok) return;
  await remover(COL, id);
  _preps = _preps.filter(p => p.id !== id);
  toast('Preparo removido.', 'info');
  renderPreparo(document.getElementById('ft-busca-pre')?.value || '');
}

// esc() importado de ft-format.js
