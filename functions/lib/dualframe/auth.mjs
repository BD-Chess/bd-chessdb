import {createHmac,randomBytes,pbkdf2Sync,timingSafeEqual} from 'node:crypto';

export function passwordVerifier(password, salt=randomBytes(24).toString('base64url')) {
  return `pbkdf2-sha256:600000:${salt}:${pbkdf2Sync(password,salt,600000,32,'sha256').toString('base64url')}`;
}
export function checkPassword(password, encoded) {
  if(typeof password!=='string'||password.length>200||typeof encoded!=='string')return false;
  const [kind,rounds,salt,hash]=encoded.split(':');
  if(kind!=='pbkdf2-sha256'||!/^\d+$/.test(rounds)||Number(rounds)<100000||Number(rounds)>1000000||!salt||!hash)return false;
  const actual=pbkdf2Sync(password,salt,Number(rounds),32,'sha256'),expected=Buffer.from(hash,'base64url');
  return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
export function signToken(claims, secret, seconds=30*86400, now=Date.now()) {
  if(!secret||secret.length<32)throw Error('AUTH_NOT_CONFIGURED');
  const body=encode({...claims,aud:'bd.dualframe.v3',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+seconds});
  return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;
}
export function verifyToken(token,secret,scope='session',now=Date.now()) {
  if(typeof token!=='string'||token.length>2500||!secret||secret.length<32)throw Error('UNAUTHORIZED');
  const [body,sig,extra]=token.split('.');
  if(!body||!sig||extra)throw Error('UNAUTHORIZED');
  const expected=createHmac('sha256',secret).update(body).digest(),got=Buffer.from(sig,'base64url');
  if(got.length!==expected.length||!timingSafeEqual(got,expected))throw Error('UNAUTHORIZED');
  let claim;try{claim=JSON.parse(Buffer.from(body,'base64url').toString());}catch{throw Error('UNAUTHORIZED');}
  if(claim.aud!=='bd.dualframe.v3'||claim.scope!==scope||!Number.isInteger(claim.exp)||claim.exp<=Math.floor(now/1000)||!/^[-a-zA-Z0-9_]{8,100}$/.test(claim.owner||''))throw Error('UNAUTHORIZED');
  return claim;
}
export function bearer(req){return req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1]||'';}
