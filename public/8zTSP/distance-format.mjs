// Display units only; all stored costs, references and search inputs retain their original values.
// Maps with unit m are shown in kilometres with one decimal; unitless inputs keep their own numbers.
const amounts={},kilometres={};
for(const [language,locale] of [['en','en-US'],['sl','sl-SI']]){
  amounts[language]=new Intl.NumberFormat(locale,{useGrouping:'always',maximumFractionDigits:6});
  kilometres[language]=new Intl.NumberFormat(locale,{useGrouping:'always',minimumFractionDigits:1,maximumFractionDigits:1});
}
const checkUnit=unit=>{if(unit!==null&&unit!==undefined&&unit!=='m')throw Error('Unsupported distance unit');};
// Tenths of a kilometre, rounded half up from the metre value without binary fraction drift.
const tenths=metres=>Math.round(metres/100)/10;
export function formatDistance(value, unit=null, language='en') {
  checkUnit(unit);
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  const lang=language.startsWith('sl')?'sl':'en';
  if(unit!=='m')return amounts[lang].format(value);
  return `${kilometres[lang].format(tenths(value))} km`;
}
// Reference field view: kilometres with one decimal for unit m, the raw number otherwise.
export function referenceFieldValue(raw, unit=null) {
  checkUnit(unit);
  if(typeof raw!=='number'||!Number.isFinite(raw)||raw<=0)return '';
  return unit==='m'?tenths(raw).toFixed(1):String(raw);
}
// Reference field model: an edited kilometre value becomes whole metres; unitless values stay as typed.
export function referenceFromField(text, unit=null) {
  checkUnit(unit);
  const value=Number(String(text).trim());
  if(String(text).trim()===''||!Number.isFinite(value)||value<=0)return null;
  return unit==='m'?Math.round(value*1000):value;
}
