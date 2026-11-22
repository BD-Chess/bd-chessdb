// One complete, chunked JSON serializer for download and file sharing.
export function createRunFile(record, tour) {
  if (!record || !tour?.length) throw Error('No result to export');
  const parts = [JSON.stringify({ ...record, tour: undefined }).slice(0, -1) + ',"tour":['];
  for (let i = 0; i < tour.length; i += 65536)
    parts.push((i ? ',' : '') + Array.from(tour.subarray(i, i + 65536), x => x + 1).join(','));
  parts.push(']}');
  return new File(parts, '8ztsp-run.json', { type: 'application/json' });
}
export function downloadRunFile(file) {
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
