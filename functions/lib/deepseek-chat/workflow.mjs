export const workflowOperations = new Set(['chat', 'projects', 'plan', 'build', 'approve', 'reject', 'status', 'review']);
export const workflowId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const workflowProject = /^[a-z][a-z0-9-]{0,39}$/;
export const workflowHash = /^[0-9a-f]{64}$/;
export const zipLimit = 4 * 128 * 1024 + 1024;

const fields = {
  chat: ['prompt', 'reasoning'],
  projects: [],
  plan: ['project', 'prompt'],
  build: ['project', 'prompt'],
  approve: ['project', 'proposalId', 'baseSha256', 'diffSha256'],
  reject: ['project', 'proposalId', 'baseSha256', 'diffSha256'],
  status: ['project', 'jobId'],
  review: ['project', 'jobId', 'reasoning'],
};

const text = (value, limit) => typeof value === 'string' && value.isWellFormed() && value.trim() &&
  value.length <= limit && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(value);
const word = (value, pattern) => typeof value === 'string' && pattern.test(value);
const hasKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function workflowInput(body, outer = ['id', 'operation']) {
  const operation = body?.operation;
  if (!workflowOperations.has(operation) || !hasKeys(body, [...outer, ...fields[operation]]) || !word(body.id, workflowId)) {
    return null;
  }
  const data = {operation};
  if (Object.hasOwn(body, 'project')) {
    if (!word(body.project, workflowProject)) return null;
    data.project = body.project;
  }
  if (Object.hasOwn(body, 'prompt')) {
    if (!text(body.prompt, 8000)) return null;
    data.prompt = body.prompt.trim();
  }
  if (operation === 'chat' || operation === 'review') {
    if (typeof body.reasoning !== 'boolean') return null;
    data.reasoning = body.reasoning;
  }
  if (operation === 'status' || operation === 'review') {
    if (!word(body.jobId, workflowId)) return null;
    data.jobId = body.jobId;
  }
  if (operation === 'approve' || operation === 'reject') {
    if (!word(body.proposalId, workflowId) || !word(body.baseSha256, workflowHash) || !word(body.diffSha256, workflowHash)) return null;
    Object.assign(data, {proposalId:body.proposalId, baseSha256:body.baseSha256, diffSha256:body.diffSha256});
  }
  return data;
}

export function workflowResult(request, result, state) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;
  const {operation,project} = request;
  if (operation === 'chat') return text(result.reply, 64000) ? {reply:result.reply} : null;
  if (operation === 'projects') {
    if (!Array.isArray(result.projects) || result.projects.length > 100 ||
        !result.projects.every(item => word(item?.id, workflowProject) && text(item.label, 120))) return null;
    return {projects:result.projects.map(({id,label}) => ({id,label}))};
  }
  const states = {planned:'complete',proposed:'complete',applied:'complete',rejected:'complete',reviewed:'complete',
    running:'complete',failed:'failed',cancelled:'stopped',needs_review:'uncertain'};
  const kind = {planned:'plan',proposed:'build',applied:'approve',rejected:'reject',reviewed:'review'};
  const settledBuild = operation === 'status' && result.action === 'build' &&
    (result.status === 'applied' || result.status === 'rejected');
  if (result.project !== project || !workflowOperations.has(result.action) ||
      result.id !== (operation === 'status' ? request.jobId : request.id) ||
      (operation !== 'status' && result.action !== operation) || !Object.hasOwn(states,result.status) ||
      states[result.status] !== state || (Object.hasOwn(kind,result.status) && kind[result.status] !== result.action && !settledBuild)) return null;
  const view = {id:result.id,action:result.action,project,status:result.status};
  if (word(result.readbackSha256,workflowHash)) view.readbackSha256 = result.readbackSha256;
  for (const [field, limit] of [['plan',96*1024],['diff',96*1024],['testReport',96*1024],['review',96*1024]]) {
    if (text(result[field], limit)) view[field] = result[field];
  }
  if (result.status === 'proposed') {
    if (!view.diff || result.proposalId !== result.id || !word(result.proposalId, workflowId) || !word(result.baseSha256, workflowHash) || !word(result.diffSha256, workflowHash)) return null;
    Object.assign(view, {proposalId:result.proposalId, baseSha256:result.baseSha256, diffSha256:result.diffSha256});
  }
  if (result.status === 'planned' && !view.plan) return null;
  if (result.status === 'reviewed' && !view.review) return null;
  if (word(result.error,/^(?:OPENCODE|RHP)_[A-Z0-9_]{2,60}$/)) view.error = result.error;
  return view;
}

export function workflowZip(value, id) {
  if (!hasKeys(value,['schema','id','direction','sizeBytes','sha256']) || value.schema !== 'mydeepseekrhp.markdown-zip.v1' ||
      value.id !== id || value.direction !== 'result' || !Number.isSafeInteger(value.sizeBytes) ||
      value.sizeBytes < 30 || value.sizeBytes > zipLimit || !word(value.sha256, workflowHash)) return null;
  return {schema:value.schema,id,direction:value.direction,sizeBytes:value.sizeBytes,sha256:value.sha256};
}
