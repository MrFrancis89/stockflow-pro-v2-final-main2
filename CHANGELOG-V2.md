# StockFlow Pro V2 — CHANGELOG

## V2.0.0 — Arquitetura Pro + Inteligência Automática

### 🆕 Novos Arquivos

#### `ft-core.js` — Motor Central (camada `/core`)
Funções puras, zero DOM, zero Firebase. Única fonte de verdade para todos os cálculos.

- `calcularFichaTecnica(receita)` — cálculo completo centralizado:
  - custo de ingredientes
  - custo de preparo (sub-receitas)
  - overhead percentual
  - mão de obra
  - custo fixo rateado
  - perdas no preparo
  - custo total e custo unitário
- `precificar({ custoUnitario, margem, taxas })` — precificação profissional com taxas:
  - suporte a delivery, impostos, taxa de cartão
  - breakdown detalhado por componente
- `calcularPontoEquilibrio({...})` — ponto de equilíbrio, meta diária, lucro estimado
- `analisarMargemSaude(margem)` — classificação crítica/baixa/boa/ótima com sugestões
- `calcularVariacoes(custo, tamanhos, margem)` — variações P/M/G/GG com fatores automáticos
- `analisarReceitas(receitas)` — detecção automática de problemas financeiros

#### `ft-ia.js` — Inteligência Automática
- `renderInsightsPanel()` — painel visual com KPIs + alertas + sugestões acionáveis
- `renderMargemBadge()` — badge inline de saúde da margem por receita
- `sugerirPreco()` — preço sugerido automático baseado em margem alvo

#### `ft-negocio.js` — Modo Negócio
- Formulário de configuração financeira (custo fixo, preço médio, custo variável, dias)
- Ponto de equilíbrio com gauge visual
- Meta diária em unidades e R$
- Simulação de 3 cenários: PE / +20% / +50%
- Persistência automática via Firebase

#### `ft-variacoes.js` — Variações de Tamanho
- Tabela P/M/G/GG com fatores de multiplicação configuráveis
- Custo e preço sugerido calculados por tamanho
- Badges inline para uso em listas de receitas

#### `ft-v2-style.css` — CSS dos novos componentes
- Painel de IA (`.ia-panel`, `.ia-insight`, `.ia-kpi`)
- Modo Negócio (`.neg-*`)
- Variações (`.var-*`)
- Compatível com todos os temas (midnight, arctic, forest)

### 🔄 Arquivos Atualizados

#### `ft-calc.js`
- Re-exports de `ft-core.js`: `calcularFichaTecnica`, `precificar`,
  `calcularPontoEquilibrio`, `analisarMargemSaude`, `calcularVariacoes`, `analisarReceitas`
- 100% retrocompatível — nenhuma função existente removida ou alterada

#### `ft-dashboard.js`
- Import de `renderInsightsPanel` de `ft-ia.js`
- Painel de IA inserido após KPIs (`<div id="ft-ia-insights-container">`)
- Tutorial atualizado com nota sobre V2

#### `ft-app.js`
- Import e inicialização de `ft-negocio.js` (`initNegocio`, `renderNegocio`)
- Tab `'neg'` adicionada ao `validTabs` do postMessage
- Tab `'neg'` adicionada ao switch de navegação
- `initNegocio()` incluído em todos os 3 caminhos de boot (normal, offline, forceOffline)

#### `ft-icons.js`
- `business` — ícone de casa/negócio
- `settings` — ícone de engrenagem leve
- `calc` — ícone de calculadora
- `sizes` — ícone de tamanhos/variações

#### `ficha-tecnica.html`
- Aba "Negócio" adicionada à nav inferior (ícone de casa, cor verde ativa)
- Seção `#ft-sec-neg` com container `#ft-negocio`
- Link `ft-v2-style.css` inserido após `ft-style.css`
- Cor da aba negócio: `--v2-green` (#30D158)

### 🔒 Preservado Intacto (100%)

- `firebase.js` — configuração e inicialização do Firebase SDK v10
- `auth.js` — ciclo de vida de autenticação (Google Sign-In, logout)
- `ft-firebase.js` — funções Firebase da Ficha Técnica
- `ft-storage.js` — camada de persistência (localStorage + Firestore)
- Todo o fluxo de login/logout/sessão

---

## Deploy (GitHub Pages)

1. Faça upload de **todos** os arquivos do projeto para o repositório
2. Garanta que os 4 novos arquivos estão incluídos:
   - `ft-core.js`
   - `ft-ia.js`
   - `ft-negocio.js`
   - `ft-variacoes.js`
   - `ft-v2-style.css`
3. Configure GitHub Pages para servir a branch `main` (raiz `/`)
4. Acesso via `https://[usuario].github.io/[repo]/ficha-tecnica.html`

## Arquitetura de Camadas V2

```
/core     → ft-core.js (funções puras, zero DOM, zero Firebase)
/data     → ft-firebase.js, ft-storage.js (comunicação Firebase)
/ui       → ft-app.js, ft-*.js com render* (interface)
/services → ft-ia.js (inteligência automática)
```
