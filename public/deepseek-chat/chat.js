'use strict';

const sessionPath = '/deepseek-chat/api/session';
const ui = Object.fromEntries(['login', 'email', 'password', 'submit', 'logout', 'account', 'status']
  .map(id => [id, document.getElementById(id)]));

function status(text, error = false) {
  ui.status.textContent = text;
  ui.status.dataset.error = String(error);
}

function showSession(session) {
  const signedIn = session.authenticated === true;
  ui.login.hidden = signedIn;
  ui.logout.hidden = !signedIn;
  ui.account.hidden = !signedIn;
  ui.account.textContent = signedIn ? session.email : '';
  status(signedIn ? 'Prijava je uspela. Oddaljena povezava z modelom še ni vzpostavljena.' : '');
}

async function sessionRequest(body) {
  const response = await fetch(sessionPath, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...(body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {}),
  });
  if (response.status === 429) throw Error('Preveč poskusov. Počakaj minuto.');
  let result;
  try { result = await response.json(); } catch { throw Error('Prijava trenutno ni na voljo.'); }
  if (!response.ok) {
    throw Error(result?.error === 'INVALID_LOGIN' ? 'Uporabniško ime ali geslo je napačno.' :
      'Prijava trenutno ni na voljo.');
  }
  return result;
}

ui.login.addEventListener('submit', async event => {
  event.preventDefault();
  if (ui.submit.disabled) return;
  ui.submit.disabled = true;
  status('Preverjam prijavo …');
  const credentials = { action: 'login', email: ui.email.value, password: ui.password.value };
  ui.password.value = '';
  try {
    showSession(await sessionRequest(credentials));
  } catch (error) {
    status(error.message, true);
    ui.password.focus();
  } finally {
    credentials.password = '';
    ui.submit.disabled = false;
  }
});

ui.logout.addEventListener('click', async () => {
  if (ui.logout.disabled) return;
  ui.logout.disabled = true;
  try {
    showSession(await sessionRequest({ action: 'logout' }));
    ui.email.focus();
  } catch (error) {
    status(error.message, true);
  } finally {
    ui.logout.disabled = false;
  }
});

sessionRequest().then(showSession, () => status('Prijava trenutno ni na voljo.', true));
