# StockFlow Pro — Filemap v9.9.40
_Atualizado em 16/03/2026. Referência completa do projeto para uso em novos chats._

---

---

## Novidades v9.9.40 — Correção Pull-to-refresh

| Alteração | Descrição | Arquivos |
|---|---|---|
| **[BUG] Fix Pull-to-refresh — qualquer arrasto disparava refresh** | `deltaX` calculado como `clientX - clientX` (sempre 0); arrasto horizontal nunca era cancelado. Fix: `_startX` salvo no `touchstart`; `deltaX = clientX - _startX`. Arrastos com `|deltaX| > |deltaY|` ignorados. | `pullrefresh.js` |
| **[BUG] Fix Pull-to-refresh — lupa e botão Groq IA disparavam refresh** | `touchmove` não verificava se o toque havia iniciado dentro do `.table-wrapper`; `_startY` retinha valor antigo e gerava `deltaY` falso. Fix: flag `_validStart` — `true` somente quando `touchstart` ocorre dentro do wrapper; `touchmove` e `touchend` abortam se `_validStart` for `false`. | `pullrefresh.js` |
| **Bump global** | `VERSAO_ATUAL`, `VERSION`, `manifest.json`, `package.json`, `index.html` → `9.9.40` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |



| Alteração | Descrição | Arquivos |
|---|---|---|
| **[CRÍTICO] Fix `_limparConversa()` — nó zumbi** | `elMsgs.innerHTML = ''` destruía `elSugestoes` do DOM; variável de módulo ficava apontando para nó desconectado. Toda chamada posterior a `_atualizarEstadoKey()` operava em nó zumbi. Fix: remoção seletiva dos filhos de mensagem, preservando `elSugestoes` e `elLoadingDot`. | `ai-ui.js` |
| **[CRÍTICO] Fix `beforeunload` — perda silenciosa de dados no Firebase** | `beforeunload` só gravava no localStorage; dados não chegavam ao Firestore se o usuário fechasse a aba em menos de 2s após edição. Fix: `void fbPushTudo()` chamado no `beforeunload` para acionar sync imediato fire-and-forget. | `main.js`, `storage.js` (import) |
| **[ALTO] Fix `historico[]` sem limite — erro 400 Groq** | Array de histórico crescia indefinidamente; conversas longas causavam erro 400 silencioso (contexto excedido). Fix: sliding window de `MAX_HISTORICO = 20` mensagens aplicada antes de cada envio. | `ai-ui.js` |
| **[ALTO] Fix SW: `vite.config.js` e `package.json` removidos do ASSETS** | Causavam 404s silenciosos no install do SW em produção (GitHub Pages não serve esses arquivos). | `sw.js` |
| **[ALTO] Fix ObjectURL leak em `_applyBgImage`** | `onerror` não revogava `oldUrl`; se a imagem falhasse ao carregar, o ObjectURL anterior nunca era liberado. | `bg-upload.js` |
| **[MÉDIO] Fix drag FAB — `left`/`top` não zerados na restauração** | Após drag seguido de reload, `left` e `top` residuais competiam com `right` e `bottom` restaurados, posicionando o FAB incorretamente (especialmente após mudança de orientação). | `ai-ui.js` |
| **[MÉDIO] Fix `_normalizarFone()` — DDI `0055` gerava 15 dígitos** | Números com prefixo `0055` (ex: `0055 11 99999-9999`) viravam 15 dígitos — sem correspondência em `_formatarFoneDisplay`, exibidos como dígitos brutos. Fix: `0055` normalizado para `55` antes da validação. | `listafacil.js` |
| **[MÉDIO] Fix `postMessage` — targetOrigin `'*'` removido** | `window.location.origin \|\| '*'` usava `'*'` em contextos `file://`, enviando o tema para qualquer origem. Fix: sem origin válida a função retorna silenciosamente. | `theme.js` |
| **Bump global** | `VERSAO_ATUAL`, `VERSION`, `manifest.json`, `package.json`, `index.html` → `9.9.39` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |



## Novidades v9.9.39 — Auditoria de segurança e qualidade

