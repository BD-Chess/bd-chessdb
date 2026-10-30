// Deliberately small markdown subset. No links, images, HTML or attributes.
const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function safeMarkdown(text) {
  const codes = [];
  const inline = source => {
    let out = escape(source.replace(/\u0000/g, ''));
    out = out.replace(/`([^`\n]+)`/g, (_, code) => { codes.push(`<code>${code}</code>`); return `\u0000${codes.length - 1}\u0000`; });
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    return out.replace(/\u0000(\d+)\u0000/g, (_, n) => codes[Number(n)] || '');
  };
  const output = []; let list = null;
  for (const line of String(text).split('\n')) {
    const match = line.match(/^\s*(?:([-*]) |(\d+)\. )(.*)$/), kind = match ? match[1] ? 'ul' : 'ol' : null;
    if (kind !== list) { if (list) output.push(`</${list}>`); if (kind) output.push(`<${kind}>`); list = kind; }
    output.push(match ? `<li>${inline(match[3])}</li>` : inline(line) + '<br>');
  }
  if (list) output.push(`</${list}>`);
  return output.join('');
}
