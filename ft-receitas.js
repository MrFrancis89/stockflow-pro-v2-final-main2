// ft-receitas.js — StockFlow Pro V2
// GAPS: 1(ficha/tamanho) 2(preço inline) 3(alerta custo) 6(peso) 7(custo/kg) 11(categoria) 14(status/tamanho)
import { salvar, carregar, remover }          from './ft-storage.js';
import { calcCustoIngrediente, calcCustoReceita } from './ft-calc.js';
import { formatCurrency, generateId, parseNum, n2input, esc, applyMaskDecimal } from './ft-format.js';
import { toast, abrirModal, fecharModal, confirmar, renderEmpty, renderTutorial, animateSection } from './ft-ui.js';
import { abrirPickerIngrediente }              from './ft-ingredientes.js';
import { getTamanhosAtivos, getTamanhoById }   from './ft-tamanhos.js';
import { ico }                                 from './ft-icons.js';

const COL = 'receitas';
const CATEGORIAS = {
    salgada:  { label: 'Salgada',  cor: '#FF9F0A' },
    doce:     { label: 'Doce',     cor: '#BF5AF2' },
    especial: { label: 'Especial', cor: '#0A84FF' },
    bebida:   { label: 'Bebida',   cor: '#30D158' },
};

let _recs          = [];
let _filtroTam     = '';
let _filtroCat     = '';
let _editVariantes = [];
let _editVarIdx    = 0;