| Alteração | Descrição | Arquivos |
|---|---|---|
| **[CRÍTICO] Fix SW: `url` não declarada** | `ReferenceError: url is not defined` quebrava todo o fetch handler do Service Worker. O filtro Firebase nunca funcionava e o modo offline estava completamente comprometido. Fix: `const url = e.request.url` adicionada antes do bloco `isFirebase`. | `sw.js` |
| **[CRÍTICO] SW: 5 módulos sem cache offline** | `ai-style.css`, `ai-ui.js`, `ai-groq.js`, `expr.js` e `pullrefresh.js` ausentes do array `ASSETS` — Assistente IA, calculadora e pull-to-refresh indisponíveis offline. | `sw.js` |
| **[SEGURANÇA] XSS em `inserirLinhaNoDOM`** | Nome do produto e quantidade interpolados sem escape em `innerHTML`. Vetor real via sync Firebase entre dispositivos. Fix: função `_esc()` adicionada e aplicada em `${n}` e `value="${q}"`. | `ui.js` |
| **[SEGURANÇA] Credenciais Firebase** | Config hardcoded em dois arquivos sem `.gitignore`. Adicionados `.gitignore`, `.env.example` e avisos inline nos dois arquivos Firebase. | `firebase.js`, `firebase.vite.js`, `.gitignore` NOVO, `.env.example` NOVO |
| **[SEGURANÇA] Chave Groq exposta no DOM** | `elKeyInput.value = carregarApiKey()` pré-prenchia o campo com a chave real, acessível via `.value` por extensões de browser. Removido nos dois pontos; substituído por placeholder contextual. | `ai-ui.js` |
| **Fix `location.reload()` em auth.js** | Exceção à convenção "sem `location.reload()`" documentada com comentário explicativo (reset de estado do Firebase Auth SDK após logout). | `auth.js` |
| **Fix `_bgDelete()` sem `await`** | Race condition: deleção async do IDB chamada sem await em `_applyBgColor` e no listener "Remover fundo". Fix: `void _bgDelete()` explícito + `async/await` no listener. | `bg-upload.js` |
| **Fix script `gen-sw` fantasma** | `"gen-sw": "node generate-sw.cjs"` apontava para arquivo inexistente — `npm run gen-sw` falhava com `MODULE_NOT_FOUND`. Script removido. | `package.json` |
| **Testes unitários criados** | Pasta `tests/` com 3 arquivos: `expr.test.js` (operações, parênteses, negativos, erros — 20 casos), `parser.test.js` (frações, mistos, decimais, edge cases — 14 casos), `storage.test.js` (merge, dedup, ordenação, limite MAX_HIST, entradas inválidas — 12 casos). | `tests/expr.test.js` NOVO, `tests/parser.test.js` NOVO, `tests/storage.test.js` NOVO |
| **Refatoração `ai-groq.js`** | Bloco fetch+error triplicado (~90 linhas) centralizado em `_callGroq()`. Arquivo reduzido de 290 → 200 linhas. API pública idêntica. | `ai-groq.js` |
| **Bump global** | `VERSAO_ATUAL`, `VERSION` (sw.js), `manifest.json`, `package.json`, `index.html` → `9.9.39` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |



## Novidades v9.9.33 — Fix troca de background + ícones novos

| Alteração | Descrição | Arquivos |
|---|---|---|
| **[FIX] Troca de imagem de fundo** | Removida animação `opacity 0→1` em `_applyBgImage`: se `onload` não disparava (race condition), imagem ficava invisível. Agora `opacity:1` imediato + `requestAnimationFrame` entre `src=''` e `src=newUrl` para forçar reload confiável. | `bg-upload.js` |
| **Novos ícones** | Ícones atualizados para versão steampunk pizza em todos os tamanhos | `icone.png`, `icone-192.png`, `icone-512.png`, `icone-maskable.png` |
| **Bump global** | `VERSAO_ATUAL` → `9.9.33` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

## Novidades v9.9.31 — Painel de fundo, fix imagem, ícones novos

