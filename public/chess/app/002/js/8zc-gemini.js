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
      if (text.trim()) message('system', 'Gemini is unavailable in the APP preview. No native backend is configured.');
    }
    $('btnGemini').onclick = () => panel.hidden ? open() : close();
    $('geminiClose').onclick = close;
    $('geminiClear').onclick = () => { generation++; controller?.abort(); history = []; log.replaceChildren(); busy(false); $('geminiQuestion').focus(); };
    $('geminiForm').onsubmit = e => { e.preventDefault(); send($('geminiQuestion').value); };
    $('geminiQuestion').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e.target.value); } };
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    panel.querySelectorAll('[data-question]').forEach(button => { button.onclick = () => send(button.dataset.question); });
    message('system', 'Gemini is unavailable in this APP preview.');
    return { open, close };
  } };
})(window);
