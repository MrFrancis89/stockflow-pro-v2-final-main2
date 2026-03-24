// auth.js — StockFlow Pro v9.9.5
// ══════════════════════════════════════════════════════════════════
// Módulo extraído de main.js (v9.9.5 — decomposição do God Object).
// Responsabilidade única: ciclo de vida de autenticação Firebase.
// Exporta: initAuth, initLogoutButton, initCloudButton
//
// NOTA SEGURANÇA: _atualizarHeaderUser usa createElement em vez de
// innerHTML para os dados do usuário (photoURL, displayName) — os
// atributos DOM são encodados automaticamente pela API, eliminando
// o risco de XSS com dados externos do provider.
// ══════════════════════════════════════════════════════════════════

import { initFirebase, fbGetCurrentUser, fbSignInGoogle,
         fbSignOut, fbIsAvailable, fbGetUser } from './firebase.js';
import { fbPullPrincipal } from './storage.js';
import { mostrarToast } from './toast.js';
import { mostrarConfirmacao } from './confirm.js';
import { recarregarDados } from './reload.js';

// ── UI helpers (privados) ─────────────────────────────────────────

function _mostrarLoginApp(erro = '') {
    const ov = document.getElementById('app-login-overlay');
    if (!ov) return;
    // erro é sempre string literal hardcoded neste módulo — sem risco de XSS
    ov.querySelector('.app-login-erro').textContent = erro;
    ov.style.display = 'flex';
    requestAnimationFrame(() => ov.classList.add('visible'));
}

function _ocultarLoginApp() {
    const ov = document.getElementById('app-login-overlay');
    if (!ov) return;
    ov.classList.remove('visible');
    setTimeout(() => { ov.style.display = 'none'; }, 300);
}

/**
 * Atualiza o avatar e tooltip do botão de usuário no header.
 * Usa createElement + setAttribute — valores do provider nunca
 * passam por innerHTML, eliminando XSS com dados externos.
 */
function _atualizarHeaderUser(user) {
    const btn = document.getElementById('btn-usuario');
    if (!btn) return;

    const foto = user.photoURL;
    const nome = user.displayName || user.email || 'Usuário';

    btn.innerHTML = '';

    if (foto) {
        const img = document.createElement('img');
        img.src    = foto;                     // atributo DOM — encoding automático
        img.alt    = nome;                     // idem
        img.style.cssText = 'width:22px;height:22px;border-radius:50%;' +
            'border:2px solid var(--accent,#FF9500);object-fit:cover;' +
            'display:block;flex-shrink:0;';
        btn.appendChild(img);
    } else {
        const span = document.createElement('span');
        span.textContent = nome.charAt(0).toUpperCase(); // textContent — encoding automático
        span.style.cssText = 'width:22px;height:22px;border-radius:50%;' +
            'background:var(--accent,#FF9500);color:#000;font-size:11px;' +
            'font-weight:700;display:flex;align-items:center;' +
            'justify-content:center;flex-shrink:0;';
        btn.appendChild(span);
    }

    btn.title        = nome;   // atributo DOM — encoding automático
    btn.style.display = 'flex';

    const btnCloud = document.getElementById('btn-restaurar-cloud');
    if (btnCloud) btnCloud.style.display = 'flex';
}

// ── API pública ───────────────────────────────────────────────────

/**
 * Inicializa o Firebase e gerencia o fluxo de autenticação.
 * - Se já existe sessão: pull silencioso dos dados.
 * - Se não logado: exibe overlay de login e aguarda.
 * @returns {Promise<boolean>} true se autenticado, false se SDK indisponível
 */
export async function initAuth() {
    const sdkOk = await Promise.race([
        initFirebase(),
        new Promise(r => setTimeout(() => r(false), 6000)),
    ]);
    if (!sdkOk) return false; // modo offline — app continua sem Firebase

    const user = await fbGetCurrentUser();
    if (user) {
        _atualizarHeaderUser(user);
        await fbPullPrincipal();
        return true;
    }

    // Não logado → exibe overlay e retorna Promise que resolve após login
    return new Promise(resolve => {
        _mostrarLoginApp();

        document.getElementById('app-btn-google')?.addEventListener('click', async () => {
            const btn = document.getElementById('app-btn-google');
            if (btn) {
                btn.disabled = true;
                // FIX #4 CRÍTICO: null-guard — TypeError se <span> não existir
                // travava o botão disabled permanentemente sem possibilidade de retry.
                const span = btn.querySelector('span');
                if (span) span.textContent = 'Aguarde…';
            }

            try {
                const u = await fbSignInGoogle();
                _ocultarLoginApp();
                _atualizarHeaderUser(u);
                await fbPullPrincipal();
                resolve(true);
            } catch (e) {
                const msg =
                    e.code === 'auth/popup-closed-by-user' ? 'Login cancelado.'             :
                    e.code === 'auth/popup-blocked'        ? 'Popup bloqueado. Permita popups para este site.' :
                                                             'Falha ao entrar. Tente novamente.';
                _mostrarLoginApp(msg);
                if (btn) {
                    btn.disabled = false;
                    const span = btn.querySelector('span');
                    if (span) span.textContent = 'Entrar com Google';
                }
                // Não resolve → o usuário tenta novamente
            }
        }, { once: true }); // FIX #MÉDIO: once:true evita acumulação se initAuth() re-executar
    });
}

/**
 * Registra o listener de logout no botão #btn-usuario.
 * Chamado uma vez no DOMContentLoaded.
 */
export function initLogoutButton() {
    document.getElementById('btn-usuario')?.addEventListener('click', async () => {
        const user = fbGetUser();
        if (!user) return;
        const nome = user.displayName || user.email || 'Usuário';
        mostrarConfirmacao(`Sair da conta ${nome}?`, async () => {
            await fbSignOut();
            // location.reload() é intencional aqui: necessário para resetar o estado
            // em memória do Firebase Auth SDK após o logout. recarregarDados() não
            // limpa o estado interno do SDK — apenas um reload completo garante isso.
            // Única exceção documentada à convenção "sem location.reload()" do projeto.
            location.reload();
        });
    });
}

/**
 * Registra o listener do botão ☁️ (restaurar dados da nuvem).
 * Chamado uma vez no DOMContentLoaded.
 */
export function initCloudButton() {
    document.getElementById('btn-restaurar-cloud')?.addEventListener('click', async () => {
        if (!fbIsAvailable()) {
            mostrarToast('Sem conexão com a nuvem.', 'aviso');
            return;
        }
        const btn = document.getElementById('btn-restaurar-cloud');
        btn?.classList.add('loading');
        try {
            await fbPullPrincipal();
            recarregarDados({ toast: 'Dados restaurados da nuvem!', toastTipo: 'sucesso' });
        } catch (e) {
            mostrarToast('Erro ao restaurar dados da nuvem.', 'erro');
            console.error('[cloud] fbPullPrincipal falhou:', e);
        } finally {
            btn?.classList.remove('loading');
        }
    });
}