| Alteração | Descrição | Arquivos |
|---|---|---|
| **Fix troca de imagem de fundo** | Bug: `revokeObjectURL` era chamado antes do `onload` da nova imagem → flash preto. Fix: revogação da URL antiga adiada para o `onload` da nova. | `bg-upload.js` |
| **Cores sólidas no fundo** | Botão "Fundo" abre painel com 10 cores sólidas (swatches), botão "Escolher imagem..." e "Remover fundo". Cor salva em `localStorage` (`stockflow_bg_color_v1`). | `bg-upload.js`, `style.css` |
| **Painel animado** | `#bg-color-panel` com `animation: bg-panel-in`, grid 5×2 de swatches, fecha ao clicar fora. | `style.css` |
| **Ícones atualizados** | Steampunk pizza — `icone.png`, `icone-192.png`, `icone-512.png`, `icone-maskable.png` substituídos. | `icone*.png` |
| **Bump global** | `VERSAO_ATUAL` → `9.9.31` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.30 — Fix definitivo background zoom (todos os browsers)

| Fix | Descrição | Arquivos |
|---|---|---|
| **[CRÍTICO] Background zoom — causa raiz real** | `100vw`/`100vh` mudam quando a barra de endereço do browser aparece/some durante o scroll — isso redimensiona o `position:fixed`, causando o efeito de zoom em todos os browsers móveis. Fix: dimensões travadas em `window.innerWidth`×`window.innerHeight` (px) via JS. Listener `resize` com debounce 150ms atualiza só em resize real (orientação/janela), nunca durante scroll. `inset:0` e `100vw/100vh` removidos do CSS. | `bg-upload.js`, `style.css` |
| **Bump global** | `VERSAO_ATUAL` → `9.9.30` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.29 — Fix definitivo background zoom iOS

| Fix | Descrição | Arquivos |
|---|---|---|
| **[CRÍTICO] Background zoom — fix definitivo** | Troca de `<div id="bg-image-layer">` + `background-image` por `<img id="bg-image-layer">` + `src` + `object-fit:cover`. `background-image` em `position:fixed` é repintado pelo iOS Safari a cada frame de momentum scroll. `<img>` com `object-fit` é tratado como bitmap estático no layer compositor — sem repaint, sem zoom. | `bg-upload.js`, `style.css` |
| **Bump global** | `VERSAO_ATUAL` → `9.9.29` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.28 — Fix Background iOS (zoom ao rolar)

| Fix | Descrição | Arquivos |
|---|---|---|
| **[CRÍTICO iOS] Background zoom ao rolar** | `background-attachment:fixed` no body não é suportado corretamente no iOS Safari — causa zoom/parallax ao rolar. Fix: imagem movida para `#bg-image-layer` (`position:fixed; inset:0; z-index:-2`). `_ensureOverlay()` substituída por `_ensureLayers()` que cria dois divs fixos: `#bg-image-layer` (imagem) e `#bg-overlay` (escurecimento, `z-index:-1`). `body.has-custom-bg` agora apenas seta `background-color:transparent` | `bg-upload.js` v9.8.1, `style.css` |
| **Bump global** | `9.9.27` → `9.9.28` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.27 — Redesign IA + Fixes de Microfone e Sugestões

| Alteração | Descrição | Arquivos |
|---|---|---|
| **Redesign IA — tema Ember** | `ai-style.css` v2.0: acento âmbar `#FF9F0A` exclusivo do módulo IA, faixa âmbar no topo do modal, bolhas com cantos assimétricos, loading dots âmbar, animação de entrada nas mensagens, chips de sugestão com hover âmbar | `ai-style.css` |
| **Fix microfone** | Posicionamento do mic corrigido: `bottom:9px` → `top:50%/translateY(-50%)` — centralizado verticalmente no textarea em qualquer altura | `ai-style.css` |
| **Fix sugestões** | Sugestões agora persistem durante toda a conversa. Removido `elSugestoes.hidden = true` de 4 pontos: `_atualizarEstadoKey`, `_executarAnaliseAutomatica`, `_adicionarMensagemBot`, `_adicionarMensagemBotComCopiar` | `ai-ui.js` |
| **Bump global** | `VERSAO_ATUAL`, `VERSION` (sw.js), `manifest.json`, `package.json`, `index.html` → `9.9.26` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.23–v9.9.26 — Sugestões IA, Background Upload, Correções de Alertas

