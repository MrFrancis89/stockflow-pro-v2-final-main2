## v10.0 — 18/03/2026 — Refatoração SaaS Premium

### Tarefa 1 — Centralização de Cálculo
- **`ft-calc.js` unificado**: adicionadas 4 funções canônicas obrigatórias:
  `calcularCustoIngredientes`, `calcularCustoTotal`, `calcularMargem`, `calcularPrecoSugerido`.
- API legada mantida como aliases para compatibilidade total com `ft-custos.js` e outros módulos.
- `ft-precifica.js` agora importa `calcularMargem`, `calcularPrecoSugerido`, `calcLucro` e
  `calcMarkupImplicito` de `ft-calc.js` — eliminando duplicação inline em `_calcDecomp`.
- Zero dependências de DOM em `ft-calc.js` — funções puras e testáveis.

### Tarefa 2 — Padronização de UI
- **`style.css`**: skeleton loading (`@keyframes skeleton-shimmer`, classes `.skeleton`,
  `.skeleton--text/title/btn/card/avatar`), animações de transição suaves, ripple effect,
  focus ring WCAG 2.1 AA, indicador offline, card lift hover, pull-to-refresh visual.
- **`ft-style.css`**: adicionados `section-enter`, `ft-skeleton-*`, `.ft-ripple`, hover lift
  em `.ft-list-item`, focus ring em `.ft-btn/.ft-input/.ft-list-item`.
- Patches CSS (`patch-v976/980/985.css`, `apple-overrides.css`, `massa-extra.css`) já eram
  stubs vazios desde v9.9.5 — confirmados e mantidos como stubs documentados.

### Tarefa 3 — Separação de Responsabilidades
- Confirmado: `ft-calc.js` é camada pura (zero DOM). `ft-ui.js` é camada de apresentação.
  `ft-storage.js`/`storage.js` são camada de dados. Divisão mantida intacta.
- `ft-app.js`: importa `initRipple` de `ft-ui.js` e o chama no bootstrap.

### Tarefa 4 — Firebase Profissional
- **`firebase.js`** (CDN — deploy estático/GitHub Pages): CRUD com `try/catch` em todos
  os métodos (`fbSave`, `fbLoad`, `fbDelete`, `fbWatch`), logs padronizados `[firebase] ✓/✗`.
- **`firebase.vite.js`** (build Vite): mesmo padrão de erro/log. `onFirebaseReady` com
  guard `typeof cb === 'function'`.

### Tarefa 5 — UX Premium
- **`toast.js` v10.0**: suporte a tipos `info/sucesso/erro/aviso` com ícones SVG inline,
  animação slide-up na entrada (`toast--in`) e fade na saída (`toast--out`). Retrocompatível.
- **`ft-ui.js`**: `initRipple()` — event delegation para ripple em todos os `.ft-btn`;
  `renderSkeleton(el, linhas)` — helper para loading states durante fetch.

### Tarefa 6 — Mobile iPhone
- Confirmado: `font-size: 16px` em todos os `.ft-input` (previne zoom automático Safari iOS).
  `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, `safe-area-inset`
  e `overscroll-behavior` já cobertos extensivamente em `style.css` e `ft-style.css`.

### Tarefa 7 — Limpeza
- Confirmado: zero `var` legados, zero `console.log`, zero `.innerText =` ativos.
- `ft-precifica.js`: duplicação de `calcMarkupImplicito` removida de `_calcDecomp`.

### Arquivos modificados
- `ft-calc.js` → v10.0 (API padrão + aliases legados)
- `ft-precifica.js` → v10.0 (removida duplicação inline)
- `firebase.js` → v10.0 (try/catch CRUD + logs)
- `firebase.vite.js` → v10.0 (try/catch + guard onFirebaseReady)
- `toast.js` → v10.0 (tipos + ícones + animações)
- `ft-ui.js` → v10.0 (initRipple + renderSkeleton)
- `ft-app.js` → v10.0 (initRipple no bootstrap)
- `style.css` → v10.0 (skeleton + transições + ripple + focus + offline)
- `ft-style.css` → v10.0 (section-enter + ft-skeleton + ripple + hover lift)

## v9.9.47 — 18/03/2026 — Sidebar acessível na Ficha Técnica

### Funcionalidade
- **Sidebar disponível dentro da Ficha Técnica**: o botão hambúrguer (☰) e o
  painel lateral agora funcionam corretamente quando o overlay da FT está ativo.
- **Botão hambúrguer flutuante**: ao entrar na FT, o botão assume `position:fixed`
  com `z-index: 1230` no canto superior esquerdo (respeitando `safe-area-inset`),
  permanecendo visível e tocável sobre o iframe.
- **Z-index stack correto sobre a FT**:
  - `.sidebar-overlay` elevado para `1240` (acima do overlay FT `1200`)
  - `.sidebar-panel` elevado para `1250`
  - Hambúrguer fixed: `1230`
- **Sem conflito com swipe-back da FT**: `#sidebar-swipe-edge` perde
  `pointer-events` enquanto `body.ft-overlay-active` estiver ativo e a sidebar
  estiver fechada, preservando o gesto de swipe-right para voltar da FT.

### Implementação
- `navegacao.js`: `body.classList.add/remove('ft-overlay-active')` nos 3 pontos
  de ativação/desativação da FT (click handler, `_voltarDeFT`, `_ativarSubtab`).
- `style.css`: regras condicionadas a `body.ft-overlay-active` para flutuar o
  hambúrguer, elevar overlay e painel, e desativar edge zone da sidebar.

### Arquivos modificados
- `navegacao.js` v9.9.40 → v9.9.47
- `style.css` — sidebar section bump
- `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html`,
  `sidebar.js`, `ft-app.js` → v9.9.47

## v9.9.46 — 18/03/2026 — Ficha Técnica no Sidebar + Auditoria Completa

### Funcionalidade — Ficha Técnica movida para o sidebar
- **Aba "Ficha Técnica" removida do grid de navegação principal** (`#nav-tabs-panel`).
  O botão permanece no DOM com `display:none` para que `navegacao.js` continue
  gerenciando o overlay, lazy-load do iframe e swipe-back sem alterações.
- **Menu em cascata (accordion) adicionado ao sidebar**: entrada "Ficha Técnica" com
  chevron animado e 7 sub-itens diretos — Ingredientes, Receitas, Simulador, Preparo,
  Dashboard, Custos e Exportar.
- Clique em sub-item ativa o overlay da FT via nav-tab oculto e envia
  `postMessage({ type: 'SF_FT_NAV', tab })` ao iframe para navegar diretamente
  à aba correta sem passar pela tela de Ingredientes.

### Correções de auditoria (5 bugs)
- **[CRÍTICO] `ft-app.js` — `_pendingTab` ausente nos paths offline**: os caminhos
  de init offline e `ft:forceOffline` ignoravam tab pendente. Corrigido nos 3 paths.
- **[MÉDIO] `style.css` — linha de indentação visível quando accordion fechado**:
  `::before position:absolute` escapava do `overflow:hidden`. Corrigido com
  `position:relative` no container filho e `left` ajustado de 22px → 10px.
- **[MÉDIO] `postMessage` com `origin:'*'`**: envio corrigido para
  `window.location.origin`; receptor em `ft-app.js` valida `e.origin` além de
  `e.source`.
- **[BAIXO] `LS_KEY` não persistia ao clicar sub-item**: adicionado
  `localStorage.setItem(LS_KEY, subId)` no handler de sub-itens.
- **[BAIXO] Restauração de estado incompleta para sub-itens**: bloco de restauração
  reescrito para limpar `.sidebar-subitem`, marcar header do accordion e expandir
  o accordion pai sem animação via `requestAnimationFrame`.

