# 📊 Análise Comparativa: Planilha 3.0 × StockFlow Pro V2
> Análise profunda realizada por leitura direta das 7 abas da planilha

---

## 🗂️ Estrutura da Planilha (o que ela tem)

| Aba | Função | Observação |
|-----|--------|------------|
| CADASTROS | Registro geral de produtos | Shell vazio — ponto de entrada |
| CADASTRO ITENS | Ingredientes com valor/kg automático | Nome + Valor Pago + Peso Embalagem → R$/kg |
| CARDÁPIO | Visão do menu com disponibilidade por tamanho | **60 pizzas × 6 tamanhos** |
| PREPARO ANTECIPADO | Sub-receitas com perda de cocção | Peso antes/depois + Preço/kg final |
| FICHA TÉCNICA | Receita completa por pizza × por tamanho | 6 tamanhos **independentes** por receita |
| CUSTOS FIXOS | Gestão financeira da operação | Rateio, break-even, meta diária automáticos |
| Planilha1 | Rascunho de cálculos auxiliares | — |

---

## 🔴 FUNCIONALIDADES AUSENTES NO STOCKFLOW PRO

### 1. TAMANHOS CUSTOMIZÁVEIS EM CENTÍMETROS
**Na planilha:** 6 tamanhos nomeados em cm — `25cm / 35cm / 45cm / 55cm / 65cm / 75cm`
**No StockFlow:** Labels fixos P / M / G / GG sem correspondência física

**O que falta:**
- Campo para nomear o tamanho livremente (ex: "35cm", "Broto", "Família")
- Suporte a mais de 4 tamanhos (a planilha tem 6)
- Associação de diâmetro em cm ao tamanho cadastrado

---

### 2. FICHA TÉCNICA INDEPENDENTE POR TAMANHO
**Na planilha:** Cada pizza tem uma lista de ingredientes **completamente separada** por tamanho, com pesos específicos por tamanho. Ex: Mussarela 35cm tem 350g de massa, 80g de molho, 350g de mussarela. O 25cm tem 250g de massa, 40g de molho, 180g de mussarela.
**No StockFlow:** Aplica um fator multiplicador (1×, 1.3×, 1.6×, 2×) na receita base.

**O que falta:**
- Modo "ficha por tamanho" onde cada tamanho tem sua própria lista de ingredientes e pesos
- Os ingredientes podem variar entre tamanhos (não apenas a quantidade)
- Custo calculado independentemente por tamanho

---

### 3. PESO TOTAL DO PRODUTO FINAL
**Na planilha:** Campo `PESO TOTAL DO PRODUTO` exibido em cada ficha (ex: Mussarela 35cm = 883g, Frango c/ Catupiry 35cm = 1096g)
**No StockFlow:** Ausente completamente

**O que falta:**
- Campo de peso por ingrediente na ficha técnica
- Cálculo automático do peso total da receita pronta
- Exibição do peso final na ficha e no cardápio

---

### 4. CUSTO POR KG DO PRODUTO FINAL
**Na planilha:** Calculado automaticamente a partir do custo total ÷ peso total (ex: R$8,39 / 0,883kg = R$9,50/kg)
**No StockFlow:** Ausente

**O que falta:**
- Cálculo automático de R$/kg do produto final
- Exibido junto ao custo total na ficha técnica

---

### 5. SISTEMA DE ALERTA DE CUSTO — "VALOR DE AVISO"
**Na planilha:** Campo `VALOR DE AVISO CASO SEU CUSTO AUMENTE` — o dono define um limite de custo. Quando o custo da receita ultrapassa esse valor, a célula muda de cor (alerta visual).
**No StockFlow:** Ausente

**O que falta:**
- Campo "Custo máximo tolerado" por receita
- Alerta visual/notificação quando o custo ultrapassa o limite definido
- Badge de aviso na listagem de receitas quando o alerta é acionado
- Ideal para monitorar aumento de preços de fornecedores

---

### 6. PREÇO DE VENDA DEFINIDO DIRETAMENTE NA FICHA TÉCNICA
**Na planilha:** Campo `PREÇO DO PRODUTO` e `LUCRO BRUTO` ficam na própria ficha técnica, ao lado do custo. O dono digita o preço de venda ali mesmo e vê o lucro instantaneamente.
**No StockFlow:** O preço é definido no Simulador, separado da Ficha Técnica

**O que falta:**
- Campo de preço de venda diretamente na ficha técnica da receita
- Lucro bruto calculado inline (preço - custo) na ficha
- Margem % exibida junto ao preço na ficha

---

### 7. CARDÁPIO VISUAL COM DISPONIBILIDADE POR TAMANHO
**Na planilha:** Aba `CARDÁPIO` mostra todas as 60 pizzas com marcação (◉ = disponível, ▼ = indisponível) para cada um dos 6 tamanhos
**No StockFlow:** A aba de Exportação gera listas, mas não existe uma visão de cardápio

**O que falta:**
- Tela de Cardápio com todas as receitas em grade
- Status de disponibilidade por tamanho (ativo/inativo por tamanho)
- Layout otimizado para impressão / visualização em tela
- Integração automática: qualquer alteração na ficha reflete no cardápio (como a planilha faz)

---

### 8. RATEIO DIRETO PELO Nº DE PIZZAS VENDIDAS NO MÊS
**Na planilha:** Campo direto `NUMERO DE PIZZAS VENDIDAS NO MÊS` → calcula automaticamente `CUSTO FIXO POR PIZZA`
**No StockFlow:** O Modo Negócio calcula o break-even mas não permite inserir diretamente "vendo X pizzas por mês, qual é o custo fixo por pizza?"