| Feature / Fix | Descrição | Arquivos |
|---|---|---|
| **Sugestões rápidas no chat IA** | Painel retrátil com 4 chips de perguntas pré-definidas; toggle com chevron animado; `aria-expanded`; chips desaparecem após análise receber resposta | `ai-ui.js` v1.7, `ai-style.css` |
| **Background Upload** | Personalização do fundo do app: usuário seleciona imagem → `createObjectURL` aplica instantaneamente; salva como `ArrayBuffer` no IDB `stockflow-bg` (sem Base64 no localStorage); `initBgUpload()` restaura no boot; `removeBg()` limpa | `bg-upload.js` NOVO v9.8.0 |
| **[CRÍTICO] Alertas — chave de mapa normalizada** | `trPorNome.get(item.n)` retornava `undefined` para nomes com quebra de linha (iOS contenteditable). Fix: chave do mapa usa `.replace(/\r\n\|\n\|\r/g,' ').trim()` idêntico ao de `coletarDadosDaTabela` | `alerta.js` |
| **[CRÍTICO] Alertas — efeitos colaterais no loop** | `alternarCheck()` era chamado dentro do loop de `verificarAlertas()`, disparando vibração, `salvarDados()` e `atualizarPainelCompras()` por item. Fix: marcação direta no DOM + um único `salvarDados()`/`atualizarPainelCompras()` ao final, somente se houve alteração | `alerta.js` |
| **Alertas — troca de unidade** | `change` no `<select>` de unidade não chamava `verificarAlertasDebounced()`. Fix: adicionado ao handler `change` do container | `main.js` |
| **Alertas — renomear item** | Editar nome de produto apagava classes `tr-alerta-min/max` e bolinhas. Fix: `verificarAlertas()` chamado imediatamente após `salvarEAtualizar()` no handler `blur` de `.nome-prod` | `main.js` |
| **Alertas — novoDia()** | `novoDia()` não disparava `verificarAlertas()` após zerar quantidades. Fix: `verificarAlertas()` adicionado ao callback | `main.js` |
| **Bump de versão** | `VERSAO_ATUAL`, `VERSION` (sw.js), `manifest.json`, `package.json`, `index.html` → `9.9.26` | `main.js`, `sw.js`, `manifest.json`, `package.json`, `index.html` |

---

## Novidades v9.9.22 — Integração IA Groq

| Feature | Descrição | Arquivos |
|---|---|---|
| **Assistente IA** | FAB flutuante arrastável (canto inferior esquerdo), bottom sheet de chat com histórico de conversa, badge "Groq" | `ai-ui.js` NOVO, `ai-style.css` NOVO |
| **API Groq** | `llama-3.3-70b-versatile`, grátis, sem restrição de região, formato OpenAI-compatible | `ai-groq.js` NOVO |
| **Gestão de chave** | Painel de configuração de API key com input `password`, link para Groq Console, salvar/remover | `ai-ui.js`, `ai-groq.js` |
| **Análise automática** | Ao abrir o chat, Groq analisa o estoque em tempo real: situação geral, itens críticos, sugestão | `ai-ui.js`, `ai-groq.js` |
| **Botão Reanalisar** | Barra de ações rápidas: dispara nova análise do estoque a qualquer momento | `ai-ui.js`, `ai-groq.js` |
| **Lista de Compras IA** | Barra de ações rápidas: Groq gera lista com quantidade sugerida por item; bolha com botão "Copiar" | `ai-ui.js`, `ai-groq.js` |
| **Modo voz** | Microfone no textarea do chat; `interimResults=true`; auto-envio após transcrição; fallback sem permissão | `ai-ui.js`, `ai-style.css` |
| **CSS isolado** | 37 classes prefixadas `.ai-`; todas as variáveis de `style.css`; zero conflitos; `[hidden]` override | `ai-style.css` |
| **index.html patch** | +2 linhas: `<link ai-style.css>` e `<script ai-ui.js>`; sem outra alteração | `index.html` |

---

## Novidades v9.9.14 — Melhorias #20–#24