const _R  = v => (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const _P  = v => (v||0).toFixed(1) + '%';

export async function initReceitas()    { _recs = await carregar(COL); }
export function getReceitas()           { return _recs; }
export function getReceitasAtivas()     { return _recs.filter(r => r.ativo !== false); }
export function getReceitaById(id)      { return _recs.find(r => r.id === id) || null; }

function _custoVar(ings)    { return (ings||[]).reduce((s,i) => s+(Number(i.custo)||0), 0); }
function _pesoVar(ings)     { return (ings||[]).reduce((s,i) => s+(Number(i.peso_g)||0), 0); }
function _cKg(c,p)          { return p>0 ? c/(p/1000) : 0; }
function _custoTotal(rec)   { const v=rec.variantes?.find(v=>v.ativo!==false)||rec.variantes?.[0]; return v?.custo_total||rec.custo_total||0; }
function _temAlerta(rec)    { return rec.custo_alerta>0 && _custoTotal(rec)>rec.custo_alerta; }
function _corCat(cat)       { return CATEGORIAS[cat]?.cor||'#888'; }
function _lblCat(cat)       { return CATEGORIAS[cat]?.label||''; }

// ── Render lista ─────────────────────────────────────────────────
export function renderReceitas(busca='') {
    const wrap = document.getElementById('ft-lista-rec');
    if (!wrap) return;
    _tut(); animateSection(wrap);
    const q = busca.trim().toLowerCase();
    const lista = [..._recs]
        .filter(r => {
            if (q && !r.nome.toLowerCase().includes(q)) return false;
            if (_filtroTam && !_recTemTam(r,_filtroTam)) return false;
            if (_filtroCat && r.categoria!==_filtroCat) return false;
            return true;
        })
        .sort((a,b) => { const fa=a.favorito?1:0,fb=b.favorito?1:0; if(fb!==fa) return fb-fa; return a.nome.localeCompare(b.nome,'pt-BR'); });

    const tams = getTamanhosAtivos();
    const chipsTam = [{id:'',nome:'Todos'},...tams].map(t =>
        `<button class="ft-size-chip${_filtroTam===t.id?' active':''}" data-tam="${t.id}" type="button">${esc(t.nome)}</button>`
    ).join('');
    const chipsCat = [['','Todas'],...Object.entries(CATEGORIAS).map(([k,v])=>[k,v.label])].map(([k,l]) =>
        `<button class="ft-cat-chip${_filtroCat===k?' active':''}" data-cat="${k}" type="button">${esc(l)}</button>`
    ).join('');

    wrap.innerHTML = `
        <div class="ft-rec-toolbar">
            <div class="ft-size-chips">${chipsTam}</div>
            <div class="ft-cat-chips">${chipsCat}</div>
            ${lista.length?`<span class="ft-list-hdr-inline">${lista.length} receita${lista.length!==1?'s':''}</span>`:''}
        </div>`;

    if (!lista.length) {
        const sub=document.createElement('div'); wrap.appendChild(sub);
        renderEmpty(sub,ico.recipes,q?'Nenhuma receita encontrada':'Nenhuma receita cadastrada',
            q?'Tente outro termo.':'Crie sua primeira receita tocando em +.',
            q?null:{label:'Nova receita',fn:()=>abrirFormReceita()});
    } else {
        const POR_PAG=30, pagAtual=parseInt(wrap.dataset.page||'0');
        const paginada=lista.slice(pagAtual*POR_PAG,(pagAtual+1)*POR_PAG);
        const listDiv=document.createElement('div');
        listDiv.className='ft-list section-enter';
        listDiv.innerHTML=paginada.map(r=>_itemHTML(r)).join('');
        wrap.appendChild(listDiv);
        if (lista.length>POR_PAG) {
            const totalPag=Math.ceil(lista.length/POR_PAG);
            const pagDiv=document.createElement('div'); pagDiv.className='ft-paginacao';
            pagDiv.innerHTML=`<button class="ft-pag-btn" data-dir="-1" ${pagAtual===0?'disabled':''}>‹</button>
                <span class="ft-pag-info">${pagAtual+1}/${totalPag}</span>
                <button class="ft-pag-btn" data-dir="1" ${pagAtual>=totalPag-1?'disabled':''}>›</button>`;
            wrap.appendChild(pagDiv);
            pagDiv.querySelectorAll('.ft-pag-btn').forEach(b=>b.addEventListener('click',()=>{
                wrap.dataset.page=String(pagAtual+parseInt(b.dataset.dir)); renderReceitas(busca);
            }));
        }
        listDiv.addEventListener('click', async e => {
            const fav=e.target.closest('.ft-fav-btn');
            if (fav) { e.stopPropagation(); const r=getReceitaById(fav.dataset.id); if(!r) return;
                r.favorito=!r.favorito; await salvar(COL,r.id,r);
                renderReceitas(document.getElementById('ft-busca-rec')?.value||''); return; }
            const mb=e.target.closest('.ft-rec-main');
            if (mb) abrirFormReceita(mb.dataset.id);
        });
    }
    if (!wrap.dataset.lOk) {
        wrap.dataset.lOk='1';
        wrap.addEventListener('click',e=>{
            const tc=e.target.closest('.ft-size-chip');
            if(tc){_filtroTam=tc.dataset.tam;wrap.dataset.page='0';renderReceitas(document.getElementById('ft-busca-rec')?.value||'');}
            const cc=e.target.closest('.ft-cat-chip');
            if(cc){_filtroCat=cc.dataset.cat;wrap.dataset.page='0';renderReceitas(document.getElementById('ft-busca-rec')?.value||'');}
        });
    }
}

function _recTemTam(rec,tamId) {
    if (rec.variantes?.length) return rec.variantes.some(v=>v.tamanho_id===tamId);
    return rec.tamanho===tamId;
}

function _itemHTML(r) {
    const alerta = _temAlerta(r);
    const custo  = _custoTotal(r);
    const catCor = _corCat(r.categoria);
    const catLbl = _lblCat(r.categoria);
    const tamPills = r.variantes?.length
        ? r.variantes.filter(v=>v.ativo!==false).map(v=>`<span class="ft-tam-pill" title="Custo:${_R(v.custo_total||0)}">${esc(v.nome_tamanho)}</span>`).join('')
        : `<span class="ft-tam-pill">${esc(r.tamanho||'')}</span>`;
    const ings = r.variantes?.find(v=>v.ativo!==false)?.ingredientes||r.ingredientes||[];
    const chips3 = ings.slice(0,3).map(i=>`<span class="ft-chip">${esc(i.nome)}</span>`).join('')
        +(ings.length>3?`<span class="ft-chip ft-chip-more">+${ings.length-3}</span>`:'');
    return `
    <div class="ft-list-item ft-rec-row${r.ativo===false?' ft-rec-inativo':''}${alerta?' ft-rec-alerta':''}" data-id="${r.id}">
        <button class="ft-rec-main" data-id="${r.id}" type="button">
            <span class="ft-item-ico ft-ico-rec">${ico.recipes}</span>
            <span class="ft-item-body">
                <span class="ft-item-name">
                    ${esc(r.nome)} ${tamPills}
                    ${r.ativo===false?'<span class="ft-inat-badge">inativo</span>':''}
                    ${alerta?'<span class="ft-alerta-custo-badge">⚠ custo alto</span>':''}
                    ${catLbl?`<span class="ft-cat-badge" style="background:${catCor}20;color:${catCor}">${esc(catLbl)}</span>`:''}
                </span>
                <span class="ft-item-chips">${chips3}</span>
            </span>
            <span class="ft-item-end">
                <span class="ft-pill ft-pill-acc">${formatCurrency(custo)}</span>
            </span>
        </button>
        <button class="ft-fav-btn${r.favorito?' on':''}" data-id="${r.id}" type="button">
            ${r.favorito?ico.starFill:ico.star}
        </button>
    </div>`;
}

function _tut() {
    renderTutorial('ft-sec-rec','rec',ico.recipes,'Como criar receitas',[
        'Toque em <strong>+</strong> para criar uma nova receita.',
        'Cada receita pode ter <strong>variantes por tamanho</strong> com ingredientes independentes.',
        'Defina o <strong>preço de venda</strong> e veja o lucro direto na ficha.',
        'Configure um <strong>alerta de custo</strong> para ser avisado quando o limite for ultrapassado.',
        'Filtre por <strong>tamanho</strong> ou <strong>categoria</strong>.',
    ]);
}

// ── Formulário ───────────────────────────────────────────────────
export function abrirFormReceita(id=null, clonarDeId=null) {
    const base=id?getReceitaById(id):clonarDeId?getReceitaById(clonarDeId):null;
    const clonando=!id&&!!clonarDeId;
    if (base?.variantes?.length) {
        _editVariantes=base.variantes.map(v=>({...v,ingredientes:(v.ingredientes||[]).map(i=>({...i}))}));
    } else if (base?.ingredientes?.length) {
        const tA=getTamanhosAtivos(); const tId=base.tamanho||tA[0]?.id||'G';
        _editVariantes=[{tamanho_id:tId,nome_tamanho:getTamanhoById(tId)?.nome||tId,ativo:true,ingredientes:(base.ingredientes||[]).map(i=>({...i})),preco_venda:base.preco_venda||0}];
    } else {
        const tA=getTamanhosAtivos(); const t0=tA[0]||{id:'G',nome:'G'};
        _editVariantes=[{tamanho_id:t0.id,nome_tamanho:t0.nome,ativo:true,ingredientes:[],preco_venda:0}];
    }
    _editVarIdx=0;

    const nomeVal=clonando?`${base?.nome||''} (cópia)`:(base?.nome||'');
    const isAtivo=base?base.ativo!==false:true;
    const alerta=base?.custo_alerta||'';
    const catAtual=base?.categoria||'';
    const catOpts=[['','Sem categoria'],...Object.entries(CATEGORIAS).map(([k,v])=>[k,v.label])]
        .map(([k,l])=>`<option value="${k}"${catAtual===k?' selected':''}>${esc(l)}</option>`).join('');
    const titulo=id?'Editar receita':clonando?'Clonar receita':'Nova receita';

    abrirModal(`
        <div class="ft-mhd">
            <button class="ft-mhd-close" id="_rClose">${ico.close}</button>
            <span class="ft-mhd-title">${titulo}</span>
            ${id?`<button class="ft-mhd-del" id="_rDel">${ico.trash}</button>`:`<span style="width:32px"></span>`}
        </div>
        <div class="ft-mbody">
            <div class="ft-field-row">
                <div class="ft-field" style="flex:2"><label>Nome da receita</label>
                    <input id="ft-rec-nome" class="ft-input" type="text" placeholder="Ex: Margherita…" value="${esc(nomeVal)}" autocomplete="off"></div>
                <div class="ft-field"><label>Categoria</label>
                    <select id="ft-rec-cat" class="ft-input ft-select">${catOpts}</select></div>
            </div>
            <div class="ft-field-row">
                <label class="ft-toggle-label" style="flex:1">
                    <input type="checkbox" id="ft-rec-ativo" class="ft-toggle-cb" ${isAtivo?'checked':''}>
                    <span class="ft-toggle-switch"></span><span class="ft-toggle-txt">Ativa</span>
                </label>
                <div class="ft-field" style="flex:1"><label>⚠ Alerta de custo</label>
                    <div class="ft-input-pre-wrap"><span class="ft-input-pre">R$</span>
                    <input id="ft-rec-alerta" class="ft-input has-pre" type="text" inputmode="decimal"
                        placeholder="Ex: 15,00" value="${alerta?n2input(alerta):''}" autocomplete="off"></div></div>
            </div>
            <div class="ft-var-section">
                <div class="ft-var-header">
                    <span class="ft-var-hdr-title">Tamanhos & Ingredientes</span>
                    <button class="ft-btn ft-btn-sm ft-btn-ghost" id="_rAddVar" type="button">${ico.plus} Add tamanho</button>
                </div>
                <div id="ft-var-tabs" class="ft-var-tabs"></div>
                <div id="ft-var-content" class="ft-var-content"></div>
            </div>
        </div>
        <div class="ft-mft ft-mft-row">
            ${id?`<button class="ft-btn ft-btn-ghost" id="_rClonar" type="button">${ico.copy} Clonar</button>`:''}
            <button class="ft-btn ft-btn-primary${!id?' ft-btn-full':''}" id="_rSave" type="button">${ico.save} Salvar</button>
        </div>`, {largo:true});

    _renderVarTabs(); _renderVarContent();
    document.getElementById('_rClose')?.addEventListener('click',()=>fecharModal(null),{once:true});
    document.getElementById('_rSave')?.addEventListener('click',()=>_save(id),{once:true});
    document.getElementById('_rDel')?.addEventListener('click',async()=>{fecharModal(null);await _del(id);},{once:true});
    document.getElementById('_rClonar')?.addEventListener('click',()=>{fecharModal(null);abrirFormReceita(null,id);},{once:true});
    document.getElementById('_rAddVar')?.addEventListener('click',_addVar);
    const ai=document.getElementById('ft-rec-alerta'); if(ai) applyMaskDecimal(ai);
}

function _renderVarTabs() {
    const tabs=document.getElementById('ft-var-tabs'); if(!tabs) return;
    tabs.innerHTML=_editVariantes.map((v,i)=>{
        const c=_custoVar(v.ingredientes);
        return `<button class="ft-var-tab${i===_editVarIdx?' active':''}${v.ativo===false?' ft-var-tab-inativo':''}" data-vi="${i}" type="button">
            <span>${esc(v.nome_tamanho)}</span>${c>0?`<span class="ft-var-tab-custo">${_R(c)}</span>`:''}
        </button>`;
    }).join('');
    tabs.querySelectorAll('.ft-var-tab').forEach(b=>b.addEventListener('click',()=>{
        _editVarIdx=parseInt(b.dataset.vi); _renderVarTabs(); _renderVarContent();
    }));
}

function _renderVarContent() {
    const wrap=document.getElementById('ft-var-content'); if(!wrap) return;
    const v=_editVariantes[_editVarIdx]; if(!v) return;
    const custo=_custoVar(v.ingredientes), peso=_pesoVar(v.ingredientes);
    const ckg=_cKg(custo,peso), preco=v.preco_venda||0, lucro=preco-custo;
    const margem=preco>0?(lucro/preco)*100:0;
    const tamsA=getTamanhosAtivos(), usados=new Set(_editVariantes.map(v=>v.tamanho_id));
    const tamOpts=tamsA.filter(t=>!usados.has(t.id)||t.id===v.tamanho_id)
        .map(t=>`<option value="${t.id}"${t.id===v.tamanho_id?' selected':''}>${esc(t.nome)}</option>`).join('');

    wrap.innerHTML=`
    <div class="ft-var-pane">
        <div class="ft-var-pane-hdr">
            <div class="ft-field" style="flex:1"><label>Tamanho</label>
                <select id="ft-vt" class="ft-input ft-select">${tamOpts}</select></div>
            <label class="ft-toggle-label" style="flex:1">
                <input type="checkbox" id="ft-va" class="ft-toggle-cb" ${v.ativo!==false?'checked':''}>
                <span class="ft-toggle-switch"></span><span class="ft-toggle-txt">Disponível (GAP 14)</span>
            </label>
            ${_editVariantes.length>1?`<button class="ft-var-del-btn" id="ft-vd" type="button">${ico.trash}</button>`:''}
        </div>
        <div class="ft-field">
            <div class="ft-label-row"><label>Ingredientes</label>
                <button class="ft-btn ft-btn-sm ft-btn-ghost" id="_vai" type="button">${ico.plus} Adicionar</button>
            </div>
            <div id="ft-vi"></div>
        </div>
        <div class="ft-var-totais">
            <div class="ft-var-total-row"><span class="ft-var-total-lbl">Custo total</span><span id="ft-vc">${_R(custo)}</span></div>
            <div class="ft-var-total-row"><span class="ft-var-total-lbl">Peso total</span><span id="ft-vp">${peso>0?peso.toLocaleString('pt-BR')+' g':'—'}</span></div>
            <div class="ft-var-total-row"><span class="ft-var-total-lbl">Custo/kg</span><span id="ft-vk">${ckg>0?_R(ckg)+'/kg':'—'}</span></div>
        </div>
        <div class="ft-var-preco-card">
            <div class="ft-field-row">
                <div class="ft-field"><label>Preço de venda</label>
                    <div class="ft-input-pre-wrap"><span class="ft-input-pre">R$</span>
                    <input id="ft-vpr" class="ft-input has-pre" type="text" inputmode="decimal"
                        placeholder="0,00" value="${preco>0?n2input(preco):''}" autocomplete="off"></div></div>
                <div class="ft-var-lucro-card">
                    <span class="ft-var-lucro-lbl">Lucro bruto</span>
                    <span class="ft-var-lucro-val ${lucro>=0?'green':'red'}" id="ft-vl">${preco>0?_R(lucro):'—'}</span>
                    <span class="ft-var-margem" id="ft-vm">${preco>0?_P(margem):''}</span>
                </div>
            </div>
        </div>
    </div>`;

    _renderIngList();

    document.getElementById('ft-vt')?.addEventListener('change',e=>{
        const tid=e.target.value; const tam=getTamanhoById(tid);
        v.tamanho_id=tid; v.nome_tamanho=tam?.nome||tid; _renderVarTabs();
    });
    document.getElementById('ft-va')?.addEventListener('change',e=>{v.ativo=e.target.checked; _renderVarTabs();});
    document.getElementById('ft-vd')?.addEventListener('click',()=>{
        _editVariantes.splice(_editVarIdx,1); _editVarIdx=Math.min(_editVarIdx,_editVariantes.length-1);
        _renderVarTabs(); _renderVarContent();
    });
    document.getElementById('_vai')?.addEventListener('click',async()=>{
        const ja=v.ingredientes.map(i=>i.ingrediente_id);
        const res=await abrirPickerIngrediente(ja); if(!res) return;
        const {ing,qtd}=res;
        v.ingredientes.push({ingrediente_id:ing.id,nome:ing.nome,quantidade:qtd,unidade:ing.unidade,
            peso_g:ing.unidade==='g'?qtd:(ing.unidade==='kg'?qtd*1000:0),
            custo:calcCustoIngrediente(qtd,ing.custo_unitario)});
        _renderVarContent(); _renderVarTabs();
    });
    const pi=document.getElementById('ft-vpr');
    if(pi){applyMaskDecimal(pi);pi.addEventListener('input',()=>{v.preco_venda=parseNum(pi.value);_updLucro();});}
}

function _renderIngList() {
    const wrap=document.getElementById('ft-vi'); if(!wrap) return;
    const v=_editVariantes[_editVarIdx]; if(!v) return;
    if (!v.ingredientes.length) {
        wrap.innerHTML=`<div class="ft-ings-empty">${ico.ingredients}<span>Nenhum ingrediente. Toque em <strong>+ Adicionar</strong>.</span></div>`;
    } else {
        wrap.innerHTML=`<div class="ft-ings-list">${v.ingredientes.map((ing,idx)=>`
            <div class="ft-ing-row">
                <span class="ft-ing-row-ico">${ico.ingredients}</span>
                <span class="ft-ing-row-body">
                    <span class="ft-ing-row-name">${esc(ing.nome)}</span>
                    <span class="ft-ing-v2-inputs">
                        <span class="ft-ing-inline-wrap">
                            <input class="ft-ing-inline-qtd ft-input" type="text" value="${esc(n2input(ing.quantidade))}"
                                inputmode="decimal" data-idx="${idx}" autocomplete="off">
                            <span class="ft-ing-row-unit">${ing.unidade}</span>
                        </span>
                        <span class="ft-ing-peso-wrap" title="Peso em gramas">
                            <input class="ft-ing-peso ft-input" type="text"
                                value="${ing.peso_g>0?ing.peso_g:''}" inputmode="numeric"
                                data-idx="${idx}" placeholder="g" autocomplete="off">
                            <span class="ft-ing-row-unit">g</span>
                        </span>
                    </span>
                </span>
                <span class="ft-ing-row-cost" id="_vc_${idx}">${formatCurrency(ing.custo)}</span>
                <button class="ft-ing-row-rm" data-idx="${idx}">${ico.close}</button>
            </div>`).join('')}</div>`;

        wrap.querySelectorAll('.ft-ing-inline-qtd').forEach(inp=>{
            applyMaskDecimal(inp);
            inp.addEventListener('input',()=>{
                const idx=parseInt(inp.dataset.idx); const item=v.ingredientes[idx]; if(!item) return;
                const cup=item.quantidade>0?item.custo/item.quantidade:0;
                item.quantidade=parseNum(inp.value); item.custo=item.quantidade*cup;
                const ce=document.getElementById(`_vc_${idx}`); if(ce) ce.textContent=formatCurrency(item.custo);
                _updTotais();
            });
        });
        wrap.querySelectorAll('.ft-ing-peso').forEach(inp=>{
            inp.addEventListener('input',()=>{
                const idx=parseInt(inp.dataset.idx); const item=v.ingredientes[idx]; if(!item) return;
                item.peso_g=parseFloat(inp.value.replace(',','.'))||0; _updTotais();
            });
        });
        wrap.querySelectorAll('.ft-ing-row-rm').forEach(b=>b.addEventListener('click',()=>{
            v.ingredientes.splice(parseInt(b.dataset.idx),1); _renderIngList(); _updTotais(); _renderVarTabs();
        }));
    }
    _updTotais();
}

function _updTotais() {
    const v=_editVariantes[_editVarIdx]; if(!v) return;
    const c=_custoVar(v.ingredientes), p=_pesoVar(v.ingredientes), k=_cKg(c,p);
    v.custo_total=c; v.peso_total_g=p; v.custo_kg=k;
    const el=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;};
    el('ft-vc',_R(c)); el('ft-vp',p>0?p.toLocaleString('pt-BR')+' g':'—'); el('ft-vk',k>0?_R(k)+'/kg':'—');
    _updLucro(); _renderVarTabs();
}