### Arquivos modificados
- `sidebar.js` v9.9.44 → v9.9.46
- `ft-app.js` v9.9.45 → v9.9.46
- `style.css` — accordion CSS adicionado; sidebar section bump
- `index.html` — aba FT oculta; título e logo-ver-text atualizados
- `main.js` → v9.9.46
- `sw.js` → v9.9.46 / cache `stockflow-v9-9-46`
- `manifest.json` → v9.9.46
- `package.json` → v9.9.46

## v9.9.45 — 18/03/2026 — Auditoria de Segurança e Qualidade (Fase 3 — conclusão)

### Performance — Memory leaks
- **[ALTO] massa.js — overlayHandler acumulado no modal**: `overlayHandler` era adicionado
  via `modal.addEventListener('click', ...)` a cada abertura do modal, e removido apenas
  quando o usuário clicava no overlay. Ao fechar via OK, Cancelar ou ✕, o listener nunca
  era removido — acumulando uma cópia por uso. Corrigido: `overlayHandler` declarado como
  variável antes de `fechar()`, que agora sempre chama
  `modal.removeEventListener('click', overlayHandler)` independentemente do caminho de fechamento.

### Robustez
- **[ALTO] auth.js — timeout Firebase**: `Promise.race` em `initAuth()` com timeout de
  3 000 ms aumentado para 6 000 ms, alinhando com o fix aplicado em `ft-app.js` na Fase 1.
  O `auth.js` é o ponto de entrada do app principal (`main.js`), e o timeout diferente
  causaria fallback para modo offline mais cedo que o necessário em conexões lentas.

### Cobertura da auditoria
Todos os 18 achados válidos do Relatório de Auditoria v9.9.44 (Manus AI) estão corrigidos.
Os 2 falsos positivos identificados (`_trendBadge` em ft-ingredientes.js e linhas 89/114 de
massa.js) foram documentados e não requereram alteração.

### Arquivos modificados
- `auth.js` (timeout Firebase)
- `massa.js` (overlayHandler memory leak)
- `CHANGELOG.md`

---



### Segurança — Credenciais Firebase
- **[CRÍTICO] firebase.vite.js**: credenciais hardcoded substituídas por `import.meta.env.VITE_FIREBASE_*`.
  Aviso de console adicionado caso as variáveis não estejam definidas.
- **[CRÍTICO] firebase.js** (versão CDN): comentário de segurança reescrito com instruções claras de
  que as credenciais devem ser removidas antes de publicar no Git.
- **Novos arquivos**: `.env.example` com todas as variáveis documentadas; `.gitignore` com `.env`,
  `node_modules/`, `dist/` e artefatos de IDE.

### Bugs — Race condition
- **[CRÍTICO] estoques.js**: leitura de `appStore.get('estoqueAtivoId')` imediatamente após
  `excluirEstoque()` substituída por `carregarEstoqueAtivoId()` — fonte de verdade no localStorage,
  imune a atualizações assíncronas do store. Elimina inconsistência de UI ao excluir o estoque ativo.

### Performance
- **[ALTO] swipe.js**: `document.activeElement.blur()` movido de dentro do `touchmove` (disparado
  a cada frame do gesto) para o momento exato em que o swipe é confirmado pela primeira vez.
  Elimina recálculo de layout por frame, restaurando fluidez de animação em dispositivos lentos.

### Arquitetura — Módulo de sanitização centralizado
- **Novo arquivo `security.js`**: módulo de sanitização DOM com API completa:
  - `esc(s)` — escaping HTML (re-exporta e unifica com ft-format.js)
  - `escUrl(url)` — escaping de URLs com bloqueio de `javascript:`, `data:`, `vbscript:`
  - `el(tag, opts)` — criação de elementos sem innerHTML
  - `setText(el, text)` — setTextContent seguro
  - `setTrustedHTML(el, html)` — innerHTML explicitamente marcado como seguro
  - `safeHTML\`...\`` — tagged template literal com escape automático de interpolações
  - `trusted(html)` — marca HTML interno (ícones, formatadores) como confiável em safeHTML
  - `parseInputBR(raw)` — parsing BR centralizado (1.500,75 → 1500.75)
  - `isSafeUrl(url)` — validação de URLs

### Testes automatizados
- **`tests/parsing.test.js`** (28 casos): cobre `parseNum`, `parseInputBR`, e regressão explícita
  do bug de separador de milhar em `alerta.js`. Inclui cenário exato onde `1.500` era lido como `1,5`.
- **`tests/store.test.js`** (18 casos): cobre `get/set`, `snapshot()`, eventos `change` e
  `change:chave`, `on()` com unsubscribe, e regressão de race condition em estoques (contrato
  de imutabilidade do Map).
- **`tests/security.test.js`** (38 casos): cobre todas as funções de `security.js` incluindo
  proteção XSS em `el()`, bloqueio de `javascript:` em `escUrl()`, e `safeHTML` com `trusted()`.

### Arquivos novos
- `security.js`, `.env.example`, `.gitignore`
- `tests/parsing.test.js`, `tests/store.test.js`, `tests/security.test.js`

### Arquivos modificados
- `firebase.js`, `firebase.vite.js` (credenciais / env vars)
- `estoques.js` (race condition)
- `swipe.js` (DOM thrashing)
- `main.js` (handler global de erros)
- `CHANGELOG.md`

---



### Segurança — XSS
- **[CRÍTICO] ft-app.js**: `displayName` e `photoURL` do Firebase agora passam por `esc()` antes de
  serem injetados via `innerHTML` — tanto no avatar do header quanto no modal de confirmação de logout.
  Import de `esc` adicionado de `ft-format.js`.
- **[CRÍTICO] ft-exportacao.js**: nomes de receita, tamanho, ingredientes e valores formatados
  agora escapados com `esc()` no `document.write` do `_expPDF`. Import de `esc` adicionado.

### Bugs — Parsing numérico
- **[CRÍTICO] alerta.js — separador de milhar**: `parseFloat` aplicava apenas `.replace(',', '.')`
  — quantidade `1.500` (padrão BR) era lida como `1,5` em vez de `1500`, quebrando todos os alertas
  de estoque mínimo/máximo para itens com quantidade ≥ 1.000. Corrigido para
  `.replace(/\./g, '').replace(',', '.')`.
- **[MÉDIO] alerta.js — min/max em verificarAlertas**: `parseFloat(item.min/max)` substituído por
  `Number()` — valores já chegam normalizados de `salvarAlerta`, eliminando segunda conversão.
- **[MÉDIO] massa.js**: `parseFloat(...replace(',', '.'))` nas entradas de valor e quantidade de
  ingrediente corrigido para normalizar separador de milhar antes de parsear.

### Bugs — Boas práticas
- **[CRÍTICO] massa.js**: `parseInt(dataset.*)` sem radix em 3 pontos — adicionado radix `10`
  explícito em todas as ocorrências.

### Robustez
- **[ALTO] ft-storage.js — salvarConfig**: `catch {}` completamente vazio substituído por
  `console.warn()` com contexto — falhas de gravação de configuração (markup, margem, overhead)
  agora são rastreáveis.
- **[ALTO] ft-storage.js — carregarConfig**: `catch {}` vazio na leitura do Firebase e do
  localStorage substituídos por `console.warn()`.
- **[ALTO] ft-app.js — timeout Firebase**: aumentado de `3000ms` para `6000ms` — reduz falsos
  fallbacks para modo offline em conexões 3G ou instáveis.