| Melhoria | Descrição | Arquivos |
|---|---|---|
| **#20 audioCtx privado** | `window.audioCtx` → `let _audioCtx` em escopo de módulo | `utils.js` |
| **#21 Vitest** | 3 arquivos de teste, 48 testes, 100% passando; `expr.js` extraído de `listafacil.js` | `expr.js`, `vite.config.js`, `package.json` |
| **#22 ESLint** | `eslint.config.js` com regras mínimas para ES Modules | `eslint.config.js` NOVO, `package.json` |
| **#23 Ícone de alerta por tipo** | `▼` vermelho (mín) e `▲` laranja (máx) via CSS border trick | `style.css`, `alerta.js` |
| **#24 Google Fonts assíncrono** | `media="print" onload` elimina render-blocking | `index.html` |

---

## Novidades v9.9.13 — Melhorias #18 e #19

| Melhoria | Descrição | Arquivos |
|---|---|---|
| **#18 prefers-color-scheme** | Script FOUC detecta preferência do sistema quando sem tema salvo | `index.html`, `theme.js` |
| **#19 Sufixo de unidade** | `.qtd-unit-suffix` exibe a unidade ao lado do input de quantidade | `ui.js`, `main.js`, `style.css` |

---

## Novidades v9.9.12 — Melhorias #12 e #17

| Melhoria | Descrição | Arquivos |
|---|---|---|
| **#12 Markdown** | `marked.js v11` via `esm.sh` para changelog; fallback offline | `main.js` |
| **#17 Empty states** | Lista vazia e busca sem resultado com UI dedicada | `search.js`, `ui.js`, `style.css` |

---

## Novidades anteriores (resumo)

| Versão | Destaques |
|---|---|
| v9.9.11 | `aria-label` em todos os botões de ícone |
| v9.9.10 | `modal.js` — focus trap genérico em todos os 8 modais |
| v9.9.9  | Bottom sheet de alertas ao tocar no badge |
| v9.9.8  | Busca com `<mark>` highlight |
| v9.9.7  | Firebase SDK v10 modular; Vite; Toast com Undo |
| v9.9.6  | Validação JSON na importação; render cirúrgico; SW automático |
| v9.9.5  | Decomposição do God Object; CSS unificado; `appStore` como fonte de verdade |

---

## Arquivos do projeto — v9.9.40

### Módulos IA (novos em v9.9.22)

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `ai-groq.js` | v2.2 | API Groq (zero imports). Exports: `salvarApiKey`, `carregarApiKey`, `removerApiKey`, `apiKeyConfigurada`, `montarContextoEstoque`, `gerarAnaliseAutomatica`, `gerarListaCompras`, `enviarMensagem`. v2.2: bloco fetch centralizado em `_callGroq()` privada |
| `ai-ui.js` | v1.8 | FAB arrastável + bottom sheet + análise automática + ações rápidas + modo voz + sugestões. v1.8: fix `_limparConversa()` (nó zumbi), historico com sliding window MAX_HISTORICO=20, restauração de drag com top/left zerados. Imports: `ai-groq.js`, `store.js` (leitura), `utils.js` |
| `ai-style.css` | v1.2+ | Todos os estilos do módulo IA. 99 classes `.ai-*`. Inclui sugestões rápidas (`.ai-sugestoes`, `.ai-sugestoes-chips`, `.ai-sugestoes-chevron`). Zero conflitos com `style.css` |

### Boot & Estado

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `main.js` | v9.9.40 | Orquestrador de boot. `VERSAO_ATUAL = '9.9.40'`. Fix v9.9.39: `beforeunload` chama `fbPushTudo()` para sync imediato ao Firebase |
| `store.js` | v9.7.4 | Micro-store reativo com `EventTarget`. Singleton `appStore` |

### Persistência

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `storage.js` | v9.9.5 | localStorage + Firestore debounced 2s. `salvarDados()` atualiza `appStore.estoqueItens` |
| `idb.js` | v9.8.0 | IndexedDB para snapshots históricos (60 dias) |
| `firebase.js` | v9.9.6 | SDK Firebase v10 modular (Firestore + Auth) |
| `firebase.vite.js` | v9.9.6 | Alias para imports npm no contexto Vite |
| `auth.js` | v9.9.39 | Ciclo de vida de autenticação Firebase. `location.reload()` no logout documentado como exceção intencional |
| `reload.js` | v9.9.5 | `recarregarDados()` — substitui `location.reload()` |

