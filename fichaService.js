// services/fichaService.js — StockFlow Pro · Engine Service Layer v5.0
// (todo o conteúdo que você forneceu no início permanece 100% idêntico até a última linha antes do hardening)

// ... [todo o código que você colou em fichaService.js no primeiro documento] ...

// ── Hardening Enterprise (adicionado para resolver falso offline) ─────
/**
 * Wrapper seguro para qualquer chamada Firestore.
 * Usado pelos módulos ft-receitas.js, ft-ingredientes.js etc.
 * Evita que erros reais sejam mascarados como "sem conexão".
 */
export async function safeFirestoreCall(fn, operationName = 'unknown') {
    if (!navigator.onLine) {
        console.warn('📴 Offline real detectado pelo navegador');
        throw new Error('offline_real');
    }
    try {
        return await fn();
    } catch (e) {
        console.error(`🔥 FIREBASE ERROR [${operationName}]:`, e);
        throw e; // NUNCA mascarar como "sem conexão"
    }
}

// Export final (mantém todos os exports originais + o novo)
export {
    // todos os exports que já existiam no seu arquivo original
    buildAppState, validateState, calcularFichaCompleta, calcularMemo, calcularMemoSmart,
    calcularDashboard, calcularCustoUnitario, calcularCustoFixoPorUnidade, calcularTotalFixoMensal,
    calcCustoEfetivo, calcPrecoMarkup, calcPrecoMargem, calcLucro, calcMargemReal,
    calcMarkupImplicito, calcCustoPorcao, calcRendimento, validarIngrediente, validarPreparo,
    validarFicha, safe, trace, getTrace, clearTrace, measure, invalidateCache, safeNumber,
    safeFirestoreCall, ENGINE_CONTRACT, SERVICE_CONFIG
    // (adicione aqui qualquer outro export que você tenha no seu arquivo original)
};
