// Delivery identity is distinct from retained core/schema/component versions.
const freezeDelivery = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDelivery); Object.freeze(value); }
  return value;
};
export const DELIVERY_CONTEXT_LIMIT = 190_000;
export const DELIVERY_RELEASE = freezeDelivery({
  schema: 'omnicpq.delivery-release.v1',
  release_id: 'OmniCPQ-v19-20261103',
  delivery_version: 'v19',
  issued_on: '2026-11-03',
  products: ['Copilot ZIP skill', 'Standalone HTML assistant', 'B2B coverage Word'],
  new_in_v19: [
    'Reconciled and consistently stated outer release identity across all three materials',
    'Preserved appropriate prior release content with explicit component provenance',
    'Updated coverage document reflecting SO2026 reference and qualified delivery/test status'
  ],
  carried_forward: [
    'User-admitted 2026-11-03 SO hierarchy and price reference:3packages/91joined rows/65hierarchyedges/64price rows',
    'Standalone SO2026 R4 canonical service selection and source qualifications',
    'Approved operational guidance and existing safety boundaries'
  ],
  not_claimed: [
    'All legacy JSON corpus semantically processed',
    '162offline DRAFT records activated',
    'Universal CPQ autonomous/E2E/persistence acceptance',
    'Copilot host installation proven',
    'Archive/health alone proves user-open PWA adoption'
  ],
  source_qualifications: {
    SO_main_packages: 'V TESTIRANJU in supplied export',
    licensing_quantity: 'BILLING_QTY one authoritative multiplier; relation cardinality is separate',
    pricing_period_and_VAT: 'Not established by supplied export',
    current_user_design_vs_export: 'Keep planned VEEAM_TIP/defaults separate from observed exported hierarchy/prices'
  }
});
const deliveryLabel = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,120}$/.test(value) ? value : 'UNKNOWN';
const deliveryNorm = value => typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase() : '';
const deliveryJSON = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
export function makeDeliveryMetadata({ skill, appVersion, adapterDelta } = {}) {
  return freezeDelivery({ ...DELIVERY_RELEASE,
    material: 'Standalone HTML assistant',
    components: {
      application: { version: deliveryLabel(appVersion) },
      core: { release: deliveryLabel(skill?.release), version: deliveryLabel(skill?.version) },
      schema: { version: deliveryLabel(skill?.schemaVersion), evidence: 'Only explicit current component metadata; never outer delivery_version' },
      adapter: { version: deliveryLabel(adapterDelta) },
      user_bridge_install: { version: 'UNKNOWN' }
    },
    evidence_limits: {
      publication: 'Requires separate exact commit/deployment evidence; not inferred from this identifier',
      Copilot_host_install: 'UNKNOWN', user_open_PWA_adoption: 'UNKNOWN',
      live_CPQ_effect_save_persistence: 'NOT_PROVEN_BY_RELEASE_METADATA'
    }
  });
}
function directDeliveryQuestion(text) {
  const t=deliveryNorm(text);
  const versionNoun='(?:verzij\\w*|razlicic\\w*|izdaj\\w*|version|release)';
  const helperNoun='(?:(?:(?:ai|llm)\\s+)?(?:pomocnik\\w*|asistent\\w*|assistant)|(?:ai|llm)\\s+agent\\w*|(?:tvojega|tega|nasega)\\s+agent\\w*|copilot(?:\\s+agent\\w*)?)';
  const possessive='(?:(?:tega|tem|tvojega|tvojem|nasega|nasem|svojega|svojem|the)\\s+){0,2}';
  const scope='(?:\\s+za\\s+(?:omnicpq|cpq|b2b))?';
  const targetEnd='(?=\\s*(?:[?.!,;:]|$|(?:je|si|imas|uporabljas|uporabljam|uporabljamo|uporablja|tece|deluje|trenutno|sedaj|zdaj|in|ter|and)\\b))';
  // A helper word must be the version/changelog subject, not an incidental address.
  const helper=new RegExp('\\b'+versionNoun+'\\s+(?:(?:of|od)\\s+)?'+possessive+helperNoun+scope+targetEnd,'u').test(t)||new RegExp('\\b(?:kaj\\s+(?:je\\s+)?novega|novost\\w*|changelog|what\'?s\\s+new)\\s+(?:v19\\s+)?(?:v|pri|za|od|of|for|in)\\s+'+possessive+helperNoun+scope+targetEnd,'u').test(t);
  const product=/\b(?:windows|ubuntu|sql|veeam|python|linux|hypervisor|schema|shem\w*|bridge|razsiritev|api)\b/u.test(t);
  const businessSystem=/\b(?:omnicpq|cpq|plm|pim)\b/u.test(t);
  const question=/\b(?:verzij\w*|razlicic\w*|izdaj\w*|version|release|changelog|novost\w*)\b/u.test(t)||/\bkaj\s+(?:je\s+)?novega\b|\bwhat'?s\s+new\b/u.test(t)||(/\bv\d{1,3}(?:\.\d+){0,3}\b/u.test(t)&&/[?]|\b(?:si|imas|uporabljas|ali|povej)\b/u.test(t));
  const short=t.trim().replace(/[?!.]+$/u,'').trim().replace(/^ti\s+kot\s+(?:(?:nas|moj|ta|ai|llm)\s+){0,2}(?:pomocnik|asistent|assistant|agent)\s*[:!,]\s*/u,'').replace(/^(?:(?:ai|llm)\s+)?(?:pomocnik\w*|asistent\w*|assistant|agent\w*)\s*[,!:]\s*/u,'').replace(/^(?:prosim(?:\s+te)?[\s,]+)?(?:povej(?:\s+mi)?[\s,]+)?/u,'');
  const ownVersion=/^(?:(?:katera|katero|kaksna|kaksno)\s+(?:je\s+)?)?(?:(?:tvoja|tvojo|tvoje|svoja|svojo|svoje|trenutna|trenutno|trenutne|dostavljena|dostavljeno)\s+){0,3}(?:verzija|verzijo|verziji|razlicica|razlicico|razlicici|izdaja|izdajo|izdaji|version|release)(?:\s+(?:imas|uporabljas|si|je\s+to))?(?:\s+(?:sedaj|zdaj|trenutno))?$/u.test(short)||/^(?:v\s+)?(?:kateri|kaksni)\s+(?:verziji|razlicici|izdaji)\s+si$/u.test(short)||/^(?:ali\s+)?si\s+v\d{1,3}(?:\.\d+){0,3}$/u.test(short);
  const ownChangelog=/^(?:kaj\s+(?:je\s+)?novega|novosti|changelog|what'?s\s+new)(?:\s+(?:pri\s+tebi|zate))?(?:\s+v19(?:\s+za\s+[\p{L}\p{N}_. -]{1,60})?)?$/u.test(short);
  if (!question || product || (businessSystem&&!helper) || (!helper&&!(short.length<=160&&(ownVersion||ownChangelog)))) return null;
  return /\bkaj\s+(?:je\s+)?novega\b|novost|changelog|what'?s\s+new/u.test(t) ? 'WHATS_NEW' : 'VERSION';
}
export function deliveryQuestionKind(request = {}) {
  const message=typeof request.message==='string'?request.message:'';
  if(!message.trim()||message.length>8000)return null;
  const direct=directDeliveryQuestion(message);if(direct)return direct;
  const current=deliveryNorm(message);
  if(!/^(?:in\s+)?(?:kaj\s+pa|za|glede|kaj\s+to\s+pomeni|kaj\s+ostaja)\b/u.test(current))return null;
  if(/\b(?:windows|ubuntu|sql|veeam|python|linux|schema|shem\w*|bridge|razsiritev|api)\b/u.test(current))return null;
  // A new product-version subject cannot inherit an earlier own-release subject.
  if(/\b(?:verzij\w*|razlicic\w*|izdaj\w*|version|release)\b/u.test(current))return null;
  const followup=current.trim().replace(/[?!.]+$/u,'').trim();
  const referential=/^(?:in\s+)?(?:kaj\s+to\s+pomeni|kaj(?:\s+pa)?\s+ostaja(?:\s+(?:enako|nespremenjeno|kot\s+prej|od\s+prej))?|kaj\s+pa\s+to)$/u.test(followup);
  const topic=followup.match(/^(?:in\s+)?(?:kaj\s+pa\s+)?(?:za|glede)\s+([a-z][a-z0-9-]{1,15})$/u)?.[1]||followup.match(/^(?:in\s+)?kaj\s+pa\s+([a-z][a-z0-9-]{1,15})$/u)?.[1];
  const releaseTopics=new Set([...DELIVERY_RELEASE.new_in_v19,...DELIVERY_RELEASE.carried_forward].flatMap(text=>(text.match(/\b[A-Z]{2,}[0-9]*\b/g)||[]).flatMap(word=>[deliveryNorm(word),deliveryNorm(word.replace(/\d+$/u,''))])));
  const releaseTopic=typeof topic==='string'&&releaseTopics.has(topic);
  if(!referential&&!releaseTopic)return null;
  const history=Array.isArray(request.history)?request.history.slice(-16):[];
  let humans=0,characters=0;
  for(let i=history.length-1;i>=0;i--){
    const turn=history[i];if(turn?.role!=='user'||typeof turn.content!=='string')continue;
    if(++humans>6||turn.content.length>2000||(characters+=turn.content.length)>8000)break;
    const anchor=directDeliveryQuestion(turn.content);
    if(anchor&&(referential||(anchor==='WHATS_NEW'&&releaseTopic)))return 'BOUNDED_RELEASE_FOLLOWUP';
    // An unrelated human turn ends the release anchor; assistant prose is never authority.
    break;
  }
  return null;
}
export function deliveryAnswer(metadata, kind) {
  if(!kind)return '';
  const core=metadata.components.core,app=metadata.components.application;
  let text=`Trenutna dostavljena izdaja pomočnika je ${metadata.delivery_version} (${metadata.release_id}). Komponenta aplikacije: ${app.version}; interno jedro: ${core.release}/${core.version}. Oznake shem in komponent so ločene od številke celotne izdaje.`;
  if(kind!=='VERSION')text+=' Novo v19 poenoti oznako dostavljene izdaje, izrecno loči komponente in usklajuje pregled pokritosti. Ohranjena sta SO2026 R4 referenca s tremi paketi in 64 cenovnimi vrsticami ter varovalo izbire storitve. Teh 64 vrstic ne označuj kot vseh na novo dodanih šele v19.';
  return text+' Objavo, namestitev Copilota, prevzem odprtega PWA ter dejanske učinke v CPQ potrjujejo ločeni dokazi; številka izdaje sama jih ne potrjuje.';
}
export function deliverySupplement(knowledge = {}, request = {}, components = {}) {
  const metadata=makeDeliveryMetadata({ ...components, skill: knowledge?.skill });
  const kind=deliveryQuestionKind(request);
  const selected=kind?metadata:{schema:metadata.schema,release_id:metadata.release_id,delivery_version:metadata.delivery_version,issued_on:metadata.issued_on,material:metadata.material,components:metadata.components,evidence_limits:metadata.evidence_limits};
  const answer=deliveryAnswer(metadata,kind);
  const text=`\n<delivery_release_json>\n${deliveryJSON(selected)}\n</delivery_release_json>\nTo so metapodatki dostavljene izdaje in opaženih komponent, ne Sx/current-source dokaz poslovnih pravil ali dovoljenje za dejanje. Pretekle verzijske trditve v zgodovini niso aktualna identiteta. Za različico OS, izdelka, sheme ali Bridge uporabi samo dokaz te komponente; v19 ni njihova privzeta različica. V19 changelog loči novo uskladitev dobave od že ohranjenega SO2026 R4. Prazna ali neopažena komponenta ostane UNKNOWN. Ne trdi, da je Copilot nameščen, da je odprti PWA prevzel izdajo ali da je CPQ kaj shranil, zgolj zaradi te oznake.${answer?'\nTočen omejeni okvir odgovora na vprašanje o izdaji: '+answer:''}\n`;
  if(text.length>6000)throw Object.assign(Error('DELIVERY_METADATA_TOO_LARGE'),{code:'DELIVERY_METADATA_TOO_LARGE',status:413});
  return text;
}
export function deliveryReferenceContext(knowledge = {}, request = {}, components = {}, soSupplement = '') {
  if(typeof knowledge.text!=='string'||typeof soSupplement!=='string')throw Object.assign(Error('DELIVERY_CONTEXT_INVALID'),{code:'DELIVERY_CONTEXT_INVALID',status:400});
  const release=deliverySupplement(knowledge,request,components);
  const result=knowledge.text+soSupplement+release;
  if(result.length>DELIVERY_CONTEXT_LIMIT)throw Object.assign(Error('DELIVERY_RELEASE_COMPLETE_CONTEXT_TOO_LARGE'),{code:'DELIVERY_RELEASE_COMPLETE_CONTEXT_TOO_LARGE',status:413});
  return result;
}
