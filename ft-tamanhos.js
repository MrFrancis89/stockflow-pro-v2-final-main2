// ft-tamanhos.js — StockFlow Pro V2
// GAP 5: Tamanhos customizáveis — nomes livres, cm, fator, 6+ tamanhos
import { salvar, carregar } from './ft-storage.js';
import { toast, abrirModal, fecharModal, animateSection } from './ft-ui.js';
import { generateId, esc, parseNum, n2input, applyMaskDecimal } from './ft-format.js';
import { ico } from './ft-icons.js';

const COL = 'config';
const ID  = 'tamanhos';

export const TAMANHOS_DEFAULT = [
    { id: 'P',      nome: 'P',      cm: 25, fator: 1.0,  ativo: true  },
    { id: 'M',      nome: 'M',      cm: 30, fator: 1.3,  ativo: true  },
    { id: 'G',      nome: 'G',      cm: 35, fator: 1.6,  ativo: true  },
    { id: 'GG',     nome: 'GG',     cm: 40, fator: 2.0,  ativo: true  },
    { id: 'tam45',  nome: '45cm',   cm: 45, fator: 2.5,  ativo: false },
    { id: 'tam55',  nome: '55cm',   cm: 55, fator: 3.2,  ativo: false },
    { id: 'tam65',  nome: '65cm',   cm: 65, fator: 4.2,  ativo: false },
    { id: 'tam75',  nome: '75cm',   cm: 75, fator: 5.5,  ativo: false },
];

let _tamanhos = [...TAMANHOS_DEFAULT];
let _loaded   = false;

// ── API pública ───────────────────────────────────────────────────
export async function initTamanhos() {
    if (_loaded) return;
    try {
        const saved = await carregar(COL);
        const cfg   = Array.isArray(saved) ? saved.find(d => d.id === ID) : null;
        if (cfg?.tamanhos?.length) {
            // Migração: garante campo fator em dados antigos
            _tamanhos = cfg.tamanhos.map((t,i) => ({ fator:1+i*0.3, ...t }));
        }
    } catch { /* usa defaults */ }
    _loaded = true;
}

export function getTamanhos()       { return _tamanhos; }
export function getTamanhosAtivos() {
    return _tamanhos
        .filter(t => t.ativo !== false)
        .sort((a, b) => (a.fator ?? a.cm ?? 1) - (b.fator ?? b.cm ?? 1));
}
export function getTamanhoById(id)  { return _tamanhos.find(t => t.id === id) || null; }
export function getNomeTamanho(id)  { return getTamanhoById(id)?.nome || id; }

export async function salvarTamanhos(lista) {
    _tamanhos = lista;
    await salvar(COL, ID, { id: ID, tamanhos: lista });
}

export async function adicionarTamanho(dados) {
    const id   = 'tam_' + Date.now();
    const fats = _tamanhos.map(t => t.fator || 1);
    const maxF = fats.length ? Math.max(...fats) : 1;
    const novo = { id, nome: String(dados.nome||'').trim(), cm: Number(dados.cm)||null,
                   fator: Number(dados.fator)||Math.round((maxF+0.3)*10)/10, ativo: true };
    _tamanhos  = [..._tamanhos, novo];
    await salvarTamanhos(_tamanhos);
    return novo;
}

export async function removerTamanho(id) {
    _tamanhos = _tamanhos.filter(t => t.id !== id);
    await salvarTamanhos(_tamanhos);
}

export async function toggleTamanho(id) {
    _tamanhos = _tamanhos.map(t => t.id === id ? { ...t, ativo: !t.ativo } : t);
    await salvarTamanhos(_tamanhos);
}

// ── UI de Gestão de Tamanhos ──────────────────────────────────────
export function renderTamanhos(containerId) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    animateSection(wrap);

    const lista = [..._tamanhos].sort((a,b) => (a.fator||1)-(b.fator||1));
    wrap.innerHTML = `
    <div class="tam-root">
      <div class="tam-hero">
        <div class="tam-hero-ico">📐</div>
        <div class="tam-hero-text">
          <h2 class="tam-hero-title">Tamanhos do Cardápio</h2>
          <p class="tam-hero-sub">Configure nomes, diâmetros e fatores de custo</p>
        </div>
        <button class="tam-btn-add" id="tam-btn-add" type="button">
          ${ico.plus} Novo tamanho
        </button>
      </div>

      <div class="tam-table-hdr">
        <span>Tamanho</span><span>cm</span><span>Fator</span><span>Status</span><span>Ações</span>
      </div>
      <div class="tam-list" id="tam-list">
        ${lista.map(t => _tamItemHTML(t)).join('')}
      </div>

      <div class="tam-hint">
        💡 O <strong>fator</strong> multiplica o custo base.
        Tamanho base (mais pequeno) = fator <strong>1.0</strong>.
        Ex: G = 1.6× significa que usa 60% a mais de ingredientes que o P.
      </div>
    </div>`;

    document.getElementById('tam-btn-add')?.addEventListener('click', () => _abrirFormTam(null, containerId));
    wrap.querySelectorAll('[data-tam-edit]').forEach(b =>
        b.addEventListener('click', () => _abrirFormTam(b.dataset.tamEdit, containerId)));
    wrap.querySelectorAll('[data-tam-toggle]').forEach(b =>
        b.addEventListener('click', async () => {
            await toggleTamanho(b.dataset.tamToggle);
            renderTamanhos(containerId);
        }));
}

