// Mounted by the unlocked app. Presets set up the map and budgets.
export const FINLAND = 'santa1437195_uef_2cm';
export const MODES = ['one', 'restart', 'stateful'];
const FINLAND_PRESETS = [120, 300, 600];
const presetHash = first => '#finland-stateful-' + first;

export function presetFromHash(hash) {
  return FINLAND_PRESETS.find(first => presetHash(first) === hash) ?? null;
}
export function modeForCheckbox(mode, enabled) {
  return !enabled ? 'one' : mode === 'stateful' ? 'stateful' : 'restart';
}
export const COPY = {
  en: {
    label: 'Search mode', one: 'One pass', restart: 'Two passes', stateful: 'Two passes with continuation',
    presets: 'Finland presets', choose: 'Choose a time split',
    large: 'Continuation is available for large maps.',
    mismatch: 'The loaded version does not match this page. Finish any active run before reopening the demo.',
    unsupported: 'This setup requires eight compatible workers and the Finland map.',
  },
  sl: {
    label: 'Način iskanja', one: 'En prehod', restart: 'Dva prehoda', stateful: 'Dva prehoda z nadaljevanjem',
    presets: 'Prednastavitve za Finsko', choose: 'Izberi razdelitev časa',
    large: 'Nadaljevanje je na voljo za velike zemljevide.',
    mismatch: 'Naložena različica se ne ujema s stranjo. Pred ponovnim odprtjem dema končaj morebitni aktivni tek.',
    unsupported: 'Ta nastavitev potrebuje osem združljivih delavcev in zemljevid Finske.',
  },
};

export function mountPassChoice({ onChange, onPreset }) {
  const box = document.createElement('div');
  box.id = 'passChoice';
  function field(id) {
    const label = document.createElement('label');
    const title = document.createElement('span');
    const select = document.createElement('select');
    select.id = id;
    label.append(title, select);
    box.append(label);
    return { title, select };
  }
  const mode = field('passMode');
  for (const id of MODES) mode.select.add(new Option('', id));
  mode.select.value = 'restart';
  const preset = field('finlandPreset');
  preset.select.add(new Option('', ''));
  for (const first of FINLAND_PRESETS) {
    const minutes = first / 60;
    preset.select.add(new Option(minutes + ' + ' + (60 - minutes) + ' min', String(first)));
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.hidden = true;
  box.append(hint);
  const style = document.createElement('style');
  style.textContent = '#passChoice{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:10px;margin:12px 0}#passChoice[hidden],#passChoice [hidden]{display:none!important}#passChoice label{display:grid;gap:6px;min-width:0}#passChoice select{width:100%;min-width:0;min-height:48px;font-size:16px}#passChoice .hint{grid-column:1/-1}';
  box.append(style);
  document.getElementById('twoPassHint').after(box);
  let blocked = true, applying = false, currentPreset = '';
  mode.select.onchange = () => onChange(mode.select.value);
  preset.select.onchange = async () => {
    if (blocked || applying) return;
    const first = Number(preset.select.value);
    if (!FINLAND_PRESETS.includes(first)) { preset.select.value = currentPreset; return; }
    applying = true;
    preset.select.disabled = true;
    try {
      if (await onPreset(first)) history.replaceState(null, '', presetHash(first));
    } finally {
      applying = false;
      preset.select.value = currentPreset;
      preset.select.disabled = blocked;
    }
  };
  return {
    get value() { return mode.select.value; },
    set value(value) {
      if (!MODES.includes(value)) throw Error('Unknown mode');
      mode.select.value = value;
    },
    sync({ language, active, ready, large, enabled, finlandFirst }) {
      const c = COPY[language] || COPY.en;
      mode.select.value = modeForCheckbox(mode.select.value, enabled);
      blocked = active || !ready;
      mode.select.disabled = blocked;
      mode.title.textContent = c.label;
      for (const option of mode.select.options) {
        option.textContent = c[option.value];
        option.disabled = option.value === 'stateful' && !large;
      }
      preset.title.textContent = c.presets;
      preset.select.options[0].textContent = c.choose;
      currentPreset = mode.select.value === 'stateful' && FINLAND_PRESETS.includes(finlandFirst) ? String(finlandFirst) : '';
      if (!applying) preset.select.value = currentPreset;
      preset.select.disabled = blocked || applying;
      hint.hidden = mode.select.value !== 'stateful' || large;
      hint.textContent = c.large;
    },
  };
}
