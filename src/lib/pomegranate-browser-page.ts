import type { TPomegranateAuthPurpose } from '../../electron/shared/ipc-types'

/** The browser-side authorization relay is shared by desktop and Android. */
export function renderPomegranateBrowserPage(options: {
  authUrl: string
  purpose: TPomegranateAuthPurpose
  requestId: string
  scriptNonce: string
  recoveryState?: unknown
  nativeCompletion?: boolean
}): { html: string; csp: string } {
  const authUrl = safeScriptJson(options.authUrl)
  const expectedOrigin = safeScriptJson(new URL(options.authUrl).origin)
  const completePath = safeScriptJson(`/pomegranate-auth/${options.requestId}/complete`)
  const popupName = safeScriptJson(`PomegranateAuth-${options.requestId}`)
  const nativeCompletion = safeScriptJson(options.nativeCompletion ?? false)
  const completionText = safeScriptJson('You can close this tab and return to Jumble.')
  const authCopy = getAuthCopy(options.purpose)
  const initialTitle = authCopy.title
  const initialDescription = authCopy.description
  const completionTitle = safeScriptJson(authCopy.completionTitle)
  const initialRecoveryState = safeScriptJson(options.recoveryState ?? null)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Authorizing · Jumble</title>
  <style>
    :root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--surface:#09090b;--background:#171717;--card:#1f1f1f;--foreground:#fafafa;--muted:#a1a1aa;--border:#2e2e33;--primary:#795fbd;--primary-hover:#927bc9;--secondary:#29292d;--destructive:#ef4444}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:var(--surface);color:var(--foreground);text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
    main{width:min(520px,100%)}.panel{padding:32px;background:var(--background);border:1px solid var(--border);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.28);text-align:center}h1{margin:0 0 8px;font-size:20px;line-height:1.35;font-weight:600;letter-spacing:-.01em}h1.complete{margin-bottom:12px}.auth-description{max-width:420px;margin:0 auto;color:var(--muted);font-size:14px;line-height:1.55}
    .security-note{display:flex;gap:10px;margin-top:20px;padding:12px;border:1px solid rgba(59,130,246,.65);border-radius:8px;background:rgba(30,58,138,.18);color:#93c5fd;text-align:start}.security-note svg{width:16px;height:16px;flex:0 0 auto;margin-top:2px}.security-note strong{display:block;margin-bottom:2px;font-size:13px;font-weight:600}.security-note span{display:block;font-size:12px;line-height:1.5}
    .spinner{width:28px;height:28px;margin:20px auto 16px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite}p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}
    button{border:0;font:inherit;cursor:pointer;transition:background-color .2s,color .2s,opacity .2s}button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}#continue{min-height:40px;margin-top:20px;padding:0 20px;border-radius:8px;background:var(--primary);color:#18181b;font-size:14px;font-weight:600}#continue:hover{background:var(--primary-hover)}
    .operator-list{margin-top:20px;overflow:hidden;border:1px solid var(--border);border-radius:12px;background:var(--card);text-align:start}.operator{min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 12px 10px 16px}.operator+.operator{border-top:1px solid rgba(46,46,51,.75)}.operator-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;line-height:1.4}.operator.recovered .operator-label{color:var(--muted)}.operator-action{min-width:96px;height:32px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 12px;border-radius:6px;background:var(--secondary);color:var(--foreground);font-size:12px;font-weight:500}.operator-action:hover:not(:disabled){background:#34343a}.operator-action:disabled{cursor:default;opacity:.5}.operator-action.loading{opacity:1}.operator-action.loading::before{content:"";width:12px;height:12px;flex:0 0 auto;border:2px solid rgba(250,250,250,.3);border-top-color:var(--foreground);border-radius:50%;animation:spin .7s linear infinite}.check{padding:0 9px;color:#22c55e;font-size:18px;line-height:1}
    .error{color:var(--destructive)}[hidden]{display:none!important}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:560px){body{padding:0;background:var(--background)}.panel{padding:28px 20px;border:0;border-radius:0;box-shadow:none}}
  </style>