### Feature: Estoque

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `ui.js` | v9.9.39 | Renderização da tabela. Atualização in-place, empty states, sufixo de unidade. Fix v9.9.39: `_esc()` em `inserirLinhaNoDOM` — XSS com nomes de produto |
| `tabela.js` | v9.8.4 | `coletarDadosDaTabela()` — serializa DOM → array |
| `eventos.js` | v9.7.4 | `alternarCheck`, `alternarTodos` |
| `alerta.js` | v9.9.14 | Alertas mín/máx, badge, bottom sheet, ícones por tipo. Fix v9.9.3–v9.9.4: chave `trPorNome` normalizada; loop sem `alternarCheck`; `atualizarPainelCompras` importado de `compras.js` |
| `compras.js` | v9.9.5 | Painel de compras — lê `appStore` |
| `listafacil.js` | v9.9.11 | Lista de compras avulsa com pedido WhatsApp |
| `calendario.js` | v9.x | Snapshots históricos no IndexedDB |
| `export.js` | v9.9.6 | Exportação/importação JSON com validação de schema |
| `search.js` | v9.9.14 | Busca com highlight `<mark>` e empty state |
| `dropdown.js` | v9.7.4 | Autocomplete de nomes de produto |
| `categorias.js` | v9.7.4 | Mapa palavras-chave → categoria |
| `produtos.js` | v9.7.4 | 43 produtos padrão de pizzaria |

### Feature: Background Personalizado

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `bg-upload.js` | v9.9.39 | Personalização de fundo do app. IDB isolado. Fix v9.9.37: `void _bgDelete()` + `async/await`. Fix v9.9.39: `onerror` revoga `oldUrl` — sem leak de ObjectURL quando imagem falha. Exports: `initBgUpload`, `removeBg` |

### Feature: Massa Master

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `massa.js` | v9.9.10 | Calculadora proporcional multi-receitas |
| `producao.js` | v9.7.6 | Planejamento de produção diária |

### Feature: Ficha Técnica

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `ft-app.js` | v9.8.8 | Boot da Ficha Técnica |
| `ft-ingredientes.js` | v3.2 | CRUD de ingredientes com histórico de preços |
| `ft-receitas.js` | v3.2 | CRUD de receitas com custo automático |
| `ft-custos.js` | v3.2 | Simulador de preço: markup, margem, lucro |
| `ft-dashboard.js` | v3.1 | KPIs: custo médio, margem, receitas ativas |
| `ft-preparo.js` | v1.2 | Preparo antecipado mobile-first |
| `ft-exportacao.js` | v3.1 | Exportação/importação CSV e JSON |
| `ft-calc.js` | v3.0 | Funções puras de cálculo financeiro |
| `ft-format.js` | v3.1 | Formatação pt-BR, masks, parsing |
| `ft-icons.js` | v3.1 | Ícones SVG estilo Apple SF Symbols |
| `ft-ui.js` | v3.0 | Toast, modais, empty states da Ficha Técnica |
| `ft-storage.js` | v1.2 | localStorage + Firestore para ingredientes/receitas/preparos |
| `ft-firebase.js` | v3.0 | Re-export de `firebase.js` para a Ficha Técnica |

### Utilitários & UI Primitivos

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `toast.js` | v9.9.6 | `mostrarToast` (3s) e `mostrarToastUndo` (8s com undo) |
| `confirm.js` | v9.9.10 | Modal de confirmação genérico |
| `modal.js` | v9.9.10 | Focus trap acessível para todos os modais |
| `calculadora.js` | v9.7.4 | Calculadora inline com `expr.js` (sem eval) |
| `expr.js` | v9.9.14 | Avaliador aritmético seguro, testável sem DOM |
| `parser.js` | v9.7.4 | Parsing de quantidades: frações, expressões, incrementos |
| `theme.js` | v9.9.20 | `dark`, `light`, `sepia`, `high-contrast`; respeita `prefers-color-scheme` |
| `navegacao.js` | v9.9.40 | Navegação entre abas via hash; menu retrátil; lazy-load iframe FT |
| `swipe.js` | v9.7.4 | Swipe horizontal em linhas da tabela |
| `pullrefresh.js` | v9.9.40 | Pull-to-refresh no `.table-wrapper`. Fix v9.9.40: `_startX` + flag `_validStart` — cancela arrasto horizontal e ignora toques fora do wrapper |
| `teclado.js` | v9.7.4 | Modo teclado físico (remove `readonly`) |
| `utils.js` | v9.9.20 | `copiarParaClipboard`, `darFeedback` (3 intensidades), `comSpinner`, `esc`, `obterDataAmanha` |

