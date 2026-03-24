// ft-precifica.js — StockFlow Pro v10.0
// ═══════════════════════════════════════════════════════════════
// Módulo de Precificação · Ficha Técnica
// Design: Apple premium · 5 ferramentas de gestão financeira
// ═══════════════════════════════════════════════════════════════
// v10.0 — TAREFA 1: cálculos delegados a ft-calc.js (API padrão).
//         UI e lógica de negócio permanecem aqui — zero quebras.
// ═══════════════════════════════════════════════════════════════

import {
    calcularMargem,
    calcularPrecoSugerido,
    calcLucro,
    calcMarkupImplicito,
} from './ft-calc.js';

// ─── Formatação ───────────────────────────────────────────────
const _R = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const _P = v => v.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + '%';
const _N = v => v.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });

const _n = id => {
  const v = document.getElementById(id)?.value ?? '';
  return parseFloat(v.replace(/\./g,'').replace(',','.')) || 0;
};

const _q   = id => document.getElementById(id);
const _set = (id,v) => { const e=_q(id); if(e) e.textContent=v; };
const _cls = (id,c) => { const e=_q(id); if(e) e.className='prc-val '+c; };
const _show = id => _q(id)?.classList.remove('prc-hidden');
const _hide = id => _q(id)?.classList.add('prc-hidden');
const _gauge = (id,pct,color) => {
  const e=_q(id); if(!e) return;
  e.style.width=Math.min(100,Math.max(0,pct))+'%';
  e.style.background=color||(pct<30?'var(--ft-green)':pct<55?'var(--ft-acc)':'var(--ft-red)');
};