**O que falta:**
- Input direto: "Quantas unidades você vende por mês?"
- Resultado imediato: "Custo fixo rateado = R$ X por unidade"
- Esse valor ser adicionado automaticamente ao custo de produção na ficha

---

### 9. CUSTO FIXO POR DIA TRABALHADO
**Na planilha:** `CUSTO FIXO POR DIA TRABALHADO` = Total fixos ÷ dias trabalhados/mês
**No StockFlow:** Está parcialmente no Modo Negócio, mas não é exibido de forma direta

**O que falta:**
- KPI visível: "Custo fixo diário = R$ X"
- Campo de quantos dias por mês você trabalha (já existe no Modo Negócio, mas o resultado não é exibido como KPI)

---

### 10. "QUANTAS PIZZAS DEVO VENDER POR DIA" — META AUTOMÁTICA
**Na planilha:** Calculado automaticamente: `QUANTAS PIZZAS DEVO VENDER POR DIA` com base nos custos fixos e preço médio
**No StockFlow:** O Modo Negócio mostra a "meta diária em unidades", mas ela depende de inputs manuais separados

**O que falta:**
- Cálculo automático da meta diária sem precisar preencher o Modo Negócio separadamente
- Exibição direta na tela de Custos Fixos: "Para cobrir seus custos você precisa vender X por dia"

---

### 11. MÉDIA AUTOMÁTICA DE PREÇO DAS PIZZAS CADASTRADAS
**Na planilha:** `MEDIA DE PREÇO DE SUA PIZZAS CADASTRADAS` calculada automaticamente = R$ 38,97
**No StockFlow:** O Dashboard mostra custo médio, mas não preço médio de venda

**O que falta:**
- KPI: preço médio de venda (não custo) das receitas cadastradas
- Usado para calcular o break-even e a meta diária com mais precisão

---

### 12. CARDÁPIO COM MAIS DE 60 RECEITAS CADASTRADAS
**Na planilha:** Suporte estrutural para 60+ pizzas diferentes
**No StockFlow:** Não há limite técnico, mas a UX não foi testada com volumes grandes

**O que falta:**
- Paginação ou virtualização da lista de receitas para grandes volumes
- Filtro por categoria (salgada / doce / especial / etc.)
- Busca mais robusta com filtros combinados

---

## 🟡 FUNCIONALIDADES PARCIALMENTE IMPLEMENTADAS

| Funcionalidade | Planilha | StockFlow | Status |
|---|---|---|---|
| Preparo antecipado com perda de cocção | ✅ Completo | ✅ `ft-preparo.js` | ✅ Equivalente |
| Ingredientes com valor/kg calculado | ✅ Completo | ✅ `ft-ingredientes.js` | ✅ Equivalente |
| Custos fixos individuais (água, luz…) | ✅ Lista detalhada | ✅ `ft-gastos.js` | ✅ Equivalente |
| Preço/kg do preparo antecipado | ✅ Automático | ✅ `ft-preparo.js` | ✅ Equivalente |
| Ponto de equilíbrio mensal | ✅ Simplificado | ✅ `ft-negocio.js` V2 | ✅ StockFlow mais completo |
| Lucro bruto por receita | ✅ Na ficha | ⚠️ Só no Simulador | ⚠️ Local diferente |
| Variações de tamanho | ✅ 6 tamanhos | ⚠️ 4 labels + fator | ⚠️ Não independente |
| Meta diária | ✅ Automática | ⚠️ Manual no Negócio | ⚠️ Fluxo diferente |

---

## ✅ O QUE O STOCKFLOW TEM A MAIS QUE A PLANILHA NÃO TEM

| Funcionalidade | StockFlow |
|---|---|
| Sincronização Firebase em tempo real | ✅ |
| Acesso multi-dispositivo | ✅ |
| PWA instalável (iOS / Android) | ✅ |
| 5 ferramentas de precificação (Decomp, Markup, CMV, Margem, %) | ✅ |
| Análise de IA automática de margens | ✅ V2 |
| Histórico e exportação (CSV, JSON, PDF) | ✅ |
| Tema escuro / claro / forest / midnight | ✅ |
| Busca e filtros em tempo real | ✅ |
| Dashboard com ranking de lucratividade | ✅ |

---

## 📋 LISTA DE FEATURES FALTANTES (PRIORIZADA)

### 🔴 Alta Prioridade — Core do negócio
1. **Ficha técnica independente por tamanho** (ingredientes próprios por tamanho)
2. **Preço de venda + lucro bruto inline na ficha técnica**
3. **Sistema de alerta de custo** (VALOR DE AVISO) por receita
4. **Rateio direto: input de "X pizzas/mês" → custo fixo por unidade**
5. **Tamanhos nomeados em cm** (suporte a nomes livres + mais de 4 tamanhos)

### 🟡 Média Prioridade — UX e completude
6. **Peso total do produto final** em gramas por receita/tamanho
7. **Custo por kg do produto final**
8. **Tela de Cardápio** com grade visual + disponibilidade por tamanho
9. **Meta diária automática** visível na tela de Custos Fixos
10. **KPI de preço médio de venda** no Dashboard

### 🟢 Baixa Prioridade — Escala e conforto
11. Filtro de receitas por categoria
12. Paginação para cardápios com 50+ receitas
13. Impressão / compartilhamento do cardápio
14. Status de disponibilidade por tamanho (ativo/inativo)