### Assets & Configuração

| Arquivo | Descrição |
|---|---|
| `index.html` | Shell SPA. v9.9.40 |
| `ficha-tecnica.html` | Página standalone da Ficha Técnica (carregada em iframe) |
| `sw.js` | Service Worker. `VERSION = '9.9.40'`, cache `stockflow-v9-9-40` |
| `manifest.json` | PWA. v9.9.40. Shortcuts: Adicionar, Lista Fácil, Massa, Produção |
| `style.css` | Estilos principais unificados (§1–§8). Absorveu patch-v976/980/985, bg-upload, massa-extra, apple-overrides |
| `ft-style.css` | Estilos da Ficha Técnica |
| `ai-style.css` | Estilos do módulo IA (isolado, prefixo `.ai-`). 99 classes |
| `patch-v976.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `patch-v980.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `patch-v985.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `bg-upload.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `massa-extra.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `apple-overrides.css` | **Stub vazio** — conteúdo migrado para `style.css` em v9.9.5 |
| `vite.config.js` | Vite + vite-plugin-pwa + Vitest |
| `vitest.config.js` | Ambiente `happy-dom`, testes em `tests/` |
| `eslint.config.js` | ESLint flat config v9 |
| `package.json` | v9.9.40. Deps: `firebase ^10`. DevDeps: `vite`, `vite-plugin-pwa`, `vitest`, `eslint` |
| `.gitignore` | **NOVO v9.9.39** — Exclui `node_modules/`, `dist/`, `.env*` do controle de versão |
| `.env.example` | **NOVO v9.9.39** — Template de variáveis de ambiente para credenciais Firebase |
| `tests/expr.test.js` | **NOVO v9.9.39** — Testes unitários de `avaliarExpr()`: operações, precedência, parênteses, negativos, erros |
| `tests/parser.test.js` | **NOVO v9.9.39** — Testes unitários de `parseFractionToDecimal()`: frações, números mistos, decimais, edge cases |
| `tests/storage.test.js` | **NOVO v9.9.39** — Testes unitários de `mesclarHistorico()`: merge, dedup por data, ordenação, limite MAX_HIST, entradas inválidas |

---

## Arquitetura de módulos

```
main.js  ←  orquestrador de boot (VERSAO_ATUAL = '9.9.40')
  ├── theme.js      (temas + prefers-color-scheme)
  ├── auth.js       (Firebase login/logout/cloud)
  ├── search.js     (lupa arrastável, filtro, highlight)
  ├── export.js     (JSON export/import + validação)
  ├── bg-upload.js  (background personalizado via IDB)
  └── reload.js     (recarregarDados sem location.reload)

ai-ui.js  ←  assistente IA (autônomo, inicia por DOMContentLoaded)
  ├── ai-groq.js    (API Groq — zero deps)
  ├── store.js      (leitura de estoqueItens apenas)
  └── utils.js      (darFeedback)

modal.js  ←  focus trap genérico
  Usado por: confirm.js, alerta.js, main.js, listafacil.js, massa.js

firebase.js  ←  SDK v10 modular (CDN ES imports)
firebase.vite.js  ←  mesma API, imports npm (para Vite)

appStore.estoqueItens  ←  fonte de verdade (atualizado por salvarDados())
  ├── compras.js  (lê store)
  ├── alerta.js   (lê store)
  └── ai-ui.js    (lê store — somente get())
