// Pure lexical representation only: never constructs or decodes JSON values.
export const JSON_CONTEXT_PROFILE='STRICT_COMPLETE_JSON_ASCII_WHITESPACE_V1';
export const JSON_CONTEXT_LIMITS=Object.freeze({maxInputCodeUnits:2_000_000,maxContainerDepth:256,maxValueAndKeyTokens:500_000});

export function compactCompleteJsonAsciiWhitespace(text){
  const unchanged=status=>({text,changed:false,status,removedCodeUnits:0});
  if(typeof text!=='string')return unchanged('UNCHANGED_TYPE');
  if(text.length>JSON_CONTEXT_LIMITS.maxInputCodeUnits)return unchanged('UNCHANGED_RESOURCE');
  const parts=[];let at=0,copyAt=0,tokens=0,removed=0,resource=false;
  const digit=code=>code>=48&&code<=57;
  const hex=code=>digit(code)||code>=65&&code<=70||code>=97&&code<=102;
  const token=()=>{if(++tokens>JSON_CONTEXT_LIMITS.maxValueAndKeyTokens){resource=true;return false;}return true;};
  function whitespace(){
    const start=at;
    while(at<text.length){const code=text.charCodeAt(at);if(code!==32&&code!==9&&code!==10&&code!==13)break;at++;}
    if(at>start){if(start>copyAt)parts.push(text.slice(copyAt,start));copyAt=at;removed+=at-start;}
  }
  function string(){
    if(text.charCodeAt(at++)!==34)return false;
    while(at<text.length){
      const code=text.charCodeAt(at++);
      if(code===34)return true;
      if(code<32)return false;
      if(code!==92)continue;
      if(at>=text.length)return false;
      const escape=text.charCodeAt(at++);
      if(escape===117){for(let offset=0;offset<4;offset++)if(at>=text.length||!hex(text.charCodeAt(at++)))return false;}
      else if(![34,92,47,98,102,110,114,116].includes(escape))return false;
    }
    return false;
  }
  function number(){
    if(text.charCodeAt(at)===45)at++;
    if(text.charCodeAt(at)===48)at++;
    else{const first=text.charCodeAt(at);if(!(first>=49&&first<=57))return false;while(digit(text.charCodeAt(at)))at++;}
    if(text.charCodeAt(at)===46){at++;if(!digit(text.charCodeAt(at)))return false;while(digit(text.charCodeAt(at)))at++;}
    if(text.charCodeAt(at)===101||text.charCodeAt(at)===69){at++;if(text.charCodeAt(at)===43||text.charCodeAt(at)===45)at++;if(!digit(text.charCodeAt(at)))return false;while(digit(text.charCodeAt(at)))at++;}
    return true;
  }
  function value(depth){
    whitespace();if(!token()||at>=text.length)return false;
    const code=text.charCodeAt(at);
    if(code===34)return string();
    if(code===123||code===91){
      if(depth>=JSON_CONTEXT_LIMITS.maxContainerDepth){resource=true;return false;}
      const object=code===123,close=object?125:93;at++;whitespace();
      if(text.charCodeAt(at)===close){at++;return true;}
      while(at<text.length){
        if(object){if(!token()||!string())return false;whitespace();if(text.charCodeAt(at++)!==58)return false;}
        if(!value(depth+1))return false;whitespace();
        if(text.charCodeAt(at)===close){at++;return true;}
        if(text.charCodeAt(at++)!==44)return false;whitespace();
      }
      return false;
    }
    for(const literal of ['true','false','null'])if(text.startsWith(literal,at)){at+=literal.length;return true;}
    return number();
  }
  const valid=value(0);whitespace();
  if(!valid||at!==text.length)return unchanged(resource?'UNCHANGED_RESOURCE':'UNCHANGED_INVALID');
  if(!removed)return unchanged('UNCHANGED_VALID');
  if(copyAt<text.length)parts.push(text.slice(copyAt));
  return {text:parts.join(''),changed:true,status:'COMPACTED',removedCodeUnits:removed};
}
