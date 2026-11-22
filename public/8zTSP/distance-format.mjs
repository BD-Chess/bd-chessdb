// Display units only; all stored costs, references and search inputs retain their original values.
// Maps with unit m or 2cm are shown in kilometres with one decimal; unitless inputs keep their own numbers.
const amounts={},kilometres={};
for(const [language,locale] of [['en','en-US'],['sl','sl-SI']]){
  amounts[language]=new Intl.NumberFormat(locale,{useGrouping:'always',maximumFractionDigits:6});
  kilometres[language]=new Intl.NumberFormat(locale,{useGrouping:'always',minimumFractionDigits:1,maximumFractionDigits:1});
}
const stepsPerMetre = unit => {
  if (unit === 'm') return 1;
  if (unit === '2cm') return 50;
  if (unit == null) return null;
  throw Error('Unsupported distance unit');
};
// Tenths of a kilometre, rounded half up from the metre value without binary fraction drift.
const tenths=(raw, scale)=>Math.round(raw/(scale*100))/10;
export function formatDistance(value, unit=null, language='en') {
  const scale = stepsPerMetre(unit);
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  const lang=language.startsWith('sl')?'sl':'en';
  if(!scale)return amounts[lang].format(value);
  return `${kilometres[lang].format(tenths(value, scale))} km`;
}
// Reference field view: kilometres with one decimal for unit m, the raw number otherwise.
export function referenceFieldValue(raw, unit=null) {
  const scale = stepsPerMetre(unit);
  if(typeof raw!=='number'||!Number.isFinite(raw)||raw<=0)return '';
  return scale?tenths(raw, scale).toFixed(1):String(raw);
}
// Reference field model: an edited kilometre value becomes whole metres; unitless values stay as typed.
export function referenceFromField(text, unit=null) {
  const scale = stepsPerMetre(unit);
  const value=Number(String(text).trim());
  if(String(text).trim()===''||!Number.isFinite(value)||value<=0)return null;
  return scale?Math.round(value*1000*scale):value;
}