function _updLucro() {
    const v=_editVariantes[_editVarIdx]; if(!v) return;
    const c=v.custo_total||0, pr=v.preco_venda||0, l=pr-c, m=pr>0?(l/pr)*100:0;
    const le=document.getElementById('ft-vl'), me=document.getElementById('ft-vm');
    if(le){le.textContent=pr>0?_R(l):'—'; le.className=`ft-var-lucro-val ${l>=0?'green':'red'}`;}
    if(me) me.textContent=pr>0?_P(m):'';
}

function _addVar() {
    const tA=getTamanhosAtivos(), usados=new Set(_editVariantes.map(v=>v.tamanho_id));
    const disp=tA.find(t=>!usados.has(t.id));
    if(!disp){toast('Todos os tamanhos já foram adicionados.','aviso');return;}
    _editVariantes.push({tamanho_id:disp.id,nome_tamanho:disp.nome,ativo:true,ingredientes:[],preco_venda:0});
    _editVarIdx=_editVariantes.length-1; _renderVarTabs(); _renderVarContent();
}

async function _save(id) {
    const nome=document.getElementById('ft-rec-nome')?.value.trim();
    const cat=document.getElementById('ft-rec-cat')?.value||'';
    const ativo=document.getElementById('ft-rec-ativo')?.checked!==false;
    const alertaV=parseNum(document.getElementById('ft-rec-alerta')?.value||'');
    if (!nome) {
        const el=document.getElementById('ft-rec-nome'); el?.classList.add('err');
        el?.addEventListener('input',()=>el.classList.remove('err'),{once:true});
        toast('Informe o nome da receita.','erro'); return;
    }
    const variantes=_editVariantes.map(v=>({...v,
        custo_total:_custoVar(v.ingredientes),peso_total_g:_pesoVar(v.ingredientes),
        custo_kg:_cKg(_custoVar(v.ingredientes),_pesoVar(v.ingredientes))}));
    const prim=variantes.find(v=>v.ativo!==false)||variantes[0];
    const obj={id:id||generateId(),nome,ativo,categoria:cat,
        custo_alerta:alertaV||null,variantes,
        tamanho:prim?.nome_tamanho||prim?.tamanho_id||'G',
        ingredientes:prim?.ingredientes||[],custo_total:prim?.custo_total||0,
        preco_venda:prim?.preco_venda||0,
        favorito:id?(getReceitaById(id)?.favorito||false):false,criadoEm:Date.now()};
    const btn=document.getElementById('_rSave'); if(btn) btn.disabled=true;
    try {
        await salvar(COL,obj.id,obj);
        if(id){const i=_recs.findIndex(r=>r.id===id);if(i>=0)_recs[i]=obj;else _recs.push(obj);}
        else _recs.push(obj);
        fecharModal('saved'); toast(id?'Receita atualizada!':'Receita criada!','sucesso');
        renderReceitas(document.getElementById('ft-busca-rec')?.value||'');
        document.dispatchEvent(new CustomEvent('ft:recs-changed'));
    } catch(e) {
        toast('Erro ao salvar.','erro'); if(btn) btn.disabled=false; console.error(e);
    }
}

async function _del(id) {
    const r=getReceitaById(id); if(!r) return;
    const ok=await confirmar(`Remover <strong>${esc(r.nome)}</strong>?<br>Não pode ser desfeito.`,{labelOK:'Remover'});
    if(!ok) return;
    await remover(COL,id); _recs=_recs.filter(r=>r.id!==id);
    toast('Receita removida.','info');
    renderReceitas(document.getElementById('ft-busca-rec')?.value||'');
    document.dispatchEvent(new CustomEvent('ft:recs-changed'));
}