### Performance — Memory leaks
- **[ALTO] ft-receitas.js**: listeners `.ft-rec-main` e `.ft-fav-btn` adicionados a cada item
  individualmente a cada `renderReceitas()` — substituídos por delegação de eventos em um único
  listener no `listDiv`. Filtro de tamanho (`.ft-size-chip`) também delegado com flag
  `data-sizeListenerAttached` para evitar acúmulo em re-renders.

### Acessibilidade (WCAG)
- **[ALTO] index.html**: removidos `maximum-scale=1.0` e `user-scalable=no` do meta viewport —
  violação WCAG 1.4.4 (Redimensionamento de Texto, nível AA). Usuários com baixa visão podem
  agora ampliar a página normalmente em iOS Safari.
- **[ALTO] ai-style.css**: `outline: none` em `.ai-key-input`, `.ai-acao-btn:focus-visible` e
  `.ai-user-input` sem alternativa visual para teclado. Adicionado `outline: 2px solid var(--ai-amber)`
  em `:focus-visible` nos três elementos — mantém box-shadow âmbar para mouse/touch, adiciona
  outline visível para navegação por teclado.

### Sincronização de versão
- `VERSAO_ATUAL` em `main.js`: `9.9.44` → `9.9.45`
- `VERSION` e cache key em `sw.js`: `stockflow-v9-9-44` → `stockflow-v9-9-45`
- `manifest.json` — campos `version` e `description`: `9.9.44` → `9.9.45`
- `package.json` — campo `version`: `9.9.44` → `9.9.45`
- Cabeçalhos de `ft-app.js`, `alerta.js`, `ft-storage.js` atualizados

### Arquivos modificados
- `ft-app.js`, `ft-exportacao.js` (XSS fixes + esc import)
- `alerta.js` (parsing numérico + validação)
- `massa.js` (parseInt radix + parseFloat milhar)
- `ft-storage.js` (catch blocos + timeout)
- `ft-receitas.js` (delegação de eventos)
- `ai-style.css` (acessibilidade focus-visible)
- `index.html` (viewport meta)
- `main.js`, `sw.js`, `manifest.json`, `package.json` (bump de versão)

---



### FEATURE: Sidebar lateral deslizante (sidebar.js)
- **Novo arquivo `sidebar.js`**: drawer lateral estilo GitHub Mobile, 100% compatível
  com todos os temas do projeto (Dark Premium, Midnight, Arctic, Forest).
- **Botão hambúrguer** no canto esquerdo do `.header-container` com animação de
  três barras → X ao abrir, usando CSS transitions do sistema de design existente.
- **Overlay** com `backdrop-filter: blur` fecha ao tocar fora do painel — idêntico
  ao padrão dos outros overlays do projeto (receitas-sheet, modal, alerta-sheet).
- **Swipe-right** na borda esquerda da tela abre a sidebar; **swipe-left** dentro
  do painel fecha — implementado com Edge Capture Zone (mesmo mecanismo da FT).
- **Estrutura extensível declarativa**: novos itens/seções são adicionados apenas
  em `SIDEBAR_SECTIONS[]` sem alterar nenhum outro arquivo.
- **Indicador de item ativo** com barra vertical azul (idêntico ao GitHub).
- **Chip "Em breve"** para funcionalidades futuras (NF-e, Fornecedores, Multi-usuário).
- **Estado persistido** em `localStorage('sidebarLastSection')`.
- **Evento `sidebarAction`** no `document` para integração modular futura.
- **CSS adicionado ao `style.css`**: usa exclusivamente CSS custom properties
  (`--surface`, `--accent-primary`, `--glass-bg`, etc.) — zero hardcoded colors.
- **API pública**: `iniciarSidebar()`, `sidebarSetVersion(v)`, `abrirSidebar()`, `fecharSidebar()`.

### Sincronização de versão
- `VERSAO_ATUAL` em `main.js`: `9.9.43` → `9.9.44`
- `VERSION` e cache key em `sw.js`: `stockflow-v9-9-43` → `stockflow-v9-9-44`
- `manifest.json` — campos `version` e `description`: `9.9.43` → `9.9.44`
- `package.json` — campo `version`: `9.9.43` → `9.9.44`
- Cabeçalhos de `pwa-install.js` e `pwa-install.css` atualizados

### Arquivos modificados
- `main.js` (import + chamada `iniciarSidebar` + `sidebarSetVersion`)
- `style.css` (seção `§ SIDEBAR LATERAL` adicionada ao final)
- `sw.js`, `manifest.json`, `package.json`, `pwa-install.js`, `pwa-install.css`

### Arquivos novos
- `sidebar.js`

---



### Sincronização de versão
- `VERSAO_ATUAL` em `main.js`: `9.9.43` → `9.9.44`
- `VERSION` e cache key em `sw.js`: `stockflow-v9-9-43` → `stockflow-v9-9-44`
- `manifest.json` — campos `version` e `description`: `9.9.43` → `9.9.44`
- `package.json` — campo `version`: `9.9.43` → `9.9.44`
- Cabeçalhos de `pwa-install.js` e `pwa-install.css` atualizados

### Arquivos modificados
- `main.js`, `sw.js`, `manifest.json`, `package.json`, `pwa-install.js`, `pwa-install.css`

---

## v9.9.43 — 17/03/2026 — PWA Install: boot imediato + compatibilidade total iOS

### Mudanças
- **Modal de instalação exibido ao abrir o app**: `tentarExibirModalInstalacao()` não
  depende mais de login. O parâmetro `logado` foi removido — o modal aparece para
  qualquer visitante que ainda não instalou o atalho, independente de autenticação.
- **Detecção aprimorada de browsers**:
  - iOS Safari → passos manuais com ícone do botão Compartilhar embutido no texto
  - Chrome no iOS (CriOS) → variante "Abra no Safari para instalar"
  - Firefox no iOS (FxiOS) → idem
  - Android Chrome, Edge, Firefox, Samsung Internet → prompt nativo `beforeinstallprompt`
- **Ícone Compartilhar no passo 1 (Safari iOS)**: SVG inline do botão ⬆ do Safari
  embutido diretamente no texto da instrução, tornando o passo inequívoco.
- **main.js**: chamada atualizada de `tentarExibirModalInstalacao(logado)` →
  `tentarExibirModalInstalacao()`.
- **pwa-install.css**: estilos adicionados para `.pwa-share-ico-wrap`, `.pwa-aviso-outros`,
  `.pwa-aviso-ico`, `.pwa-aviso-txt`, `.pwa-aviso-dica` + overrides light mode.

### Bugs corrigidos (auditoria pós-entrega)
- **[CRÍTICO]** Modal PWA não aparecia após fechar o modal de novidades: `mostrarNovidades()`
  era `async function` e resolvia o `await` imediatamente ao **abrir** o modal, não ao fechá-lo.
  O `pwa-install.js` dependia de `setInterval` (500ms × 30 tentativas = 15s) para detectar
  o fechamento. Se o usuário demorava mais de 15s lendo as novidades, o modal PWA nunca aparecia.
  **Correção:** `mostrarNovidades()` agora retorna uma `Promise` que só resolve quando o usuário
  fecha o modal (`.fechar-whatsnew` click ou Escape). O `await` no boot bloqueia corretamente.
  O `setInterval` em `pwa-install.js` foi mantido apenas como guard de segurança para outros
  modais (confirm, alerta), reduzido de 30 para 20 tentativas (10s).

### Bugs corrigidos (auditoria técnica)
- **[REGRESSÃO]** `navigator.platform` deprecated reintroduzido — o fix #7 do v9.9.42
  havia substituído por `matchMedia('(hover: none) and (pointer: coarse)')`. A v9.9.43
  regrediu para `navigator.platform === 'MacIntel'`. Corrigido novamente com matchMedia.
