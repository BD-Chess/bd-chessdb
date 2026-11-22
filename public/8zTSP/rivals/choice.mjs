export const RIVALS = {
  lkh: { label: 'LKH 3.0.14', min: 3, max: 1500000 },
  eax: { label: 'GA-EAX 1.0', min: 51, max: 3500 },
  ortools: { label: 'Google OR-Tools Routing', min: 3, max: 1000 },
};

export function mountEngineChoice(anchor, change) {
  const block = document.createElement('div');
  block.className = 'tsp-engine-choice';
  const label = document.createElement('label');
  const caption = document.createElement('span');
  const select = document.createElement('select');
  select.id = 'tsp-engine';
  for (const [id, text] of [['8ztsp', '8zTSP'], ...Object.entries(RIVALS).map(([id, engine]) => [id, engine.label])]) {
    select.add(new Option(text, id));
  }
  label.append(caption, select);
  const profile = document.createElement('label');
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.id = 'lkh-finland-profile';
  const profileCaption = document.createElement('span');
  profile.append(check, profileCaption);
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.hidden = true;
  block.append(label, profile, hint);
  const style = document.createElement('style');
  style.textContent = '.tsp-engine-choice{margin:12px 0}.tsp-engine-choice select{min-height:44px;font-size:16px;max-width:100%}.tsp-engine-choice label{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.tsp-engine-choice label[hidden],.tsp-engine-choice [hidden]{display:none!important}';
  block.append(style);
  anchor.before(block);
  select.onchange = change;
  return {
    get value() { return select.value; },
    set value(value) { select.value = value; },
    get competition() { return !profile.hidden && check.checked; },
    sync({ language, active, available, finland, compatible }) {
      const sl = language === 'sl';
      const rival = RIVALS[select.value];
      caption.textContent = sl ? 'TSP motor' : 'TSP engine';
      profileCaption.textContent = sl ? 'Finski primerjalni profil' : 'Finland benchmark profile';
      select.disabled = active || !available;
      profile.hidden = select.value !== 'lkh' || !finland;
      check.disabled = select.disabled;
      hint.hidden = !rival;
      if (rival) {
        const size = rival.min + '–' + rival.max.toLocaleString(language);
        hint.textContent = compatible
          ? (sl ? 'Lokalni WASM · 1 delavec' : 'Local WASM · 1 worker')
          : (sl ? 'Izberi zemljevid EUC_2D z ' + size + ' mesti.' : 'Choose an EUC_2D map with ' + size + ' cities.');
      }
    },
  };
}