// ─── Ícones SVG ───────────────────────────────────────────────
const S = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  decomp: S('<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'),
  markup: S('<path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="2"/>'),
  cmv:    S('<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4l-5 5-4-4-6 6"/>'),
  marg:   S('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'),
  pct:    S('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'),
  calc:   S('<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>'),
  check:  S('<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  info:   S('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'),
  target: S('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  box:    S('<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>'),
  up:     S('<polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/>'),
  down:   S('<polyline points="7 13 12 18 17 13"/><line x1="12" y1="6" x2="12" y2="18"/>'),
  money:  S('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/>'),
};

// ─── Construtores HTML ────────────────────────────────────────
const _fR = (lbl,id,ph='0,00') => `<div class="ft-field"><label>${lbl}</label><div class="ft-input-pre-wrap"><span class="ft-input-pre">R$</span><input class="ft-input has-pre" id="${id}" type="text" inputmode="decimal" placeholder="${ph}" autocomplete="off" autocorrect="off"></div></div>`;
const _fP = (lbl,id,ph='0') => `<div class="ft-field"><label>${lbl}</label><div class="ft-input-suf-wrap"><input class="ft-input has-suf" id="${id}" type="text" inputmode="decimal" placeholder="${ph}" autocomplete="off" autocorrect="off"><span class="ft-input-suf">%</span></div></div>`;
const _fN = (lbl,id,ph='0',mode='decimal') => `<div class="ft-field"><label>${lbl}</label><input class="ft-input" id="${id}" type="text" inputmode="${mode}" placeholder="${ph}" autocomplete="off" autocorrect="off"></div>`;

const _tip = text => `<div class="prc-tip">${ICO.info}<span>${text}</span></div>`;

const _btnCalc = (id,lbl) => `<button class="ft-btn ft-btn-primary ft-btn-full prc-calc-btn" id="${id}" type="button"><span class="ft-bico">${ICO.calc}</span>${lbl}</button>`;
const _btnClear = key => `<button class="ft-btn ft-btn-ghost ft-btn-full" data-prc-clear="${key}" type="button" style="margin-top:6px;font-size:14px;padding:10px 16px">Limpar</button>`;

const _toggle = (id1,l1,id2,l2) => `<div class="prc-mode-toggle" role="group"><button class="prc-mode-btn active" id="${id1}" type="button">${l1}</button><button class="prc-mode-btn" id="${id2}" type="button">${l2}</button></div>`;

const _section = (icon,title,body) => `<div class="prc-section"><div class="prc-sec-hd">${icon}<span>${title}</span></div><div class="prc-sec-body">${body}</div></div>`;

const _resCard = (id,title,rows) => `<div class="prc-res-card prc-hidden" id="${id}"><div class="prc-res-hd">${ICO.check}<span>${title}</span></div><div class="prc-res-body">${rows}</div></div>`;

const _stat = (lbl,id,cls='') => `<div class="prc-stat"><span class="prc-stat-lbl">${lbl}</span><span class="prc-val ${cls}" id="${id}">—</span></div>`;

const _bigVal = (lbl,id,cls,sub='') => `<div class="prc-big"><span class="prc-big-lbl">${lbl}</span><span class="prc-val prc-val-xl ${cls}" id="${id}">—</span>${sub?`<span class="prc-big-sub" id="${id}-s">${sub}</span>`:''}</div>`;

const _gauge_html = (id,subId) => `<div class="prc-gauge-wrap"><div class="prc-gauge-track"><div class="prc-gauge-fill" id="${id}" style="width:0%"></div></div><span class="prc-gauge-lbl" id="${subId}"></span></div>`;

// ─── HTML Principal ───────────────────────────────────────────
function _buildHTML() {
return `<div class="prc-root" id="prc-root">

<!-- SUB-NAV -->
<div class="prc-subnav-wrap">
  <nav class="prc-subnav" role="tablist">
    <button class="prc-tab active" data-prc="decomp" role="tab" aria-selected="true">
      <span class="prc-tab-ico">${ICO.decomp}</span><span class="prc-tab-lbl">Decomp.</span>
    </button>
    <button class="prc-tab" data-prc="markup" role="tab" aria-selected="false">
      <span class="prc-tab-ico">${ICO.markup}</span><span class="prc-tab-lbl">Markup</span>
    </button>
    <button class="prc-tab" data-prc="cmv" role="tab" aria-selected="false">
      <span class="prc-tab-ico">${ICO.cmv}</span><span class="prc-tab-lbl">CMV</span>
    </button>
    <button class="prc-tab" data-prc="marg" role="tab" aria-selected="false">
      <span class="prc-tab-ico">${ICO.marg}</span><span class="prc-tab-lbl">Margem</span>
    </button>
    <button class="prc-tab" data-prc="pct" role="tab" aria-selected="false">
      <span class="prc-tab-ico">${ICO.pct}</span><span class="prc-tab-lbl">%</span>
    </button>
  </nav>
  <div class="prc-ink" id="prc-ink" aria-hidden="true"></div>
</div>

<div class="prc-panels">

<!-- ═══ 1. DECOMPOSIÇÃO ═══ -->
<div class="prc-pane" id="prc-pane-decomp">
  <header class="prc-hero">
    <div class="prc-hero-ico">${ICO.decomp}</div>
    <div class="prc-hero-text">
      <h2 class="prc-hero-title">Decomposição de Preço</h2>
      <p class="prc-hero-sub">Analise a rentabilidade real de cada venda</p>
    </div>
  </header>

  ${_section(ICO.box, 'Dados Mensais', `
    <div class="ft-field-row">${_fR('Faturamento','d-fat','0')}${_fR('Custo Fixo','d-cf','0')}</div>
    ${_fN('Unidades vendidas / mês','d-qtd','Ex: 300','numeric')}
  `)}

  ${_section(ICO.pct, 'Custos Variáveis', `
    <div class="ft-field-row">${_fP('Comissão','d-comis','0')}${_fP('Impostos','d-imp','0')}</div>
    ${_fP('Taxa de Cartão','d-cart','0')}
  `)}

  ${_section(ICO.money, 'Produto Unitário', `
    <div class="ft-field-row">${_fR('Custo de Produção','d-custo','0,00')}${_fR('Preço de Venda','d-preco','0,00')}</div>
    ${_btnCalc('prc-btn-decomp','Calcular Decomposição')}
    ${_btnClear('decomp')}
  `)}

  ${_resCard('prc-result-decomp','Resultado da Decomposição',`
    ${_bigVal('Lucro Real / unidade','pr-lucro','green','calculado')}
    <div class="prc-stats-row">
      ${_stat('Margem','pr-margem','amber')}
      ${_stat('CMV','pr-cmv','')}
      ${_stat('Markup','pr-markup','')}
      ${_stat('CF / unid.','pr-cfu','blue')}
      ${_stat('CV / unid.','pr-cv','')}
    </div>
    ${_gauge_html('pr-be-bar','pr-be-sub')}
    <div class="prc-be-chip"><span class="prc-val amber" id="pr-be">—</span><span id="pr-be-s" style="font-size:12px;color:var(--ft-txt3)">unidades / mês (ponto de equilíbrio)</span></div>
    <div class="prc-breakdown" id="pr-bd"></div>
  `)}
</div>

<!-- ═══ 2. MARKUP ═══ -->
<div class="prc-pane prc-hidden" id="prc-pane-markup">
  <header class="prc-hero">
    <div class="prc-hero-ico">${ICO.markup}</div>
    <div class="prc-hero-text">
      <h2 class="prc-hero-title">Calculadora de Markup</h2>
      <p class="prc-hero-sub">O multiplicador certo para cobrir todos os custos</p>
    </div>
  </header>

  ${_tip('Informe o faturamento, custos fixos e metas para calcular o markup necessário.')}

  ${_section(ICO.markup, 'Parâmetros', `
    <div class="ft-field-row">${_fR('Faturamento Mensal','mk-fat','0')}${_fR('Custos Fixos','mk-cf','0')}</div>
    <div class="ft-field-row">${_fP('Impostos + Taxas','mk-imp','0')}${_fP('Margem Desejada','mk-marg','20')}</div>
    ${_fR('Custo do Produto','mk-custo','0,00')}
    ${_btnCalc('prc-btn-markup','Calcular Markup')}
    ${_btnClear('markup')}
  `)}

  ${_resCard('prc-result-markup','Markup Calculado',`
    <div class="prc-dual-big">
      ${_bigVal('Markup Necessário','mk-r-mk','amber','multiplicador')}
      ${_bigVal('Preço de Venda','mk-r-pv','green','sugerido')}
    </div>
    <div class="prc-stats-row">
      ${_stat('Custo Fixo %','mk-r-cfp','')}
      ${_stat('Markup em %','mk-r-mkp','blue')}
    </div>
    ${_gauge_html('mk-gauge','mk-r-comp')}
  `)}
</div>

<!-- ═══ 3. CMV ═══ -->
<div class="prc-pane prc-hidden" id="prc-pane-cmv">
  <header class="prc-hero">
    <div class="prc-hero-ico">${ICO.cmv}</div>
    <div class="prc-hero-text">
      <h2 class="prc-hero-title">Custo da Mercadoria Vendida</h2>
      <p class="prc-hero-sub">Direto ou reverso — controle o CMV da operação</p>
    </div>
  </header>

  ${_toggle('cmv-btn-dir','Direto → CMV%','cmv-btn-rev','Reverso → Preço Ideal')}

  <div id="cmv-pane-dir">
    ${_tip('Informe custo e preço de venda para obter o % de CMV e a margem gerada.')}
    ${_section(ICO.cmv,'CMV Direto',`
      <div class="ft-field-row">${_fR('Custo do Produto','cmvd-custo','21,52')}${_fR('Preço de Venda','cmvd-preco','57,00')}</div>
      ${_btnCalc('prc-btn-cmvdir','Calcular CMV')}
      ${_btnClear('cmvdir')}
    `)}
    ${_resCard('prc-result-cmvd','Resultado CMV',`
      <div class="prc-dual-big">
        ${_bigVal('CMV %','cmvd-r-pct','amber','custo sobre venda')}
        ${_bigVal('Margem Bruta','cmvd-r-marg','green','da receita')}
      </div>
      <div class="prc-stats-row">
        ${_stat('Lucro Bruto','cmvd-r-lucro','')}
        ${_stat('Markup','cmvd-r-mk','')}
      </div>
      ${_gauge_html('cmvd-gauge','cmvd-gauge-lbl')}
    `)}
  </div>

  <div id="cmv-pane-rev" class="prc-hidden">
    ${_tip('Defina o custo e o CMV alvo — descubra o preço de venda necessário.')}
    ${_section(ICO.target,'CMV Reverso',`
      <div class="ft-field-row">${_fR('Custo do Produto','cmvr-custo','21,52')}${_fP('CMV Desejado','cmvr-meta','35')}</div>
      ${_btnCalc('prc-btn-cmvrev','Calcular Preço Ideal')}
      ${_btnClear('cmvrev')}
    `)}
    ${_resCard('prc-result-cmvr','Preço Ideal',`
      ${_bigVal('Preço de Venda Sugerido','cmvr-r-pv','green','para atingir o CMV desejado')}
      <div class="prc-stats-row">
        ${_stat('Margem Bruta','cmvr-r-marg','amber')}
        ${_stat('Lucro Bruto','cmvr-r-lucro','')}
      </div>
    `)}
  </div>
</div>

<!-- ═══ 4. MARGEM ═══ -->
<div class="prc-pane prc-hidden" id="prc-pane-marg">
  <header class="prc-hero">
    <div class="prc-hero-ico">${ICO.marg}</div>
    <div class="prc-hero-text">
      <h2 class="prc-hero-title">Análise de Margem</h2>
      <p class="prc-hero-sub">Lucro real ou custo alvo — dois ângulos complementares</p>
    </div>
  </header>

  ${_toggle('mg-btn-luc','Análise de Lucro','mg-btn-custo','Custo Alvo')}

  <div id="mg-pane-luc">
    ${_section(ICO.marg,'Análise de Lucro',`
      <div class="ft-field-row">${_fR('Custo do Produto','mgl-custo','0,00')}${_fR('Preço de Venda','mgl-preco','0,00')}</div>
      ${_btnCalc('prc-btn-mgluc','Analisar Lucro')}
      ${_btnClear('mgluc')}
    `)}
    ${_resCard('prc-result-mgl','Análise de Lucro',`
      <div class="prc-dual-big">
        ${_bigVal('Margem Bruta','mgl-r-marg','green','')}
        ${_bigVal('Lucro Bruto','mgl-r-lucro','amber','')}
      </div>
      <div class="prc-stats-row">
        ${_stat('CMV %','mgl-r-cmv','')}
        ${_stat('Markup','mgl-r-mk','')}
      </div>
      ${_gauge_html('mgl-gauge','mgl-gauge-lbl')}
    `)}
  </div>

  <div id="mg-pane-custo" class="prc-hidden">
    ${_tip('Informe o preço e a margem desejada para calcular o custo máximo permitido.')}
    ${_section(ICO.target,'Custo Alvo',`
      <div class="ft-field-row">${_fR('Preço de Venda','mgc-preco','0,00')}${_fP('Margem Desejada','mgc-marg','30')}</div>
      ${_btnCalc('prc-btn-mgcusto','Calcular Custo Alvo')}
      ${_btnClear('mgcusto')}
    `)}
    ${_resCard('prc-result-mgc','Custo Alvo',`
      <div class="prc-dual-big">
        ${_bigVal('Custo Máximo','mgc-r-custo','amber','limite de produção')}
        ${_bigVal('Lucro / unidade','mgc-r-lucro','green','')}
      </div>
      ${_gauge_html('mgc-gauge','mgc-gauge-lbl')}
    `)}
  </div>
</div>

<!-- ═══ 5. PORCENTAGENS ═══ -->
<div class="prc-pane prc-hidden" id="prc-pane-pct">
  <header class="prc-hero">
    <div class="prc-hero-ico">${ICO.pct}</div>
    <div class="prc-hero-text">
      <h2 class="prc-hero-title">Calculadora de %</h2>
      <p class="prc-hero-sub">Quatro operações em um só lugar</p>
    </div>
  </header>

  <div class="prc-pct-grid" role="group">
    <button class="prc-pct-btn active" id="pct-btn-calc" data-pct="calc" type="button">
      <span class="prc-pct-ico">${ICO.pct}</span>
      <strong>X% de Y</strong>
      <span class="prc-pct-eg">15% de 200</span>
    </button>
    <button class="prc-pct-btn" id="pct-btn-acr" data-pct="acr" type="button">
      <span class="prc-pct-ico">${ICO.up}</span>
      <strong>Acréscimo</strong>
      <span class="prc-pct-eg">200 + 15%</span>
    </button>
    <button class="prc-pct-btn" id="pct-btn-desc" data-pct="desc" type="button">
      <span class="prc-pct-ico">${ICO.down}</span>
      <strong>Desconto</strong>
      <span class="prc-pct-eg">200 − 15%</span>
    </button>
    <button class="prc-pct-btn" id="pct-btn-rep" data-pct="rep" type="button">
      <span class="prc-pct-ico">${ICO.pct}</span>
      <strong>Representação</strong>
      <span class="prc-pct-eg">X é ?% de Y</span>
    </button>
  </div>

  <div id="pct-pane-calc">
    ${_section(ICO.pct,'X% de Y',`
      <div class="ft-field-row">${_fP('Porcentagem','pc-pct','15')}${_fR('Valor Total','pc-tot','200')}</div>
      ${_btnCalc('prc-btn-pct-calc','Calcular')}
      ${_btnClear('pct-calc')}
    `)}
    ${_resCard('prc-result-pc','Resultado',`
      ${_bigVal('Resultado','pc-r-val','amber','')}
    `)}
  </div>

  <div id="pct-pane-acr" class="prc-hidden">
    ${_section(ICO.up,'Acréscimo',`
      <div class="ft-field-row">${_fR('Valor Base','pa-base','200')}${_fP('Acréscimo','pa-pct','15')}</div>
      ${_btnCalc('prc-btn-pct-acr','Calcular')}
      ${_btnClear('pct-acr')}
    `)}
    ${_resCard('prc-result-pa','Com Acréscimo',`
      <div class="prc-dual-big">
        ${_bigVal('Valor Final','pa-r-final','green','')}
        ${_bigVal('Acréscimo R$','pa-r-acr','amber','')}
      </div>
    `)}
  </div>

  <div id="pct-pane-desc" class="prc-hidden">
    ${_section(ICO.down,'Desconto',`
      <div class="ft-field-row">${_fR('Valor Original','pd-base','200')}${_fP('Desconto','pd-pct','15')}</div>
      ${_btnCalc('prc-btn-pct-desc','Calcular')}
      ${_btnClear('pct-desc')}
    `)}
    ${_resCard('prc-result-pd','Com Desconto',`
      <div class="prc-dual-big">
        ${_bigVal('Valor com Desconto','pd-r-final','green','')}
        ${_bigVal('Desconto R$','pd-r-desc','red','')}
      </div>
    `)}
  </div>

  <div id="pct-pane-rep" class="prc-hidden">
    ${_section(ICO.pct,'Representação',`
      <div class="ft-field-row">${_fR('Valor Parcial (X)','pr-x','0')}${_fR('Total (Y)','pr-y','0')}</div>
      ${_btnCalc('prc-btn-pct-rep','Calcular %')}
      ${_btnClear('pct-rep')}
    `)}
    ${_resCard('prc-result-pr','Representação',`
      ${_bigVal('X representa','pr-r-pct','amber','')}
    `)}
  </div>
</div>

</div><!-- /prc-panels -->
</div><!-- /prc-root -->`;
}

// ─── Cálculos ─────────────────────────────────────────────────

function _calcDecomp() {
  const fat=_n('d-fat'),cf=_n('d-cf'),qtd=_n('d-qtd');
  const comis=_n('d-comis'),imp=_n('d-imp'),cart=_n('d-cart');
  const custo=_n('d-custo'),preco=_n('d-preco');
  if(!preco||!custo) return;

  const cfu=qtd>0?cf/qtd:null;
  const comisR=preco*(comis/100),impR=preco*(imp/100),cartR=preco*(cart/100),cv=comisR+impR+cartR;
  const lucro=preco-custo-(cfu??0)-cv;
  const margem=preco>0?(lucro/preco)*100:0;
  const cmv=preco>0?(custo/preco)*100:0;
  const markup=calcMarkupImplicito(preco, custo);
  const mc=preco-cv-custo;
  const be=mc>0?Math.ceil(cf/mc):Infinity;
  const bePct=qtd>0?(be/qtd)*100:0;

  _set('pr-lucro',_R(lucro));
  const lSub=_q('pr-lucro-s');
  if(lSub) lSub.textContent=qtd>0?'por unidade (custo fixo rateado)':'por unidade (informe qtd para custo fixo)';
  _cls('pr-lucro',lucro>=0?'green':'red');
  _set('pr-margem',_P(margem)); _cls('pr-margem',margem>=20?'amber':margem>=10?'':'red');
  _set('pr-cmv',_P(cmv));
  _set('pr-markup',_N(markup)+'%');
  _set('pr-cfu',cfu!==null?_R(cfu):'—');
  _set('pr-cv',_R(cv));
  _set('pr-be',isFinite(be)?be+' un.':'∞');
  const beSub=_q('pr-be-s');
  if(beSub) beSub.textContent=isFinite(be)?`unidades/mês para cobrir ${_R(cf)} de custo fixo`:cf>0?'MC negativa':'sem custo fixo';
  _gauge('pr-be-bar',bePct,bePct>80?'var(--ft-red)':bePct>50?'var(--ft-acc)':'var(--ft-green)');
  const beSub2=_q('pr-be-sub');
  if(beSub2) beSub2.textContent=isFinite(be)?`${be} un./mês · ${Math.round(bePct)}% da produção`:'—';

  const bd=_q('pr-bd');
  if(bd) bd.innerHTML=[
    {l:'Preço de venda',v:_R(preco)},
    {l:'(-) Custo do produto',v:_R(custo)},
    {l:'(-) Custo fixo/unid.',v:cfu!==null?_R(cfu):'—'},
    {l:'(-) Comissão',v:_R(comisR)},{l:'(-) Impostos',v:_R(impR)},{l:'(-) Taxa de cartão',v:_R(cartR)},
    {l:'= Lucro real',v:_R(lucro),x:'prc-bd-total'+(lucro<0?' prc-bd-neg':'')},
  ].map(r=>`<div class="prc-bd-row ${r.x||''}"><span class="prc-bd-lbl">${r.l}</span><span class="prc-bd-val">${r.v}</span></div>`).join('');

  _show('prc-result-decomp');
}

function _calcMarkup() {
  const fat=_n('mk-fat'),cf=_n('mk-cf'),imp=_n('mk-imp'),marg=_n('mk-marg'),custo=_n('mk-custo');
  if(!custo) return;
  const cfPct=fat>0?(cf/fat)*100:0,usado=cfPct+imp+marg;
  const mk=usado<100?1/(1-usado/100):Infinity,pv=isFinite(mk)?custo*mk:Infinity;
  const mkP=custo>0&&isFinite(pv)?((pv-custo)/custo)*100:0;
  _set('mk-r-mk',isFinite(mk)?_N(mk)+'x':'∞');
  _set('mk-r-pv',isFinite(pv)?_R(pv):'∞');
  _set('mk-r-cfp',_P(cfPct));
  _set('mk-r-mkp',isFinite(mkP)?_P(mkP):'∞');
  const comp=_q('mk-r-comp');
  if(comp) comp.textContent=(100-usado)<0
    ?'⚠ Percentuais excedem 100%'
    :`Custo ${_P(100-usado)} · CF ${_P(cfPct)} · Imp. ${_P(imp)} · Margem ${_P(marg)}`;
  _gauge('mk-gauge',Math.min(100,Math.max(0,marg)),'var(--ft-green)');
  _show('prc-result-markup');
}

function _calcCmvDir() {
  const custo=_n('cmvd-custo'),preco=_n('cmvd-preco');
  if(!preco) return;
  const cmv=preco>0?(custo/preco)*100:0,marg=calcularMargem(preco,custo),lucro=calcLucro(preco,custo),mk=calcMarkupImplicito(preco,custo);
  _set('cmvd-r-pct',_P(cmv));_set('cmvd-r-marg',_P(marg));_set('cmvd-r-lucro',_R(lucro));_set('cmvd-r-mk',_P(mk));
  const gc=_q('cmvd-gauge');
  if(gc){gc.style.width=Math.min(100,cmv)+'%';gc.style.background=cmv<=35?'var(--ft-green)':cmv<=45?'var(--ft-acc)':'var(--ft-red)';}
  const lbl=_q('cmvd-gauge-lbl');
  if(lbl) lbl.textContent=cmv<=35?'✓ Excelente — abaixo de 35%':cmv<=40?'⚠ Aceitável — ideal < 40%':'✗ Alto — reveja custo ou preço';
  _show('prc-result-cmvd');
}

function _calcCmvRev() {
  const custo=_n('cmvr-custo'),meta=_n('cmvr-meta');
  if(!custo||!meta||meta>=100) return;
  const pv=custo/(meta/100),lucro=pv-custo,marg=100-meta;
  _set('cmvr-r-pv',_R(pv));_set('cmvr-r-marg',_P(marg));_set('cmvr-r-lucro',_R(lucro));
  const sub=_q('cmvr-r-pv-s');if(sub) sub.textContent=`para CMV de ${_P(meta)}`;
  _show('prc-result-cmvr');
}

function _calcMgLuc() {
  const custo=_n('mgl-custo'),preco=_n('mgl-preco');
  if(!preco) return;
  const marg=calcularMargem(preco,custo),lucro=calcLucro(preco,custo),cmv=preco>0?(custo/preco)*100:0,mk=calcMarkupImplicito(preco,custo);
  _set('mgl-r-marg',_P(marg));_cls('mgl-r-marg',marg>=30?'green':marg>=15?'amber':'red');
  _set('mgl-r-lucro',_R(lucro));_set('mgl-r-cmv',_P(cmv));_set('mgl-r-mk',_P(mk));
  const lbl=_q('mgl-gauge-lbl');
  if(lbl) lbl.textContent=marg>=30?'✓ Boa margem — acima de 30%':marg>=15?'⚠ Razoável — busque 30%+':'✗ Baixa — rever precificação';
  _gauge('mgl-gauge',marg,marg>=30?'var(--ft-green)':marg>=15?'var(--ft-acc)':'var(--ft-red)');
  _show('prc-result-mgl');
}

function _calcMgCusto() {
  const preco=_n('mgc-preco'),marg=_n('mgc-marg');
  if(!preco||marg>=100) return;
  const custoMax=preco*(1-marg/100),lucro=calcLucro(preco,custoMax);
  _set('mgc-r-custo',_R(custoMax));_set('mgc-r-lucro',_R(lucro));
  const nota=marg===0?' — ponto de equilíbrio':'';
  const lbl=_q('mgc-gauge-lbl');
  if(lbl) lbl.textContent=`Custo ${_P(100-marg)} · Lucro ${_P(marg)} do preço${nota}`;
  _gauge('mgc-gauge',marg,marg>0?'var(--ft-green)':'var(--ft-txt3)');
  _show('prc-result-mgc');
}

function _calcPct(m) {
  if(m==='calc'){
    const pct=_n('pc-pct'),tot=_n('pc-tot');
    if(!pct&&!tot) return;
    _set('pc-r-val',_R(tot*(pct/100)));
    const sub=_q('pc-r-val-s');if(sub) sub.textContent=`${_P(pct)} de ${_R(tot)}`;
    _show('prc-result-pc');
  } else if(m==='acr'){
    const base=_n('pa-base'),pct=_n('pa-pct');if(!base) return;
    const acr=base*(pct/100);
    _set('pa-r-final',_R(base+acr));_cls('pa-r-final','green');
    _set('pa-r-acr',_R(acr));_cls('pa-r-acr','amber');
    _show('prc-result-pa');
  } else if(m==='desc'){
    const base=_n('pd-base'),pct=_n('pd-pct');if(!base) return;
    const desc=base*(pct/100);
    _set('pd-r-final',_R(base-desc));_cls('pd-r-final','green');
    _set('pd-r-desc',_R(desc));_cls('pd-r-desc','red');
    _show('prc-result-pd');
  } else if(m==='rep'){
    const x=_n('pr-x'),y=_n('pr-y');if(!y) return;
    _set('pr-r-pct',_P((x/y)*100));
    const sub=_q('pr-r-pct-s');if(sub) sub.textContent=`de ${_R(y)}`;
    _show('prc-result-pr');
  }
}

// ─── Mapa de clear ────────────────────────────────────────────
const _CLEARS={
  decomp:    {ids:['d-fat','d-cf','d-qtd','d-comis','d-imp','d-cart','d-custo','d-preco'],res:'prc-result-decomp'},
  markup:    {ids:['mk-fat','mk-cf','mk-imp','mk-marg','mk-custo'],                       res:'prc-result-markup'},
  cmvdir:    {ids:['cmvd-custo','cmvd-preco'],                                            res:'prc-result-cmvd'},
  cmvrev:    {ids:['cmvr-custo','cmvr-meta'],                                             res:'prc-result-cmvr'},
  mgluc:     {ids:['mgl-custo','mgl-preco'],                                              res:'prc-result-mgl'},
  mgcusto:   {ids:['mgc-preco','mgc-marg'],                                               res:'prc-result-mgc'},
  'pct-calc':{ids:['pc-pct','pc-tot'],                                                    res:'prc-result-pc'},
  'pct-acr': {ids:['pa-base','pa-pct'],                                                   res:'prc-result-pa'},
  'pct-desc':{ids:['pd-base','pd-pct'],                                                   res:'prc-result-pd'},
  'pct-rep': {ids:['pr-x','pr-y'],                                                        res:'prc-result-pr'},
};

// ─── Ink bar animation ────────────────────────────────────────
function _moveInk(btn) {
  const ink=_q('prc-ink'),nav=btn.closest('.prc-subnav');
  if(!ink||!nav) return;
  const nr=nav.getBoundingClientRect(),br=btn.getBoundingClientRect();
  ink.style.width=br.width+'px';
  ink.style.left=(br.left-nr.left+nav.scrollLeft)+'px';
}

// ─── Event binding ────────────────────────────────────────────
function _bindEvents() {
  const root=_q('ft-sec-prec');if(!root) return;

  // Sub-nav
  root.querySelectorAll('.prc-tab').forEach(btn=>btn.addEventListener('click',()=>{
    root.querySelectorAll('.prc-tab').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');});
    root.querySelectorAll('.prc-pane').forEach(p=>p.classList.add('prc-hidden'));
    btn.classList.add('active');btn.setAttribute('aria-selected','true');
    _q('prc-pane-'+btn.dataset.prc)?.classList.remove('prc-hidden');
    _moveInk(btn);
  }));
  requestAnimationFrame(()=>{const a=root.querySelector('.prc-tab.active');if(a) _moveInk(a);});

  // Mode toggles
  const _sm=(a,i,s,h)=>{_q(a)?.classList.add('active');_q(i)?.classList.remove('active');_q(s)?.classList.remove('prc-hidden');_q(h)?.classList.add('prc-hidden');};
  _q('cmv-btn-dir')?.addEventListener('click',()=>_sm('cmv-btn-dir','cmv-btn-rev','cmv-pane-dir','cmv-pane-rev'));
  _q('cmv-btn-rev')?.addEventListener('click',()=>_sm('cmv-btn-rev','cmv-btn-dir','cmv-pane-rev','cmv-pane-dir'));
  _q('mg-btn-luc')?.addEventListener('click',()=>_sm('mg-btn-luc','mg-btn-custo','mg-pane-luc','mg-pane-custo'));
  _q('mg-btn-custo')?.addEventListener('click',()=>_sm('mg-btn-custo','mg-btn-luc','mg-pane-custo','mg-pane-luc'));

  // Pct type
  root.querySelectorAll('.prc-pct-btn').forEach(btn=>btn.addEventListener('click',()=>{
    ['calc','acr','desc','rep'].forEach(k=>{
      _q('pct-btn-'+k)?.classList.toggle('active',k===btn.dataset.pct);
      _q('pct-pane-'+k)?.classList.toggle('prc-hidden',k!==btn.dataset.pct);
    });
  }));

  // Calc buttons
  const map={
    'prc-btn-decomp':_calcDecomp,'prc-btn-markup':_calcMarkup,
    'prc-btn-cmvdir':_calcCmvDir,'prc-btn-cmvrev':_calcCmvRev,
    'prc-btn-mgluc':_calcMgLuc,'prc-btn-mgcusto':_calcMgCusto,
    'prc-btn-pct-calc':()=>_calcPct('calc'),'prc-btn-pct-acr':()=>_calcPct('acr'),
    'prc-btn-pct-desc':()=>_calcPct('desc'),'prc-btn-pct-rep':()=>_calcPct('rep'),
  };
  Object.entries(map).forEach(([id,fn])=>_q(id)?.addEventListener('click',fn));

  // Clear
  root.querySelectorAll('[data-prc-clear]').forEach(btn=>btn.addEventListener('click',()=>{
    const m=_CLEARS[btn.dataset.prcClear];if(!m) return;
    m.ids.forEach(id=>{const e=_q(id);if(e) e.value='';});
    _hide(m.res);
  }));

  // Enter → calc
  root.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.target.tagName!=='INPUT') return;
    e.target.closest('.prc-sec-body')?.querySelector('.prc-calc-btn')?.click();
  });
}

// ─── Exports ──────────────────────────────────────────────────
let _ok=false;
export function initPrecifica() {
  if(_ok) return; _ok=true;
  const sec=document.getElementById('ft-sec-prec');
  if(!sec) return;
  sec.innerHTML=_buildHTML();
  _bindEvents();
}
export function renderPrecifica() { initPrecifica(); }