- **[CRÍTICO]** `isIOSNaoSafari = isIOS && (isChromeIOS || isFirefoxIOS)` não cobria
  Edge iOS (EdgA), Opera iOS (OPiOS), Brave, DuckDuckGo e outros. Esses browsers caíam
  no path de `beforeinstallprompt` que nunca chega no iOS → timeout silencioso de 30s
  sem exibir nenhum modal. Corrigido: `isIOSNaoSafari = isIOS && !isSafariIOS`.
- **[BAIXO]** Variável `logado` declarada mas nunca usada após o refactor.
  Substituída por `await initAuth()` sem atribuição.
- **[BAIXO]** Classe `.pwa-passo-txt` usada no JS mas sem regra CSS explícita.
  `.light-mode .pwa-passo { color: #333 }` selecionava o `<li>`, não o `<span>` filho
  com ícone inline — cor podia ficar incorreta no tema claro. Adicionada regra
  `.pwa-passo-txt { color: inherit }` + `.light-mode .pwa-passo-txt { color: #333 }`.

### Arquivos modificados
- `pwa-install.js` v9.9.42 → v9.9.43
- `pwa-install.css` v9.9.41 → v9.9.43
- `main.js` → v9.9.43
- `sw.js` → v9.9.43 / cache `stockflow-v9-9-43`
- `manifest.json`, `package.json` → v9.9.43

---

## v9.9.42 — 17/03/2026 — Modal PWA + "O que há de novo"

### Bugs corrigidos
- **Modal "O que há de novo" não abria**: `VERSAO_ATUAL` havia sido bumped para `9.9.41` durante uma sessão interna antes de o arquivo chegar ao usuário. O `localStorage` já registrava `9.9.41` como visto, então `mostrarNovidades()` retornava cedo. Corrigido com bump para `9.9.42`.
- **Modal de instalação PWA não disparava**: `manifest.json` declarava `icone.png` (512 px) para o tamanho `192x192`, fazendo o Chrome rejeitar os critérios de instalabilidade. Corrigido usando `icone-192.png` e `icone-512.png` nos respectivos tamanhos, e separando `purpose: "any"` de `purpose: "maskable"` em entradas distintas conforme a especificação W3C.

---

## v9.9.41 — 17/03/2026 — Correções de segurança e PWA

### Segurança
- **[CRÍTICO]** XSS em `ft-ui.js`: `toast()`, `confirmar()`, `renderEmpty()` e `renderTutorial()` usavam `innerHTML` com dados externos. Corrigido com `textContent` e slots vazios.
- **[CRÍTICO]** XSS em `main.js`: `mostrarNovidades()` carregava `marked@11` via `esm.sh` (origem externa). Substituído pelo parser interno `_renderMarkdown` que escapa com `esc()`.
- XSS em `ft-ingredientes.js`: `i.unidade` e `ft-receitas.js`: `r.tamanho` sem `esc()`.

### Bugs corrigidos
- **Lista zerada ao trocar estoque**: `salvarDados()` usava `appStore` como fonte do ID ativo em vez do `localStorage`, causando gravação na chave errada após `fbPullPrincipal`. Corrigido em `storage.js`, `estoques.js` e `reload.js`.
- `criarEstoque()` retornava `nome` sem `trim()` — espaços podiam aparecer no seletor.
- `_atualizarStoreEstoques()` não atualizava `estoqueItens` — alertas e compras liam dados stale.
- `_acao_criar()` não persistia o estoque atual antes de criar o novo — dados podiam ser perdidos.
- `listafacil.js`: listener `sf:dados-recarregados` acumulava handlers em chamadas repetidas.
- `listafacil.js`: ID de novo item com `Date.now()` podia colidir — trocado por offset aleatório.

### Novo recurso
- **Modal de instalação PWA**: aparece após o login se o app ainda não foi instalado na tela inicial. Suporta Android Chrome (prompt nativo) e iOS Safari (instruções manuais). Módulos: `pwa-install.js`, `pwa-install.css`.
- **Registro do Service Worker**: `sw.js` agora é registrado automaticamente com guard de `readyState`.

---

## v9.9.40 — 16/03/2026 — Correção Pull-to-refresh

### Bugs corrigidos em `pullrefresh.js`

**[BUG] Refresh disparava ao arrastar em qualquer direção**

O cálculo de `deltaX` usava `clientX - clientX` (subtraindo o valor de si
mesmo), resultando sempre em `0`. Com isso, a verificação `|deltaX| > |deltaY|`
nunca era verdadeira e o arrasto horizontal nunca era cancelado — qualquer swipe
(inclusive lateral) acionava o indicador e o refresh.

Fix: adicionada a variável `_startX` salva no `touchstart`; `deltaX` calculado
corretamente como `touches[0].clientX - _startX`. Arrastos onde
`Math.abs(deltaX) > Math.abs(deltaY)` agora são ignorados.

**[BUG] Arrastar a lupa ou o botão Groq IA disparava o refresh**

O `touchmove` não verificava se o toque havia começado dentro do
`.table-wrapper`. Com `_startY` retendo o valor do último toque válido,
arrastar qualquer elemento fora do wrapper (lupa, botão IA, header) calculava
um `deltaY` falso e acionava o refresh.

Fix: adicionada a flag `_validStart` — definida como `true` somente quando o
`touchstart` ocorre dentro do `.table-wrapper`. O `touchmove` e o `touchend`
abortam imediatamente se `_validStart` for `false`. A flag é resetada no
início de cada `touchstart` e ao final de cada `touchend`.

### Arquivos modificados
- `pullrefresh.js` v9.9.20 → v9.9.40
- `main.js` → v9.9.40
- `sw.js` → v9.9.40 / cache `stockflow-v9-9-40`
- `manifest.json` → v9.9.40
- `package.json` → v9.9.40

---

## v9.9.4 — 14/03/2026 — Auditoria de Alertas: Causa Raiz Corrigida

### Bugs corrigidos em `alerta.js`

**[CRÍTICO] Itens abaixo do mínimo não eram adicionados à lista de compras e bolinha não aparecia — causa raiz**

A função `verificarAlertas()` constrói internamente um `Map` indexando cada
`<tr>` pelo nome do produto (`trPorNome`). O lookup era feito com
`nomEl.textContent.trim()`, mas `coletarDadosDaTabela()` — que gera o `item.n`
usado como chave de busca — usa `.textContent.replace(/\r\n|\n|\r/g,' ').trim()`.
Qualquer nome com quebra de linha interna (possível em `contenteditable` no iOS
ao colar texto) gerava uma chave diferente no mapa, fazendo
`trPorNome.get(item.n)` retornar `undefined`.

Com `tr === undefined` todo o bloco condicional era silenciosamente ignorado:
checkbox não marcado → item não ia para a lista de compras; `_marcarLinhaAlerta`
não executada → bolinha não inserida.

Fix: chave do mapa normalizada com o mesmo `.replace()` de `coletarDadosDaTabela`.

**[CRÍTICO] `alternarCheck()` chamado dentro do loop de verificação — efeitos colaterais indesejados**

Para cada item abaixo do mínimo, o código chamava `alternarCheck(chk)`, que
internamente chama `darFeedback()` (vibração + tom sonoro), `salvarDados()` e
`atualizarPainelCompras()` — uma vez por item em alerta, a cada execução de
`verificarAlertas()` (boot + a cada input de quantidade + troca de unidade).

