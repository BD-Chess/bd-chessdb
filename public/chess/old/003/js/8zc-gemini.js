(function (root) {
  'use strict';
  root.ChessGemini = { create({ snapshot, currentFen }) {
    const $ = id => document.getElementById(id), panel = $('geminiPanel'), log = $('geminiMessages');
    let history = [], pending = false, generation = 0, controller = null;
    function message(role, text, meta = '') {
      const item = document.createElement('article'); item.className = 'gemini-message ' + role;
      const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : role === 'model' ? 'Gemini' : 'Connection';
      const body = document.createElement('div'); body.className = 'gemini-message-text'; body.textContent = text;
      item.append(label, body);
      if (meta) { const detail = document.createElement('small'); detail.textContent = meta; item.append(detail); }
      log.appendChild(item); log.scrollTop = log.scrollHeight;
      return item;
    }
    function busy(value) { pending = value; $('geminiSend').disabled = value; $('geminiQuestion').disabled = value; $('geminiStatus').textContent = value ? 'Gemini is reading this position…' : ''; }
    function open() { panel.hidden = false; $('btnGemini').setAttribute('aria-expanded', 'true'); $('geminiQuestion').focus(); }
    function close() { panel.hidden = true; $('btnGemini').setAttribute('aria-expanded', 'false'); $('btnGemini').focus(); }
    async function send(text) {
      if (pending || !text.trim()) return;
      const captured = snapshot();
      if (captured.assistanceLocked) { message('system', 'Assistance is disabled for this game.'); return; }
      const epoch = generation, location = `${captured.sideToMove === 'w' ? 'White' : 'Black'} to move · move ${captured.fen.split(' ')[5]}`;
      const question = text.trim().slice(0, 4000);
      message('user', question, location);
      $('geminiQuestion').value = ''; busy(true);
      controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 55000);
      try {
        const response = await fetch('/.netlify/functions/chess-gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: question, snapshot: captured, history }), signal: controller.signal });
        let data; try { data = await response.json(); } catch (_) { throw new Error(response.status === 429 ? 'Too many requests to the chess assistant. Please try again later.' : 'The chess assistant connection is unavailable. Please try again.'); }
        if (epoch !== generation) return;
        if (!response.ok || !data.ok) throw new Error(data.error?.message || 'Gemini could not answer this question.');
        message('model', data.text, `${location} · ${new Date(captured.capturedAt).toLocaleTimeString()}${currentFen() !== captured.fen ? ' · board has moved since this question' : ''}${data.truncated ? ' · answer shortened' : ''}`);
        history.push({ role: 'user', text: `[Position: ${captured.fen}] ${question}` }, { role: 'model', text: data.text });
        history = history.slice(-8);
      } catch (err) {
        if (epoch === generation) message('system', err.name === 'AbortError' ? 'Gemini took too long to reply. Your game continues; try again.' : err.message);
      } finally { clearTimeout(timer); if (epoch === generation) busy(false); }
    }
    $('btnGemini').onclick = () => panel.hidden ? open() : close();
    $('geminiClose').onclick = close;
    $('geminiClear').onclick = () => { generation++; controller?.abort(); history = []; log.replaceChildren(); busy(false); $('geminiQuestion').focus(); };
    $('geminiForm').onsubmit = e => { e.preventDefault(); send($('geminiQuestion').value); };
    $('geminiQuestion').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); } };
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    panel.querySelectorAll('[data-question]').forEach(button => { button.onclick = () => send(button.dataset.question); });
    message('model', 'Ask about the current position, compare CDB with DCC, or explore a plan. I use the board snapshot and available analysis for each question.');
    return { open, close };
  } };
})(window);
