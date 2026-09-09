#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const register = read('BD_MASTER_ARENA_REGISTER_LATEST.json');
const projects = read('BD_PROJECT_STATE_LATEST.json');
const delta = read('BD_MORNING_DELTA_LATEST.json');
const statuses = new Set(['RUNNING', 'STANDBY', 'NEXT', 'BUILD', 'TEST', 'BLOCKED', 'DONE', 'UNCERTAIN']);
const required = [
  'arena_id', 'family', 'project', 'name', 'version', 'branch', 'status', 'running', 'resume_ready',
  'last_verified_at', 'last_verified_source', 'source_chat', 'checkpoint', 'best_result', 'progress',
  'workers', 'machine', 'next_action', 'attention', 'confidence', 'notes'
];
const sensitive = /(api[_ -]?key|password|secret|bearer\s+|\bsk-[a-z0-9]|(?:[a-z]:\\)|(?:\/users\/)|(?:\/home\/))/i;
const fail = message => { throw new Error(message); };

if (!Array.isArray(register.arenas)) fail('Register has no arenas array.');
if (!Array.isArray(projects.projects)) fail('Project state has no projects array.');
if (!Array.isArray(delta.changes)) fail('Morning Delta has no changes array.');

const ids = new Set();
const counts = {};
for (const arena of register.arenas) {
  for (const key of required) if (!(key in arena)) fail(`${arena.arena_id || '(unknown)'} is missing ${key}.`);
  if (!arena.arena_id || ids.has(arena.arena_id)) fail(`Duplicate or empty arena_id: ${arena.arena_id}.`);
  if (!statuses.has(arena.status)) fail(`Unsupported status for ${arena.arena_id}: ${arena.status}.`);
  if (arena.running !== (arena.status === 'RUNNING')) fail(`running/status mismatch for ${arena.arena_id}.`);
  if (!['OK', 'WATCH', 'ACTION'].includes(arena.attention)) fail(`Unsupported attention for ${arena.arena_id}.`);
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(arena.confidence)) fail(`Unsupported confidence for ${arena.arena_id}.`);
  if (sensitive.test(JSON.stringify(arena))) fail(`Potentially sensitive content in ${arena.arena_id}.`);
  ids.add(arena.arena_id);
  counts[arena.status] = (counts[arena.status] || 0) + 1;
}
for (const status of statuses) {
  if (Number(register.status_counts?.[status] || 0) !== Number(counts[status] || 0)) fail(`Counter mismatch for ${status}.`);
}

const referenced = new Set();
for (const project of projects.projects) {
  if (!project.project || !Array.isArray(project.arena_ids)) fail('Malformed project record.');
  for (const arenaId of project.arena_ids) {
    if (!ids.has(arenaId)) fail(`Project ${project.project} references unknown ${arenaId}.`);
    if (referenced.has(arenaId)) fail(`Arena ${arenaId} appears in more than one project record.`);
    referenced.add(arenaId);
  }
}
for (const id of ids) if (!referenced.has(id)) fail(`Arena ${id} is absent from project state.`);
for (const change of delta.changes) if (!ids.has(change.arena_id)) fail(`Morning Delta references unknown ${change.arena_id}.`);

console.log(JSON.stringify({
  valid: true,
  arena_count: register.arenas.length,
  status_counts: counts,
  running: register.arenas.filter(a => a.running).map(a => a.arena_id),
  needs_bd: register.arenas.filter(a => a.attention === 'ACTION').map(a => a.arena_id),
  morning_delta_changes: delta.changes.length
}, null, 2));