Fix: substituído por marcação direta no DOM (`chk.checked = true` +
`tr.classList.add('linha-marcada')`) dentro do loop, com um único
`salvarDados(coletarDadosDaTabela())` + `atualizarPainelCompras()` chamados
uma única vez ao final, somente se ao menos um item foi realmente alterado.
`alternarCheck` removido dos imports de `alerta.js`; `atualizarPainelCompras`
importado de `compras.js`.

### Arquivos modificados
- `alerta.js` v9.9.2 → v9.9.4
- `main.js` → v9.9.4
- `sw.js` → v9.9.4 / cache `stockflow-v9-9-4`
- `manifest.json` → v9.9.4

---

## v9.9.3 — 14/03/2026 — Auditoria: Consistência dos Alertas de Estoque

### Bugs corrigidos

**[CRÍTICO] Troca de unidade não atualizava badge nem indicadores visuais**
- `change` no `<select>` de unidade salvava os dados e atualizava o status,
  mas nunca chamava `verificarAlertasDebounced()`.
- Com a unidade errada no DOM, `_familia()` comparava famílias incompatíveis
  e silenciava alertas válidos (ex.: item em `kg` com limite em `g`).
- Fix: `verificarAlertasDebounced()` adicionado ao handler `change` do container,
  lado a lado com `salvarDados` e `atualizarStatusSave`.

**[CRÍTICO] Renomear item destruía todos os indicadores visuais de alerta**
- Ao editar o nome de um produto (`.nome-prod` perde foco), `salvarEAtualizar()`
  reconstruía todo o DOM da tabela — apagando as classes `tr-alerta-min/max`
  e as bolinhas `.alerta-row-icon` de todos os itens.
- `verificarAlertas()` nunca era chamado após a reconstrução, deixando a tabela
  sem nenhum indicador visual até o próximo input de quantidade.
- Fix: `verificarAlertas()` chamado imediatamente após `salvarEAtualizar()`
  no handler `blur` de `.nome-prod`.

**[MODERADO] novoDia() não disparava alertas após zerar quantidades**
- Ao zerar todas as quantidades, a tabela era re-renderizada corretamente,
  mas `verificarAlertas()` não era invocado. Todos os itens com mínimo
  configurado deveriam acender alerta imediatamente — o badge ficava em 0.
- Fix: `verificarAlertas()` adicionado ao callback de `novoDia()` após
  `renderizarListaCompleta` e `atualizarPainelCompras`.

**[MINOR] adicionarItem() omitia minUnit/maxUnit na chamada inserirLinhaNoDOM**
- `inserirLinhaNoDOM` recebe 8 parâmetros `(n, q, u, chk, min, max, minUnit, maxUnit)`,
  mas `adicionarItem()` passava apenas 6, omitindo os dois últimos.
- Funcionava acidentalmente porque `undefined` e `null` são tratados igual no
  guard `!= null`, mas era implícito e mascarava erros futuros.
- Fix: chamada explicitada com `null, null` nos dois argumentos finais.

### Arquivos modificados
- `main.js` v9.9.2 → v9.9.3
- `sw.js` → v9.9.3 / cache `stockflow-v9-9-3`
- `manifest.json` → v9.9.3

---

## v9.9.0 — 13/03/2026 — Badge de Alertas de Estoque

### Feature: Badge no botao Estoque (sem popups que cobrem a tela)
- **Problema resolvido**: `verificarAlertas()` disparava toasts individuais que
  empilhavam e cobriam a tela inteira ao carregar o app.