</head>
<body>
  <main>
    <section class="panel">
      <h1 id="title">${initialTitle}</h1>
      <p id="auth-description" class="auth-description">${initialDescription}</p>
      <div id="security-note" class="security-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <div>
          <strong>How it works</strong>
          <span>Your private key is split into shards held by separate, independent operators, so it is never stored in one place. Google is only used to prove your identity to the operators, never to store your key.</span>
        </div>
      </div>
      <div id="spinner" class="spinner" aria-hidden="true" hidden></div>
      <p id="status" hidden>Waiting for authorization…</p>
      <button id="continue" type="button">Continue with Google</button>
      <div id="operators" class="operator-list" aria-label="Recovery operators" hidden></div>
    </section>
  </main>
  <script nonce="${options.scriptNonce}">
    (() => {
      let currentAuthUrl = ${authUrl};
      let expectedOrigin = ${expectedOrigin};
      const completePath = ${completePath};
      const popupName = ${popupName};
      const completionText = ${completionText};
      const completionTitle = ${completionTitle};
      const initialRecoveryState = ${initialRecoveryState};
      const button = document.getElementById('continue');
      const title = document.getElementById('title');
      const authDescription = document.getElementById('auth-description');
      const securityNote = document.getElementById('security-note');
      const spinner = document.getElementById('spinner');
      const status = document.getElementById('status');
      const operatorList = document.getElementById('operators');
      const nativeCompletion = ${nativeCompletion};
      let popup = null;
      let activeOperatorIndex = null;

      const setOperatorButtonsDisabled = (disabled) => {
        operatorList.querySelectorAll('.operator-action').forEach((item) => {
          item.disabled = disabled;
        });
      };

      const setActiveOperatorLoading = (operatorIndex, loading) => {
        const activeButton = operatorList.querySelector('[data-operator-index="' + operatorIndex + '"]');
        if (!activeButton) return;
        activeButton.classList.toggle('loading', loading);
        activeButton.textContent = loading ? 'Recovering…' : 'Recover';
        activeButton.setAttribute('aria-busy', String(loading));
      };

      const openAuth = (url, origin, operatorIndex = null) => {
        popup = window.open(url, popupName, 'popup=yes,width=600,height=700');
        if (!popup) {
          spinner.hidden = true;
          status.hidden = false;
          status.className = 'error';
          status.textContent = 'The browser blocked Google sign-in.';
          if (operatorIndex === null) {
            button.hidden = false;
            button.textContent = 'Try again';
            button.style.marginTop = '18px';
          } else {
            setActiveOperatorLoading(operatorIndex, false);
            setOperatorButtonsDisabled(false);
          }
          return;
        }
        currentAuthUrl = url;
        expectedOrigin = origin;
        activeOperatorIndex = operatorIndex;
        setOperatorButtonsDisabled(true);
        if (operatorIndex === null) {
          spinner.hidden = false;
          status.hidden = false;
          button.hidden = true;
          status.className = '';
          status.textContent = 'Waiting for authorization…';
        } else {
          setActiveOperatorLoading(operatorIndex, true);
        }
      };

      const renderOperators = (operators) => {
        operatorList.replaceChildren();
        operators.forEach((operator) => {
          const item = document.createElement('div');
          item.className = 'operator' + (operator.recovered ? ' recovered' : '');

          const label = document.createElement('span');
          label.className = 'operator-label';
          label.textContent = operator.label;
          item.append(label);

          if (operator.recovered) {
            const check = document.createElement('span');
            check.className = 'check';
            check.setAttribute('aria-label', 'Recovered');
            check.textContent = '✓';
            item.append(check);
          } else {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'operator-action';
            action.dataset.operatorIndex = String(operator.index);
            action.textContent = 'Recover';
            item.append(action);
            action.addEventListener('click', () => {
              openAuth(operator.url, operator.origin, operator.index);
            });
          }
          operatorList.append(item);
        });
        operatorList.hidden = false;
      };

      button.addEventListener('click', () => openAuth(currentAuthUrl, expectedOrigin));

      if (initialRecoveryState) {
        button.hidden = true;
        status.hidden = false;
        status.textContent = 'Recovered ' + initialRecoveryState.recovered + ' of ' + initialRecoveryState.required + ' shards';
        renderOperators(initialRecoveryState.operators);
      }

      window.addEventListener('message', async (event) => {
        if (!popup || event.source !== popup || event.origin !== expectedOrigin) return;
        const data = event.data;
        const value = typeof data === 'string'
          ? data
          : data && typeof data.token === 'string' ? data.token : null;
        if (!value) return;
        // Close the OAuth popup before submitting: the native host will close
        // the relay tab as soon as it receives the result.
        if (nativeCompletion) popup.close();

        try {
          const response = await fetch(completePath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activeOperatorIndex === null
              ? { value }
              : { value, operatorIndex: activeOperatorIndex })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'callback failed');
          if (result.done) {
            if (nativeCompletion) return;
            popup.close();
            spinner.hidden = true;
            button.hidden = true;
            operatorList.hidden = true;
            title.textContent = completionTitle;
            title.classList.add('complete');
            authDescription.hidden = true;
            securityNote.hidden = true;
            status.textContent = completionText;
            return;
          }
          if (!Array.isArray(result.operators)) {
            throw new Error('invalid recovery step');
          }
          popup.close();
          popup = null;
          activeOperatorIndex = null;
          spinner.hidden = true;
          status.textContent = 'Recovered ' + result.recovered + ' of ' + result.required + ' shards';
          renderOperators(result.operators);
        } catch (err) {
          spinner.hidden = true;
          button.hidden = true;
          operatorList.hidden = true;
          status.className = 'error';
          status.textContent = err instanceof Error ? err.message : 'Key recovery failed.';
        }
      });
    })();
  </script>
</body>
</html>`

  return {
    html,
    csp:
      `default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; ` +
      `script-src 'nonce-${options.scriptNonce}'; style-src 'unsafe-inline'; connect-src 'self'; ` +
      "form-action 'none'"
  }
}

function getAuthCopy(purpose: TPomegranateAuthPurpose): {
  title: string
  description: string
  completionTitle: string
} {
  switch (purpose) {
    case 'bind':
      return {
        title: 'Connect Google to Jumble',
        description:
          'Jumble needs Google authorization to link this Nostr account for secure sign-in and account recovery on other devices.',
        completionTitle: 'Authorization complete'
      }
    case 'disconnect':
      return {
        title: 'Confirm your Google account',
        description:
          'Jumble needs to verify that you own the linked Google identity before disconnecting this account.',
        completionTitle: 'Verification complete'
      }
    case 'recovery':
      return {
        title: 'Recover your private key',
        description:
          'Jumble needs Google authorization to verify this account and request the key shards required for recovery from your selected operators.',
        completionTitle: 'Recovery complete'
      }
    default:
      return {
        title: 'Sign in to Jumble',
        description:
          'Jumble needs Google authorization to verify your identity and sign you in to the Nostr account linked to it.',
        completionTitle: 'Sign-in complete'
      }
  }
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