```

---

## Estratégia de armazenamento

| Dado | Local | Motivo |
|---|---|---|
| Itens de estoque | `localStorage` + Firestore | Sync multi-dispositivo |
| Snapshots históricos (60 dias) | IndexedDB (`snapshots`) | Documentos grandes demais para Firestore |
| **Background personalizado** | **IndexedDB (`stockflow-bg`)** | **Imagem ocupa 1–3 MB; localStorage compartilha ~5 MB com o restante do app** |
| Preferências de UI (tema, lupa) | `localStorage` apenas | Preferência local por dispositivo |
| Receitas Massa Master | `localStorage` apenas | Dados locais do usuário |
| Ingredientes/Receitas FT | `localStorage` + Firestore | Sync multi-dispositivo |
| **Chave API Groq** | `localStorage` apenas (`stockflow_groq_key_v1`) | Permanece no dispositivo do usuário |
| **Histórico de conversa IA** | Memória (variável de módulo) | Descartado ao fechar o chat |
| **Posição do FAB IA** | `localStorage` (`stockflow_ai_btn_pos_v1`) | Preferência local |

---

## Chaves de localStorage

| Chave | Conteúdo |
|---|---|
| `estoqueDados_v4_categorias` | Array de itens do estoque |
| `itensOcultosPadrao_v4` | Itens ocultos da lista padrão |
| `meusItensPadrao_v4` | Itens personalizados do usuário |
| `temaEstoque` | Tema ativo (`midnight`, `arctic`, `forest`) |
| `lupaPosicao_v1` | Posição salva da lupa flutuante |
| `dicaSwipeMostrada` | Flag de dica de swipe |
| `listaFacil_itens_v1` | Itens da Lista Fácil |
| `listaFacil_orcamento_v1` | Orçamento da Lista Fácil |
| `listaFacil_historico_v1` | Histórico de preços (máx 10/produto) |
| `stockflow_ultima_versao` | Última versão cujo changelog foi visto |
| `massaMasterReceitas_v1` | Receitas do Massa Master |
| `stockflow_groq_key_v1` | **Chave da API Groq (módulo IA)** |
| `stockflow_ai_btn_pos_v1` | **Posição do FAB do assistente IA** |
| `ft_ingredientes` | Ingredientes da Ficha Técnica |
| `ft_receitas` | Receitas da Ficha Técnica |
| `ft_preparos` | Preparos antecipados da Ficha Técnica |

---

## Convenções de código

- **Sem `innerHTML` com dados externos** — `createElement` + `textContent`/`setAttribute`
- **Sem `innerText`** — sempre `textContent` (evita layout reflow)
- **Sem `eval` / `Function()`** — expressões avaliadas por `expr.js`
- **Sem `location.reload()`** — substituído por `recarregarDados()`
- **Delegação de eventos** — listeners no container pai com `.closest()`
- **`appStore` como fonte de verdade** — leituras via `.get()`, nunca varrem o DOM
- **Módulos IA isolados** — `ai-groq.js` sem imports; `ai-ui.js` importa apenas 3 módulos

---

## Fluxo de dados principal

```
Usuário edita célula
  → eventos.js (alternarCheck / input)
  → tabela.js → coletarDadosDaTabela()
  → storage.js → salvarDados()
       ├─ localStorage (síncrono)
       ├─ appStore.set({ estoqueItens }) (reativo)
       └─ firebase.js → fbSave() (debounced 2s)
  → appStore 'change'
       ├─ alerta.js → verificarAlertas()
       ├─ compras.js → atualizarPainelCompras()
       └─ ui.js → atualizarStatusSave()

Usuário abre chat IA
  → ai-ui.js → _abrirChat()
  → _executarAnaliseAutomatica()
       ├─ appStore.get('estoqueItens') (somente leitura)
       └─ ai-groq.js → gerarAnaliseAutomatica(itens)
            └─ fetch api.groq.com (HTTPS)
```

---

## Workflow

```bash
# Desenvolvimento
npm install
npm run dev          # Vite HMR em localhost:5173

# Produção
npm run build        # dist/ com bundle minificado + SW gerado pelo plugin PWA

# Qualidade
npm run test         # Vitest — tests/ (expr, parser, storage)
npm run lint         # ESLint
npm run lint:fix     # ESLint com auto-fix
```