function _tamItemHTML(t) {
    const ativo = t.ativo !== false;
    return `
    <div class="tam-item${ativo ? '' : ' tam-item-off'}">
      <span class="tam-item-pill${ativo ? '' : ' tam-item-pill-off'}">${esc(t.nome)}</span>
      <span class="tam-item-cm">${t.cm ? t.cm + 'cm' : '—'}</span>
      <span class="tam-item-fator">${(t.fator||1).toFixed(1)}×</span>
      <span class="tam-item-status${ativo ? ' active' : ''}">${ativo ? 'Ativo' : 'Inativo'}</span>
      <span class="tam-item-actions">
        <button class="tam-tog-btn" data-tam-toggle="${t.id}" type="button"
          title="${ativo ? 'Desativar' : 'Ativar'}">${ativo ? '✓' : '○'}</button>
        <button class="tam-edit-btn" data-tam-edit="${t.id}" type="button">${ico.edit || '✏️'}</button>
      </span>
    </div>`;
}

function _abrirFormTam(id, containerId) {
    const t = id ? getTamanhoById(id) : null;
    abrirModal(`
      <div class="ft-mhd">
        <button class="ft-mhd-close" id="_tmClose">${ico.close}</button>
        <span class="ft-mhd-title">${t ? 'Editar tamanho' : 'Novo tamanho'}</span>
        ${t ? `<button class="ft-mhd-del" id="_tmDel">${ico.trash}</button>` : '<span style="width:32px"></span>'}
      </div>
      <div class="ft-mbody">
        <div class="ft-field-row">
          <div class="ft-field" style="flex:2">
            <label>Nome do tamanho</label>
            <input id="tm-nome" class="ft-input" type="text"
              placeholder="Ex: G, 35cm, Família, Broto…"
              value="${esc(t?.nome || '')}" autocomplete="off">
          </div>
          <div class="ft-field">
            <label>Diâmetro (cm)</label>
            <input id="tm-cm" class="ft-input" type="text" inputmode="numeric"
              placeholder="35" value="${t?.cm || ''}" autocomplete="off">
          </div>
        </div>
        <div class="ft-field">
          <label>Fator de multiplicação de custo</label>
          <input id="tm-fator" class="ft-input" type="text" inputmode="decimal"
            placeholder="1.0" value="${t ? (t.fator||1).toString().replace('.',',') : '1,0'}" autocomplete="off">
          <small style="font-size:11px;color:var(--ft-txt3);margin-top:4px;display:block">
            1.0 = tamanho base · 1.5 = 50% mais caro · 2.0 = o dobro
          </small>
        </div>
      </div>
      <div class="ft-mft">
        <button class="ft-btn ft-btn-primary ft-btn-full" id="_tmSave" type="button">
          ${ico.save} Salvar tamanho
        </button>
      </div>`, { largo: false });

    const inp = document.getElementById('tm-fator');
    if (inp) applyMaskDecimal(inp);

    document.getElementById('_tmClose')?.addEventListener('click', () => fecharModal(null), { once:true });
    document.getElementById('_tmSave')?.addEventListener('click', async () => {
        const nome  = document.getElementById('tm-nome')?.value.trim();
        const cm    = parseInt(document.getElementById('tm-cm')?.value||'0',10)||null;
        const fator = parseNum(document.getElementById('tm-fator')?.value||'1') || 1;
        if (!nome) { toast('Informe o nome.', 'erro'); return; }
        if (t) {
            const upd = { ...t, nome, cm, fator: Math.max(0.1,fator) };
            _tamanhos = _tamanhos.map(x => x.id === t.id ? upd : x);
            await salvarTamanhos(_tamanhos);
            toast('Tamanho atualizado!', 'sucesso');
        } else {
            await adicionarTamanho({ nome, cm, fator });
            toast('Tamanho criado!', 'sucesso');
        }
        fecharModal('saved');
        renderTamanhos(containerId);
    }, { once:true });

    if (t) {
        document.getElementById('_tmDel')?.addEventListener('click', async () => {
            fecharModal(null);
            await removerTamanho(t.id);
            toast('Tamanho removido.', 'info');
            renderTamanhos(containerId);
        }, { once:true });
    }
}

// ── UI de Gestão de Tamanhos ──────────────────────────────────────