- **Solucao**: badge iOS-style no canto superior direito do icone da aba Estoque.
  Vermelho (#FF3B30), animacao spring de entrada, borda de separacao adaptada
  a todos os 4 temas. Exibe numero de itens fora dos limites (max 99+).
- `atualizarBadgeAlertas(n)` — nova funcao exportada por alerta.js.
  `verificarAlertas()` agora retorna `{ alertas, count }` e NAO dispara toasts.
- Wrapper `.nav-tab-icon-wrap` adicionado ao botao Estoque para ancorar o badge
  com `position:absolute` sem afetar o layout da tab bar.
- Bloco §8 adicionado ao `patch-v985.css` (739 linhas).

### Arquivos modificados
- `alerta.js` v9.8.4 -> v9.9.0
- `index.html` — badge no botao Estoque
- `main.js` — import atualizarBadgeAlertas; versao 9.8.9 -> 9.9.0
- `patch-v985.css` — bloco §8 badge CSS
- `sw.js`, `manifest.json` — bump versao

---

## v9.8.9 — 13/03/2026 — Pedido de Compra via WhatsApp (Lista Fácil)

### Feature: Enviar Pedido de Compra
- **Botão "Enviar Pedido"** (verde WhatsApp) ao lado de "Compartilhar" na Lista Fácil.
- **Modal de Pedido**: campo de nome da pizzaria (persistido em `sf_lf_config_v1`) + preview do texto do pedido em tempo real + botões de envio por fornecedor.
- **Formatação do pedido**: `📦 Pedido de Compra / 🏪 [Nome] / 📅 [Data] / itens / Total`.
- **Telefone do Fornecedor**: campo `fone` adicionado ao modelo de cada item (opcional). Ícone de telefone ☎️ em cada linha da tabela — verde quando preenchido, muted quando vazio.
- **Modal de edição de telefone**: toque no ícone abre modal com campo `tel` para salvar/editar o número.
- **Agrupamento por fornecedor**: itens com o mesmo `fone` são agrupados e geram um botão de envio dedicado ao fornecedor. Itens sem número geram botão "Enviar (sem número)".
- **URL WhatsApp**: usa `https://wa.me/[fone]?text=[encoded]` (com número) ou `https://wa.me/?text=[encoded]` (sem número). Caracteres especiais e quebras de linha corretamente codificados via `encodeURIComponent`.
- **Botão "Copiar texto"**: alternativa para usuários que preferem colar manualmente.
- **Toast de confirmação**: "📦 Pedido gerado! Abrindo WhatsApp…" após envio.
- **Persistência**: campo `fone` serializado junto com os demais campos do item em `salvarItensLF()`. Migração transparente: itens antigos sem `fone` recebem `''` no carregamento.

### Arquivos modificados
- `listafacil.js` v9.7.5 → v9.8.9 (817 linhas)
- `index.html` — 2 novos modais + botão Enviar Pedido
- `patch-v985.css` — bloco §6: estilos WhatsApp (592 linhas)
- Bump global: `main.js`, `sw.js`, `manifest.json`

---

## v9.8.9 — 13/03/2026 — Pedido de Compra via WhatsApp (Lista Fácil)

### Feature: "Enviar Pedido de Compra" na Lista Fácil
- Botão "Enviar Pedido" (verde WhatsApp) na barra de acoes globais da Lista Facil.
- Modal de configuracao: nome da pizzaria (persistido) + telefone do fornecedor por item.
- Campo 'f' adicionado ao modelo de item — retrocompativel com dados existentes.
- Formatacao formal do pedido com cabecalho (nome + data/hora), itens e rodape.
- encodeURIComponent() para escapar caracteres especiais e quebras de linha.
- Com telefone: abre wa.me/NUMERO?text=... (chat direto). Sem telefone: whatsapp://send?text=...
- _sanitizarFone(): remove nao-digitos, prefixa 55 (Brasil), rejeita < 8 digitos.
- Toast de confirmacao apos abertura do WhatsApp.
- storage.js: nova chave listaFacil_config_v1 + carregarConfigLF/salvarConfigLF.
- style.css: estilos do botao WA e modal (todos os 4 temas, +130 linhas).

### Arquivos modificados
- listafacil.js v9.7.5 -> v9.8.9
- storage.js - nova chave + funcoes
- index.html - botao + modal lf-pedidoModal
- style.css - +130 linhas (bloco Pedido WA)
- main.js, sw.js, manifest.json, patch-v985.css - bump versao global

---

## v9.8.8 — 13/03/2026 — Sincronização de Temas em Tempo Real

### Feature: Cross-Document Messaging — Temas sincronizados entre app e Ficha Técnica
- **main.js** — `_sincronizarTemaFT(tema)`: envia `postMessage({ type:'SF_TEMA', tema })` ao iframe após cada troca de tema. Chamada ao fim de `aplicarTema()`, garantindo que localStorage e iframe recebam o mesmo valor atomicamente.
- **ft-app.js** — `_initTema()` reescrita com 4 camadas independentes:
  1. Leitura imediata do `localStorage` (anti-FOUC local, síncrono)
  2. `window.addEventListener('message')` com validação `e.source === window.parent` e `e.data.type === 'SF_TEMA'` (canal primário, entrega no mesmo frame)
  3. `storage` event (fallback multi-janela/aba)
  4. CustomEvent `ft-tema` (compatibilidade retroativa)
- **ficha-tecnica.html** — script inline síncrono anti-FOUC no `<head>` (antes do primeiro `<link>` CSS): aplica a classe de tema em `<html>` antes do primeiro paint, eliminando o flash de cor errada ao abrir a FT.
- **Resultado**: troca de tema no Estoque reflete instantaneamente na Ficha Técnica no mesmo frame de animação; abertura da FT nunca exibe o tema errado, mesmo por um frame.

### Arquivos modificados
- `main.js` v9.8.7 → v9.8.8
- `ft-app.js` v3.1 → v9.8.8
- `ficha-tecnica.html` — anti-FOUC inline

---

## v9.8.7 — 13/03/2026 — Bump de Versão Global

### Sincronização de versão
- `VERSAO_ATUAL` em `main.js` atualizada: `9.8.6` → `9.8.7`
- `<title>` do `index.html`: `v9.8.5` → `v9.8.7`
- Popover de versão (`#logo-ver-text`) sincronizado: `v9.8.5` → `v9.8.7`
- `VERSION` do Service Worker (`sw.js`): `9.8.5` → `9.8.7` → cache key `stockflow-v9-8-7`
- `manifest.json` — campo `version` e `description`: `9.8.5` → `9.8.7`
- Cabeçalho `patch-v985.css`: `v9.8.5` → `v9.8.7`
- `main.js` cabeçalho: `v9.8.5` → `v9.8.7`

### Arquivos modificados
- `main.js`, `index.html`, `sw.js`, `manifest.json`, `patch-v985.css`

---

## v9.8.6 — 13/03/2026 — Swipe-Right para Voltar da Ficha Técnica

### Feature: Gesto de navegação nativo na Ficha Técnica
- **Edge Capture Zone** (`#ft-swipe-edge`): div transparente `position:fixed`, `left:0`, `width:28px`, `z-index:1220` — captura `touchstart` na borda esquerda acima do iframe, resolvendo o problema arquitetural de iframes consumirem todos os eventos touch.
- **Threshold 100px** para confirmar swipe; **flick rápido** (velocidade > 0.40 px/ms) confirma mesmo abaixo do threshold.
- **Feedback visual ao vivo**: `translateX` aplicado durante o arrasto (sem `transition`), dando sensação de "arrastar para fora" + leve fade de opacidade.
- **Commit** (`_commitSlideOut`): desliza a section até `translateX(100vw)` com `cubic-bezier(0.42, 0, 1, 1)` e restaura estado de abas.
- **Cancel** (`_snapBack`): spring back com `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- **Isolamento total** do `swipe.js`: abortado via `AbortController` quando FT não está ativa; zero conflito com o swipe de deletar itens.
- Evento `tabChanged` enriquecido com `{ from: 'fichatecnica', method: 'swipe' }` para rastreabilidade.

### CSS (`patch-v985.css`)
- Bloco §4: regras do `#ft-swipe-edge` com `touch-action: pan-y` e suporte a `safe-area-inset-left` (notch landscape).

### Arquivos modificados
- `navegacao.js` v9.7.7 → v9.8.6
- `patch-v985.css` v9.8.5 → v9.8.6 (242 linhas)

---

## v9.8.5 — 13/03/2026 — Ficha Técnica como Full-Screen Overlay

### Feature: Overlay nativo da Ficha Técnica
- Substituído `window.open('ficha-tecnica.html', '_blank')` por ativação de overlay `position:fixed; inset:0; z-index:1200`.
- Transição de entrada: `translateX(100%) → translateX(0)` com `cubic-bezier` suave.
- Classe `.ft-leaving` aciona transição de saída antes do `display:none`, evitando corte de animação.
- **Status bar cover** (`.ft-status-bar-cover`): faixa com `height: env(safe-area-inset-top)` para cobrir notch/Dynamic Island no iOS.
- **Back hint** (`#ft-back-hint`): 3 chevrons `‹` com `animation-delay` escalonado (`0 / 0.18s / 0.36s`), criando fluxo visual de "ondas" indicando direção do swipe. `pointer-events:none` — não interfere com gestos.
- Variantes de cor para todos os 4 temas (Dark, Midnight OLED, Arctic Silver, Deep Forest).
- `prefers-reduced-motion`: animação pausada, opacidade estática.
- Arquivo **`patch-v985.css`** criado (242 linhas).

### Arquivos modificados/criados
- `patch-v985.css` NOVO
- `index.html` v9.8.4 → v9.8.5
- `navegacao.js` v9.7.7 → v9.8.5

---

## v9.7.4 — 03/03/2026 — Correcoes de Bugs e Consistencia de Versao

### Bugs corrigidos

**exportarJSON e agendarSnapshot**: substituidos localStorage direto por funcoes de storage.js com fallback.
**Listeners blur duplicados**: unificados em handler unico em main.js.
**Versoes inconsistentes**: todos os arquivos alinhados para v9.7.4, cache SW atualizado.
**Melhorias**: null-guard documentado em listafacil.js, dataset documentado em producao.js.

### Versao: v9.7.3 -> v9.7.4

---

## v9.7.3 — 02/03/2026 — Produção, Lista Fácil e Compatibilidade Safari

### 1. Aba Produção — Identificação da receita em "Configurar Produção"
- O card de cada receita agora exibe o **nome em destaque** (badge verde) acima dos campos Trigo/Bola.
- Layout reestruturado: vertical (nome → inputs) em vez de grid horizontal de 3 colunas — muito mais legível em telas pequenas.
- Labels renomeados para "Trigo (kg)" e "Peso bola (g)" para maior clareza.
- CSS: `.prod-config-row--card` com `border-radius`, fundo diferenciado, `.prod-config-nome-badge` com borda accent.

### 2. Lista Fácil — Nomes e preços não truncados
- `table-layout` trocado de `fixed` para `auto`: o navegador distribui as colunas de acordo com o conteúdo.
- Coluna de nome: `word-break: break-word; white-space: normal` — nomes longos quebram linha.
- Colunas numéricas com `min-width` garantido (preço 68px, qtd 40px, total 64px, delete 36px).
- `font-size: 16px` nos inputs de preço e quantidade (evita zoom + melhora legibilidade).

### 3. Remoção da aba Histórico da Lista Fácil
- Aba "📈 Histórico" removida da Lista Fácil por solicitação.
- Imports de `carregarHistoricoCompleto`, `limparHistoricoItem` e `limparTodoHistorico` removidos de `listafacil.js` (função `registrarPrecoHistorico` mantida — histórico ainda é gravado e pode ser restaurado futuramente).
- Funções `configurarHistorico()`, `renderHistorico()` e `sparklineSVG()` removidas.

### 4. Compatibilidade total com Safari iOS
**Prevenção de zoom em inputs** (Safari faz zoom em qualquer input < 16px):
- `.lf-preco-input`: 13px → 16px
- `.lf-qtd-input`: 14px → 16px
- `.modal-input`: 15px → 16px
- `.select-tabela`: 15px → 16px
- `.lf-hist-busca`: 14px → 16px
- `.prod-input` (massa-extra.css): 15px → 16px
- Guard universal `@supports (-webkit-touch-callout: none)` → `font-size: max(16px, 1em)` em todos os inputs restantes.

**Prevenção de rolagem/bounce indesejados:**
- `html, body { overscroll-behavior: none }` — elimina o bounce vertical do iOS.
- Containers internos (`#app-root`, `.tab-content`) com `overscroll-behavior-y: contain` — scroll interno sem propagar para body.
- `-webkit-overflow-scrolling: touch` nos containers de lista para scroll fluido com momentum.

**Outros fixes Safari:**
- `body.modal-open { position: fixed }` — bloqueia scroll de fundo quando modal está aberto.
- Elementos `position: fixed` (lupa, FAB, setas) com `translateZ(0)` para evitar desaparecimento ao rolar no Safari.
- Safe area (`env(safe-area-inset-bottom)`) para notch e home indicator do iPhone.
- `-webkit-user-select: none` no container de swipe (evita seleção acidental ao arrastar).

### Versão
- v9.7.2 → v9.7.3 (todos os arquivos JS, massa-extra.css, style.css, sw.js, manifest.json)

---

## v9.7.2 — 02/03/2026 — Correções de Bugs e Consistência de Versão

### Bugs corrigidos

**[BUG] `listafacil.js` — `avaliarExpr.parseFactor` consumia `)` sem validar**
- `parseFactor` chamava `consume()` cegamente ao fechar parêntese.
  Uma expressão como `(1+2` consumiria o próximo caractere silenciosamente, produzindo resultado incorreto.
- Fix: guard `if (peek() !== ')') throw new Error('parêntese não fechado')` adicionado antes do consume.
  Idêntico ao fix já aplicado em `calculadora.js` v9.4.0.

**[BUG] `listafacil.js` + `massa.js` — imports duplicados do mesmo módulo**
- `darFeedback` e `copiarParaClipboard` eram importados em dois `import` separados de `./utils.js`.
- Fix: unificados em `import { darFeedback, copiarParaClipboard } from './utils.js'`.

**[BUG] `listafacil.js` — `.slice()` redundante em `renderHistorico`**
- `keys` já é um novo array produzido por `.filter()`. O `.slice()` criava cópia desnecessária.
- Fix: `keys.sort().forEach(...)` — sem `.slice()`.

**[BUG] Inconsistências de versão em todo o projeto**
- `listafacil.js` declarava `v9.9.0` (versão futura inexistente).
- `massa.js`, `idb.js`, `storage.js` declaravam `v9.8.0` (idem).
- `sw.js` usava `CACHE_NAME = 'stockflow-v9-7-1'` — usuários com SW antigo não recebiam cache atualizado.
- `storage.js` embutia `versao: '9.7.1'` nos backups exportados.
- `manifest.json` campo `description` ainda dizia `v9.7.1`.
- Fix: todos os arquivos alinhados para `v9.7.2`; cache bumpeado para `stockflow-v9-7-2`.

### Versão
- v9.7.1 → v9.7.2 (todos os arquivos JS, sw.js, manifest.json)

---

# Changelog — StockFlow Pro

## v9.7.0 — 02/03/2026 — Destaque de Elementos Flutuantes + Fix Lupa

### Correções
- **FIX CRÍTICO:** Lupa de busca parou de funcionar — classe `.search-open` não tinha regra CSS correspondente. Adicionada a regra faltante + overlay trocado de `position:absolute` para `position:fixed` (desaparecia com scroll).
- **FIX:** Lupa não respondia a click no desktop — adicionado listener `click` + `pointerdown` para fechar ao tocar fora.
- Reescrita da função `iniciarLupa()` com lógica de toggle robusta (`abrirBusca` / `fecharBusca` / `toggleBusca`).

### Melhorias Visuais
- **Lupa, setas (↑↓) e FAB:** Trocado `var(--glass-bg)` (quase transparente no dark) por `var(--surface-2)` com borda `rgba(255,255,255,0.20)` — visíveis em todos os temas sem perder estética Apple.
- Sombra dos flutuantes reforçada: `0 6px 24px rgba(0,0,0,0.60)`.
- Overrides por tema: Arctic usa fundo branco + borda escura; Forest usa tinge verde.
- FAB da Lista Fácil: sombra extra `0 4px 16px rgba(0,0,0,0.45)` para destacar sobre fundo verde escuro.

### Versão
- Versão: v9.6.0 → v9.7.0 (style.css, index.html, manifest.json, sw.js, main.js)

## v9.6.0 — 28/02/2026 — Histórico Global de Preços

### Nova funcionalidade — Aba Histórico (Lista Fácil v2.6.0)
- **Aba "📈 Histórico"** adicionada à Lista Fácil, entre as abas Lista e Comparador.
- Painel completo com um card por produto que já teve preço registrado.
- Cada card exibe: nome do produto, último preço, mínimo e máximo históricos, tendência em %, sparkline expandida (120px) e chips de data com o valor de cada registro.
- **Busca em tempo real** por nome de produto dentro do histórico.
- **Limpar por produto** — botão ✕ em cada card abre confirmação antes de apagar.
- **Limpar tudo** — botão visível apenas quando há dados; abre confirmação antes de apagar.

### storage.js
- `carregarHistoricoCompleto()` — retorna o objeto completo `{ chave: [{d,v},...] }`.
- `limparHistoricoItem(nomeItem)` — remove o histórico de um produto específico.
- `limparTodoHistorico()` — apaga todo o histórico de preços.
- `mesclarHistorico(historicoExterno)` — mescla histórico importado com o local, deduplicando por data e respeitando o limite de pontos. Útil para restauração de snapshots.
- Limite de pontos por produto aumentado de 6 para 10 (`MAX_HIST`).

### Outros
- sw.js: cache atualizado para `stockflow-v9-6`.
- manifest.json: versão atualizada para v9.6.0.
- Versão: v9.5.0 → v9.6.0

---

## v9.4.0 — 28/02/2026 — Correcoes de Bugs

### Bugs criticos corrigidos

**[CRITICO] mostrarAlertaElegante disparava callback destrutivo anterior**
- toast.js usava window.acaoConfirmacao = null, que nao afetava a variavel de escopo de modulo privada em confirm.js.
- Fix: mostrarAlertaElegante migrada para confirm.js. toast.js simplificado.

**[CRITICO] Dependencia circular utils -> toast -> utils -> confirm resolvida**
- utils.js agora importa mostrarAlertaElegante de confirm.js, nao de toast.js.

**[MAJOR] FOUC — flash do tema escuro ao carregar com tema salvo**
- Script inline no head aplica classe ao html antes do primeiro render.
- aplicarTema() limpa as classes do html apos aplica-las ao body.

**[MAJOR] Trocas de aba nao faziam scroll para o topo — corrigido em navegacao.js**

### Melhorias de tema
- Arctic Silver: btn-star escurecido para #C07000 (contraste 4.6:1 sobre branco).
- Modal inputs: classe .modal-input com tokens de tema corretos.
- 18 inline styles migrados para classes CSS puras.

### Aba Massa
- Migracao automatica da chave de storage legada massaMasterBase -> massaMasterBase_v1.

### Outros
- sw.js: cache stockflow-v9-4.
- confirm.js: botoes usam className (.perigo/.sucesso/.alerta) nao style.backgroundColor.

---

## v9.3.0 — 28/02/2026
### Novas funcionalidades
- **Aba Massa Master** — calculadora proporcional de receita de pizza.
  - Receita base editável (açúcar, sal, fermento, óleo, água) por 1 kg de trigo.
  - Resultados em tempo real ao digitar a quantidade de trigo.
  - Botão "Copiar Receita" envia o texto formatado para o clipboard.
  - Botão "Padrão" restaura os valores de fábrica.
  - Base salva automaticamente no localStorage (chave `massaMasterBase_v1`).
- Atalho PWA "Massa Master" adicionado ao manifest.json.

### Correções de bugs
- **Bug crítico de temas** — `TEMA_ALIAS` mapeava `'escuro': ''`, fazendo `findIndex` retornar `-1` e o ciclo de 4 temas nunca avançar. Removida a entrada desnecessária.
- **dropdown.js** — primeiro option exibia "ITENS" (inconsistente com o HTML que usa "Todos").
- **eventos.js** — `alternarTodos()` adicionou null-guard para o elemento checkbox antes de acessar `.checked`.
- **inline styles** — todos os `style="..."` nos botões dos modais foram migrados para classes CSS puras, permitindo adaptação correta a todos os 4 temas.
- **sw.js** — cache atualizado para `stockflow-v9-3`, `massa.js` adicionado à lista de assets para uso offline.

---

## v9.2.0 — Apple Edition
- Design System com 4 temas: Dark Premium, Midnight OLED, Arctic Silver, Deep Forest.
- CSS Design Tokens completos via Custom Properties.
- Inner Glows, glassmorphism, Inter font, border radius system.
- Backup completo com 6 campos (estoque, ocultos, meus, lfItens, lfOrcamento, lfHistorico).
- Chip visual animado a cada backup automático.

## v9.1.0
- Auto Save com debounce de 2,5s.
- Snapshots diários com histórico de 60 dias.
- Popup calendário para restauração de backups por data.
- Correções: alerta.js null-guard, swipe, modal.

## v9.0.0
- Glass morphism, Gauge circular SVG, Sparklines.
- visualViewport API para iOS.
- Spring physics no swipe.
- Compartilhamento nativo + PWA completo.
---

## v9.8.3 — 13/03/2026 — Nuvem de Restauração + Versão no Logo

### Novo: Botão de Restauração Firebase (☁️)
- Botão nuvem azul adicionado à barra utilitária, ao lado do ícone de conta.
- Visível somente quando o usuário está autenticado no Firebase.
- Aciona `fbPullPrincipal()` — puxa todos os dados da nuvem para o localStorage.
- Feedback visual: pulsação (opacity animation) enquanto o pull está em andamento.
- Toast de confirmação + reload automático após sucesso.
- Guard: exibe "Sem conexão com a nuvem." se Firebase indisponível.

### Novo: Versão no Logo
- Número `v9.8.3` exibido ao lado do badge PRO no cabeçalho.
- Classe `.logo-version` — cor muted, 8px, alinhada à base do PRO badge.
- Adaptação por tema: cor ajustada para Arctic/light.

### Infraestrutura
- `VERSAO_ATUAL` → `9.8.3` (main.js)
- `VERSION` → `9.8.3`, cache `stockflow-v9-8-3` (sw.js)
- `manifest.json` → `9.8.3`
- `filemap.md` criado — mapa completo do projeto para uso em novos chats.

### Versão: v9.8.2 → v9.8.3

---

## v9.8.4 — 13/03/2026 — Alertas com Unidade de Medida

### Problema resolvido
O sistema de alertas comparava valores numéricos puros, sem considerar a unidade.
Exemplo: bacon com `200g` disparava alerta de "estoque excessivo" se o máximo
fosse `200 kg` — pois 200 > 200 era avaliado sem conversão.

### Implementação
**Modal de alerta (index.html)**
- Campo de mínimo e máximo agora têm um `<select>` de unidade ao lado:
  `g | kg | ml | L | uni`
- Layout `.alerta-input-row` (flexbox): número ocupa o espaço livre, select tem
  largura fixa de 68px — visual coerente com o restante dos modais.
- Ao abrir o modal, os selects são pré-selecionados com a unidade atual do item.

**alerta.js — conversão antes de comparar**
- `_familia(unit)` → classifica unidade em `weight`, `volume` ou `count`.
- `_toBase(value, unit)` → converte para base canônica:
  `kg → g (×1000)` / `L → ml (×1000)` / demais → valor bruto.
- Comparação só ocorre quando item e limiar pertencem à **mesma família**.
  Famílias incompatíveis (ex: kg vs ml) são silenciadas — sem falso alarme.
- Toast legível: `⚠️ Estoque baixo: Bacon (200g < mín 500g)`.
- `maxUnit` e `minUnit` persistidos no `dataset` da linha (`data-min-unit`,
  `data-max-unit`) e no JSON de dados.

**Retrocompatibilidade**
- Itens salvos sem `minUnit`/`maxUnit` assumem a unidade do próprio item.
  Nenhum dado antigo é perdido ou corrompido.

**Arquivos alterados**
- `alerta.js` — v9.7.4 → v9.8.4
- `tabela.js` — v9.7.4 → v9.8.4 (coleta minUnit/maxUnit do dataset)
- `ui.js`     — v9.7.4 → v9.8.4 (propaga minUnit/maxUnit ao inserir linhas)
- `index.html` — campos mín/máx do modal com select de unidade
- `patch-v980.css` — `.alerta-input-row`, `.alerta-unit-select`, temas

### Versão: v9.8.3 → v9.8.4

---

## v9.8.5 — 13/03/2026 — Set de Unidades Completo (Global)

### Problema resolvido
As unidades `ml`, `L`, `frd` (fardo) e `rl` (rolo) não existiam nos selects de
estoque, adicionar item e Ficha Técnica. `bld`, `crt`, `cx` e `pct` estavam
ausentes do modal de alerta. Todos os pontos do projeto estavam dessincronizados.

### Novas unidades adicionadas
| Sigla | Significado | Contexto |
|-------|-------------|----------|
| `ml`  | Mililitro   | Azeite, molhos em embalagem pequena |
| `L`   | Litro       | Óleo, refrigerante |
| `frd` | Fardo       | Papel alumínio, guardanapo, copo descartável |
| `rl`  | Rolo        | Papel alumínio, papel manteiga, PVC |

### Set canônico final (11 unidades em todos os selects)
`kg · g · ml · L · uni · pct · cx · bld · crt · frd · rl`

### Arquivos alterados
- `ui.js` — select da tabela principal: adicionados ml, L, frd, rl
- `index.html` — select "adicionar item": adicionados ml, L, frd, rl
- `index.html` — modal de alerta (mín e máx): adicionados pct, cx, bld, crt, frd, rl
- `index.html` — comparador Lista Fácil (u1, u2): adicionados pct, cx, bld, crt, frd, rl
- `listafacil.js` — UNIT_FACTOR: adicionados uni, pct, cx, bld, crt, frd, rl
- `ft-format.js` — UNIDADE_LABEL: adicionados cx, bld, crt, frd, rl
- `ft-ingredientes.js` — array de opções: adicionados cx, bld, crt, frd, rl
- `massa.js` — modal de ingrediente: adicionados cx, bld, crt, frd, rl (colher e xícara mantidas)
- `alerta.js` — _familia()/_toBase(): 'l' minúsculo reconhecido como volume; frd/rl → count

### Versão: v9.8.4 → v9.8.5
