// ft-cardapio.js — StockFlow Pro V2 — GAP 8 (cardápio visual) + GAP 13 (impressão)
import { getReceitasAtivas } from './ft-receitas.js';
import { getTamanhosAtivos } from './ft-tamanhos.js';
import { esc }               from './ft-format.js';
import { renderEmpty, animateSection } from './ft-ui.js';
import { ico }               from './ft-icons.js';

const _R = v => (v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const CAT_COR = {salgada:'#FF9F0A',doce:'#BF5AF2',especial:'#0A84FF',bebida:'#30D158'};
const CAT_LBL = {salgada:'Salgada',doce:'Doce',especial:'Especial',bebida:'Bebida'};
let _filtroCat='', _modoView='grade';

export function renderCardapio() {
    const wrap=document.getElementById('ft-cardapio'); if(!wrap) return;
    animateSection(wrap);
    const recs=getReceitasAtivas(), tams=getTamanhosAtivos();
    if (!recs.length) { renderEmpty(wrap,ico.recipes,'Cardápio vazio','Cadastre receitas para montar o cardápio.'); return; }

    const catsUsadas=[...new Set(recs.map(r=>r.categoria||'').filter(Boolean))];
    const chipsCat=[['','Todos'],...catsUsadas.map(k=>[k,CAT_LBL[k]||k])].map(([k,l])=>
        `<button class="ft-cat-chip${_filtroCat===k?' active':''}" data-cat="${k}" type="button">${esc(l)}</button>`).join('');

    wrap.innerHTML=`
    <div class="card-root">
        <div class="card-toolbar">
            <div class="card-filtros">${chipsCat}</div>
            <div class="card-actions">
                <button class="ft-btn ft-btn-sm ft-btn-ghost card-view-btn${_modoView==='grade'?' active':''}" data-view="grade" type="button">⊞ Grade</button>
                <button class="ft-btn ft-btn-sm ft-btn-ghost card-view-btn${_modoView==='lista'?' active':''}" data-view="lista" type="button">☰ Lista</button>
                <button class="ft-btn ft-btn-sm ft-btn-primary" id="card-print-btn" type="button">🖨 Imprimir</button>
            </div>
        </div>
        <div id="card-conteudo">${_modoView==='grade'?_renderGrade(recs,tams):_renderLista(recs,tams)}</div>
    </div>`;

    // Guard: re-cria o innerHTML inteiro, então os listeners antigos são descartados
    // automaticamente. Apenas listeners externos precisam de guard.
    wrap.querySelectorAll('.ft-cat-chip').forEach(b=>b.addEventListener('click',()=>{_filtroCat=b.dataset.cat;renderCardapio();}));
    wrap.querySelectorAll('.card-view-btn').forEach(b=>b.addEventListener('click',()=>{_modoView=b.dataset.view;renderCardapio();}));
    document.getElementById('card-print-btn')?.addEventListener('click',()=>_imprimir(recs,tams));
}

function _filtrar(recs){return recs.filter(r=>!_filtroCat||r.categoria===_filtroCat);}

function _renderGrade(recs,tams){
    const f=_filtrar(recs); if(!f.length) return `<div class="card-empty">Nenhuma receita nesta categoria.</div>`;
    const grupos={};
    f.forEach(r=>{const c=r.categoria||'_';if(!grupos[c])grupos[c]=[];grupos[c].push(r);});
    return Object.entries(grupos).map(([cat,lista])=>`
    <div class="card-grupo">
        <div class="card-grupo-hdr">
            ${cat!=='_'?`<span class="card-grupo-dot" style="background:${CAT_COR[cat]||'#888'}"></span><span class="card-grupo-nome">${esc(CAT_LBL[cat]||cat)}</span>`:`<span class="card-grupo-nome">Geral</span>`}
            <span class="card-grupo-count">${lista.length} receita${lista.length!==1?'s':''}</span>
        </div>
        <div class="card-grade">${lista.map(r=>_cardItem(r,tams)).join('')}</div>
    </div>`).join('');
}

function _cardItem(r,tams){
    const temAlerta=r.custo_alerta>0&&(r.custo_total||0)>r.custo_alerta;
    const catCor=CAT_COR[r.categoria]||'transparent';
    const tamCols=tams.map(t=>{
        const v=r.variantes?.find(v=>v.tamanho_id===t.id);
        const disp=v?v.ativo!==false:(r.tamanho===t.id);
        const preco=v?.preco_venda||(!r.variantes&&disp?r.preco_venda:0);
        return `<div class="card-tam-cell ${disp?'dispon':'indisp'}">
            <span class="card-tam-nome">${esc(t.nome)}</span>
            ${disp?`<span class="card-dispon-dot"></span>${preco>0?`<span class="card-tam-preco">${_R(preco)}</span>`:''}`:
                   `<span class="card-indisp-dot"></span>`}
        </div>`;
    }).join('');
    return `
    <div class="card-item${temAlerta?' card-item-alerta':''}">
        <div class="card-item-faixa" style="background:${catCor}"></div>
        <div class="card-item-body">
            <div class="card-item-nome">${esc(r.nome)}${temAlerta?'<span class="card-alerta-ico">⚠</span>':''}</div>
            <div class="card-item-custo">Custo: ${_R(r.custo_total||0)}</div>
            <div class="card-tams">${tamCols}</div>
        </div>
    </div>`;
}

function _renderLista(recs,tams){
    const f=_filtrar(recs); if(!f.length) return `<div class="card-empty">Nenhuma receita nesta categoria.</div>`;
    const hCols=tams.map(t=>`<th class="card-th">${esc(t.nome)}</th>`).join('');
    const rows=f.map(r=>{
        const cols=tams.map(t=>{
            const v=r.variantes?.find(v=>v.tamanho_id===t.id);
            const disp=v?v.ativo!==false:r.tamanho===t.id;
            const preco=v?.preco_venda||(!r.variantes&&disp?r.preco_venda:0);
            return `<td class="card-td ${disp?'disp-ok':'disp-no'}">${disp?(preco>0?_R(preco):'◉'):'—'}</td>`;
        }).join('');
        return `<tr class="card-tr"><td class="card-td card-td-nome">${esc(r.nome)}</td><td class="card-td">${_R(r.custo_total||0)}</td>${cols}</tr>`;
    }).join('');
    return `<div class="card-table-wrap"><table class="card-table">
        <thead><tr><th class="card-th">Receita</th><th class="card-th">Custo</th>${hCols}</tr></thead>
        <tbody>${rows}</tbody></table></div>`;
}

function _imprimir(recs,tams){
    const f=_filtrar(recs);
    const hCols=tams.map(t=>`<th>${esc(t.nome)}</th>`).join('');
    const rows=f.map(r=>{
        const cols=tams.map(t=>{
            const v=r.variantes?.find(v=>v.tamanho_id===t.id);
            const disp=v?v.ativo!==false:r.tamanho===t.id;
            const preco=v?.preco_venda||(!r.variantes&&disp?r.preco_venda:0);
            return `<td style="text-align:center">${disp?(preco>0?_R(preco):'◉'):'–'}</td>`;
        }).join('');
        return `<tr><td>${esc(r.nome)}</td>${cols}</tr>`;
    }).join('');
    const w=window.open('','_blank','width=900,height=700');
    if(!w){alert('Permita pop-ups para imprimir.');return;}
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Cardápio</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:12px;padding:20px}
    h1{font-size:20px;font-weight:700;margin-bottom:4px}p{font-size:11px;color:#666;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:6px 10px;text-align:left}
    th:not(:first-child){text-align:center;min-width:60px}tr:nth-child(even){background:#f5f5f5}
    td{padding:5px 10px;border-bottom:1px solid #e0e0e0}td:not(:first-child){text-align:center}
    @media print{@page{margin:1cm}}</style></head><body>
    <h1>Cardápio</h1><p>Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
    <table><thead><tr><th>Receita</th>${hCols}</tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
}

// GAP fix: initCardapio para ft-app.js
export async function initCardapio() { /* dados já carregados via getReceitasAtivas */ }
