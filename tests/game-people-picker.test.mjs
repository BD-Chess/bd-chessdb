import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Consumer check for /people/people.json in the /game/ (and /igra/) person picker.
// R4 interleaves popularity and contribution ranks in people[] (852 entries); the
// former slice(0,300) cap silently dropped 143 popularity people such as Faraday.
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const catalogue = JSON.parse(await read('../public/people/people.json'));
const people = catalogue.people;
const selectable = people.filter(p => p && p.ime && p.kljucni_trenutek);
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0)); };

async function mountPicker(page) {
  const html = await read(page);
  const calls = [];
  const dom = new JSDOM(html, {
    url: 'https://www.mdlxdcc.org/game/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = async (url, init) => {
        calls.push({ url: String(url), init });
        return { ok: true, json: async () => JSON.parse(JSON.stringify(catalogue)) };
      };
    },
  });
  await settle();
  return { dom, calls, doc: dom.window.document };
}

test('people.json keeps the ids that game scenes reference', async () => {
  const ids = new Set(people.map(p => p.id));
  assert.equal(ids.size, people.length, 'people[] ids are unique');
  assert.ok(people.length >= 852, `people[] has ${people.length} entries`);
  for (const slug of ['dayton1903', 'faraday1831', 'navierstokes1845']) {
    const game = JSON.parse(await read(`../public/game/${slug}/game.json`));
    for (const id of game.people_ids) assert.ok(ids.has(id), `${slug} people_id ${id} is in people.json`);
  }
});

for (const page of ['../public/game/index.html', '../public/igra/index.html']) {
  test(`${page.split('/').slice(-2, -1)[0]} picker offers every catalogue person and fetches people.json once`, async () => {
    const { dom, calls, doc } = await mountPicker(page);
    try {
      assert.equal(calls.length, 1, 'people.json is fetched exactly once');
      assert.equal(calls[0].url, '/people/people.json');
      const moment = doc.getElementById('moment');
      const catalogueOptions = [...moment.options].filter(o => o.value.startsWith('catalogue-'));
      assert.equal(catalogueOptions.length, selectable.length, 'no cap on catalogue entries');
      assert.equal(moment.options.length, 4 + selectable.length, 'four prepared moments stay first');
      const values = new Set(catalogueOptions.map(o => o.value));
      assert.equal(values.size, catalogueOptions.length, 'option values are unique');
      const byPerson = new Map(catalogueOptions.map(o => [o.getAttribute('data-person-id'), o]));
      for (const p of selectable) assert.ok(byPerson.has(p.id), `${p.id} is selectable`);
      for (const id of ['wright-brothers', 'michael-faraday', 'leonhard-euler']) {
        const option = byPerson.get(id);
        assert.ok(option, `${id} is selectable`);
        moment.value = option.value;
        moment.dispatchEvent(new dom.window.Event('change'));
        const person = people.find(p => p.id === id);
        assert.ok(doc.getElementById('prompt').value.includes(person.ime), `prompt names ${person.ime}`);
      }
      assert.match(doc.getElementById('people-status').textContent, new RegExp(String(selectable.length)));
    } finally {
      dom.window.close();
    }
  });
}
