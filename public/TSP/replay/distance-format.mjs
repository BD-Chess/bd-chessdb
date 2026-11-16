// Display units only; all stored costs and search inputs retain their original values.
const amounts={},kilometres={};
for(const [language,locale] of [['en','en-US'],['sl','sl-SI']]){
  amounts[language]=new Intl.NumberFormat(locale,{useGrouping:'always',maximumFractionDigits:6});
  kilometres[language]=new Intl.NumberFormat(locale,{useGrouping:'always',minimumFractionDigits:1,maximumFractionDigits:1});
}
export function formatDistance(value, unit=null, language='en') {
  if(unit!==null&&unit!==undefined&&unit!=='m')throw Error('Unsupported distance unit');
  if(typeof value!=='number'||!Number.isFinite(value))return '—';
  const lang=language.startsWith('sl')?'sl':'en';
  const amount=amounts[lang].format(value);
  if(unit!=='m')return amount;
  return `${amount} m (${kilometres[lang].format(value/1000)} km)`;
}
