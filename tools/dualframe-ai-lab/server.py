"""Private, invite-only DualFrame gateway and static local runner.

Default: DEMO only, ZERO real provider calls. State is outside the web root.
Single process/owner of SQLite. External hosting requires HTTPS and reviewed
durable storage; do not drop this filesystem server into ephemeral functions.
"""
import argparse
import concurrent.futures
import hashlib
import hmac
import io
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
import urllib.parse
import uuid
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageOps, ImageCms, UnidentifiedImageError
from providers import BriaAdapter, ProviderError

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 24000000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
PUBLIC_ROOT = Path(__file__).resolve().parents[2] / 'public/Nara/dualframe-lab'
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{8,100}$')
SHA_PATTERN = re.compile(r'^[a-f0-9]{64}$')


class GateError(Exception):
    def __init__(self, code, status=400):
        super().__init__(code)
        self.code, self.status = code, status


def digest(data):
    return hashlib.sha256(data).hexdigest()


def image_info(data):
    if not data or len(data) > MAX_BYTES:
        raise GateError('UPLOAD_SIZE_LIMIT', 413)
    mime = 'image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'image/webp' if data[:4] == b'RIFF' and data[8:12] == b'WEBP' else None
    if not mime:
        raise GateError('UNSUPPORTED_OR_CORRUPT', 415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as raw:
                if raw.format not in ('PNG', 'JPEG', 'WEBP') or getattr(raw, 'n_frames', 1) != 1:
                    raise GateError('ANIMATED_OR_UNSUPPORTED_IMAGE', 415)
                w, h = raw.size
                if w * h > MAX_PIXELS or not w or not h:
                    raise GateError('IMAGE_PIXEL_LIMIT', 413)
                raw.verify()
            with Image.open(io.BytesIO(data)) as raw:
                rotated = ImageOps.exif_transpose(raw)
                profile = raw.info.get('icc_profile')
                if profile:
                    try:
                        rotated = ImageCms.profileToProfile(rotated, ImageCms.ImageCmsProfile(io.BytesIO(profile)), ImageCms.createProfile('sRGB'), outputMode='RGB')
                    except (ImageCms.PyCMSError, OSError):
                        raise GateError('INVALID_COLOR_PROFILE') from None
                source = rotated.convert('RGBA')
                source.load()
        # Remove EXIF, GPS, ICC and textual metadata from derived delivery PNG.
        clean = Image.frombytes('RGBA', source.size, source.tobytes())
        output = io.BytesIO()
        clean.save(output, format='PNG')
        return clean, output.getvalue(), mime
    except GateError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise GateError('UNSUPPORTED_OR_CORRUPT', 415) from None


def geometry(w, h, target, position='center'):
    if target not in ('portrait', 'landscape') or position not in ('center', 'left', 'right', 'top', 'bottom'):
        raise GateError('INVALID_GEOMETRY')
    a, b = (16, 9) if target == 'landscape' else (9, 16)
    unit = max(math.ceil(w / a), math.ceil(h / b), 120)
    width, height = a * unit, b * unit
    if width * height > MAX_PIXELS:
        raise GateError('CANVAS_PIXEL_LIMIT', 413)
    x = 0 if position == 'left' else width-w if position == 'right' else (width-w)//2
    y = 0 if position == 'top' else height-h if position == 'bottom' else (height-h)//2
    return dict(width=width, height=height, x=x, y=y, source_width=w, source_height=h, scale=1, no_crop=True)


def protect_original(result, source, p):
    if result.size != (p['width'], p['height']):
        raise ProviderError('PROVIDER_CANVAS_MISMATCH')
    result = result.convert('RGBA')
    result.paste(source, (p['x'], p['y']))  # No alpha blending or resampling.
    region = result.crop((p['x'], p['y'], p['x']+source.width, p['y']+source.height))
    if region.tobytes() != source.tobytes():
        raise ProviderError('PIXEL_PROTECTION_FAILED')
    return result


class Config:
    def __init__(self, data_dir=None, tokens=None, env=None):
        env = os.environ if env is None else env
        self.data_dir = Path(data_dir or env.get('DUALFRAME_DATA_DIR', str(Path.home()/'.local/share/dualframe-lab'))).resolve()
        if PUBLIC_ROOT.resolve() in self.data_dir.parents or self.data_dir == PUBLIC_ROOT.resolve():
            raise ValueError('DATA_DIR_MUST_BE_OUTSIDE_WEB_ROOT')
        self.tokens = tokens or tuple(x for x in env.get('DUALFRAME_INVITE_TOKENS', '').split(',') if len(x) >= 24)
        if any(len(x) < 24 for x in self.tokens):
            raise ValueError('INVITE_TOKEN_TOO_SHORT')
        self.origins = tuple(x.strip() for x in env.get('DUALFRAME_ALLOWED_ORIGINS', 'http://127.0.0.1:8765,http://localhost:8765,https://bd-chess.github.io').split(',') if x.strip())
        self.bria_token = env.get('BRIA_API_TOKEN', '')
        self.asset_hosts = tuple(x.strip() for x in env.get('BRIA_ASSET_HOSTS', '').split(',') if x.strip())
        self.live_requested = env.get('DUALFRAME_LIVE_ENABLED') == '1'
        self.free_verified = env.get('DUALFRAME_FREE_ENTITLEMENT_VERIFIED') == '1'
        self.retention_reviewed = env.get('DUALFRAME_RETENTION_REVIEWED') == '1'
        self.free_cap = min(1, max(0, int(env.get('DUALFRAME_VERIFIED_FREE_REQUESTS', '0'))))
        self.ttl = max(60, min(86400, int(env.get('DUALFRAME_TTL_SECONDS', '86400'))))
        self.max_storage = 160 * 1024 * 1024

    def live_gate(self):
        return bool(self.live_requested and self.free_verified and self.retention_reviewed and self.free_cap and self.bria_token and self.asset_hosts and self.tokens)


class Engine:
    def __init__(self, config, adapter=None):
        self.config = config
        self.root = config.data_dir
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.root/'state.sqlite3', check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS pairs (id TEXT PRIMARY KEY, owner TEXT, original_sha TEXT, created REAL, data TEXT, UNIQUE(owner,original_sha))')
        self.db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT, pair_id TEXT, token TEXT, created REAL, data TEXT, UNIQUE(owner,token))')
        self.db.execute('CREATE TABLE IF NOT EXISTS usage (name TEXT PRIMARY KEY, n INTEGER)')
        self.db.execute('CREATE TABLE IF NOT EXISTS comparisons (id TEXT PRIMARY KEY, owner TEXT, pair_id TEXT, data TEXT)')
        self.db.commit()
        os.chmod(self.root/'state.sqlite3', 0o600)
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self.adapter = adapter or BriaAdapter(config.bria_token, config.asset_hosts)
        self.rates = {}
        self.last_purge = 0
        # Never repeat an uncertain external request following a process crash.
        with self.lock:
            for row in self.db.execute('SELECT id,data FROM jobs').fetchall():
                j = json.loads(row[1])
                if j['status'] in ('PENDING', 'RUNNING'):
                    j.update(status='HELD', error='INTERRUPTED_REQUIRES_OPERATOR_RECONCILIATION')
                    self._save_job(j)
        self.purge()

    def close(self):
        self.pool.shutdown(wait=True)
        self.db.close()

    def auth(self, token):
        if not isinstance(token, str):
            raise GateError('UNAUTHORIZED', 401)
        for invite in self.config.tokens:
            if hmac.compare_digest(token, invite):
                return digest(invite.encode())[:32]
        raise GateError('UNAUTHORIZED', 401)

    def rate(self, owner):
        with self.lock:
            now=time.time(); recent=[t for t in self.rates.get(owner, []) if now-t<60]
            if len(recent)>=120:
                raise GateError('RATE_LIMIT', 429)
            recent.append(now); self.rates[owner]=recent

    def _save_job(self, job):
        self.db.execute('UPDATE jobs SET data=? WHERE id=?', (json.dumps(job), job['job_id']))
        self.db.commit()

    def _get_pair(self, owner, pair_id):
        row=self.db.execute('SELECT data FROM pairs WHERE id=? AND owner=?', (pair_id, owner)).fetchone()
        if not row:
            raise GateError('NOT_FOUND', 404)
        return json.loads(row[0])

    def pair(self, owner, pair_id):
        with self.lock:
            return self._get_pair(owner, pair_id)

    def pairs(self, owner):
        with self.lock:
            return [json.loads(r[0]) for r in self.db.execute('SELECT data FROM pairs WHERE owner=? ORDER BY created', (owner,))]

    def upload(self, owner, data):
        source, png, mime=image_info(data)
        hash_=digest(data)
        with self.lock:
            existing=self.db.execute('SELECT data FROM pairs WHERE owner=? AND original_sha=?', (owner, hash_)).fetchone()
            if existing:
                return json.loads(existing[0])
            items=self.pairs(owner)
            if len(items)>=20:
                raise GateError('PAIR_LIMIT', 429)
            if sum(p['original']['bytes']+p['original']['normalized_bytes'] for p in items)+len(data)+len(png)>self.config.max_storage:
                raise GateError('STORAGE_LIMIT', 413)
            id_='df_'+uuid.uuid4().hex
            pair={'schema':'bd.dualframe.pair.v1','pair_id':id_,'created_at':time.time(),'original':{'sha256':hash_,'filename':'original.'+mime.split('/')[1],'mime':mime,'width':source.width,'height':source.height,'source_orientation':'portrait' if source.height>source.width else 'landscape','visibility':'private','bytes':len(data),'normalized_bytes':len(png),'normalized_sha256':digest(png),'path':f'/api/assets/{id_}_original'},'variants':{'portrait':{},'landscape':{}},'jobs':[],'references':[]}
            pair['variants'][pair['original']['source_orientation']]['hd']={'path':f'/api/assets/{id_}_normalized','sha256':digest(png),'width':source.width,'height':source.height,'origin':'original','resolution_verified':False,'resolution_origin':'normalized-original'}
            for suffix,content in [('original',data),('normalized',png)]:
                path=self.root/f'{id_}_{suffix}'
                path.write_bytes(content);os.chmod(path,0o600)
            self.db.execute('INSERT INTO pairs VALUES (?,?,?,?,?)',(id_,owner,hash_,time.time(),json.dumps(pair)));self.db.commit()
            return pair

    def job(self, owner, id_, private=False):
        with self.lock:
            row=self.db.execute('SELECT data FROM jobs WHERE id=? AND owner=?',(id_,owner)).fetchone()
            if not row:
                raise GateError('NOT_FOUND',404)
            data=json.loads(row[0])
            if not private:
                data.pop('status_url',None)
            return data

    def expand(self, owner, request):
        allowed={'pair_id','input_sha256','target','mode','position','prompt','seed','consent','provider','idempotency_key'}
        if not isinstance(request,dict) or set(request)-allowed:
            raise GateError('INVALID_REQUEST')
        token=request.get('idempotency_key','')
        if not isinstance(token,str) or not SHA_PATTERN.fullmatch(token):
            raise GateError('IDEMPOTENCY_REQUIRED')
        fingerprint=digest(json.dumps(request,sort_keys=True,separators=(',',':')).encode())
        with self.lock:
            existing=self.db.execute('SELECT data FROM jobs WHERE owner=? AND token=?',(owner,token)).fetchone()
            if existing:
                j=json.loads(existing[0])
                if j['request_fingerprint']!=fingerprint:
                    raise GateError('IDEMPOTENCY_CONFLICT',409)
                j.pop('status_url',None)
                return j
            pair=self._get_pair(owner,request.get('pair_id'))
            original=pair['original']
            if request.get('input_sha256')!=original['sha256']:
                raise GateError('INPUT_HASH_MISMATCH')
            target='landscape' if original['source_orientation']=='portrait' else 'portrait'
            if request.get('target')!=target or request.get('mode') not in ('faithful','cinematic'):
                raise GateError('INVALID_TARGET_OR_MODE')
            prompt=request.get('prompt','')
            if not isinstance(prompt,str) or len(prompt)>800 or any(ord(c)<32 and c not in '\n\t' for c in prompt):
                raise GateError('INVALID_PROMPT')
            seed=request.get('seed')
            if type(seed) is not int or not 0<=seed<=2147483647:
                raise GateError('INVALID_SEED')
            provider=request.get('provider','demo')
            if provider not in ('demo','bria'):
                raise GateError('INVALID_PROVIDER')
            if provider=='bria' and request.get('consent') is not True:
                raise GateError('EXTERNAL_CONSENT_REQUIRED',403)
            hour_count=self.db.execute('SELECT COUNT(*) FROM jobs WHERE owner=? AND created>?',(owner,time.time()-3600)).fetchone()[0]
            total_count=self.db.execute('SELECT COUNT(*) FROM jobs WHERE owner=?',(owner,)).fetchone()[0]
            if hour_count>=6 or total_count>=40:
                raise GateError('JOB_CAP',429)
            placement=geometry(original['width'],original['height'],target,request.get('position','center'))
            id_='job_'+uuid.uuid4().hex
            job={**request,'job_id':id_,'request_fingerprint':fingerprint,'status':'PENDING','created_at':time.time(),'target_ratio':'16:9' if target=='landscape' else '9:16','source_placement':placement,'provider_request_id':None,'provider_cost':0 if provider=='demo' else None,'generation_attempts':0,'upload_consent':{'external':provider=='bria','provider':provider,'at':time.time()}}
            if provider=='bria':
                used=self.db.execute("SELECT n FROM usage WHERE name='bria_free'").fetchone()
                if not self.config.live_gate() or (used and used[0]>=self.config.free_cap):
                    job.update(status='HELD',error='LIVE_PROVIDER_HELD')
                else:
                    self.db.execute("INSERT INTO usage VALUES ('bria_free',1) ON CONFLICT(name) DO UPDATE SET n=n+1")
                    job['budget_basis']='operator-verified-free-entitlement-one-request'
            self.db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?)',(id_,owner,pair['pair_id'],token,time.time(),json.dumps(job)));self.db.commit()
            if job['status']=='PENDING':
                self.pool.submit(self.run_job,owner,id_)
            return job

    def cancelled(self,owner,id_):
        try:
            return self.job(owner,id_,True)['status']=='CANCELLED'
        except GateError:
            return True

    def run_job(self,owner,id_):
        started=time.monotonic()
        try:
            with self.lock:
                job=self.job(owner,id_,True)
                if job['status']!='PENDING':
                    return
                job.update(status='RUNNING',generation_attempts=1);self._save_job(job)
                pair=self._get_pair(owner,job['pair_id']);png=(self.root/f"{pair['pair_id']}_normalized").read_bytes()
            source=Image.open(io.BytesIO(png)).convert('RGBA');p=job['source_placement']
            if job['provider']=='demo':
                result=Image.new('RGBA',(p['width'],p['height']),(31,54,62,255))
                result=protect_original(result,source,p)
                receipt={'provider_request_id':id_,'model_or_version':'deterministic-pillow-v1','provider_cost':0,'cost_currency':'EUR','origin':'demo'}
            else:
                def on_submit(receipt):
                    with self.lock:
                        latest=self.job(owner,id_,True)
                        if latest['status']=='CANCELLED':
                            raise ProviderError('CANCELLED')
                        latest.update(provider_request_id=receipt.get('request_id'),status_url=receipt.get('status_url'));self._save_job(latest)
                data,receipt=self.adapter.expand(png,job,p,lambda:self.cancelled(owner,id_),on_submit)
                if len(data)>32*1024*1024:
                    raise ProviderError('PROVIDER_RESPONSE_LIMIT')
                with Image.open(io.BytesIO(data)) as raw:
                    if raw.size!=(p['width'],p['height']) or raw.width*raw.height>MAX_PIXELS:
                        raise ProviderError('PROVIDER_CANVAS_MISMATCH')
                    result=raw.convert('RGBA')
                if job['mode']=='faithful':
                    result=protect_original(result,source,p)
                receipt['origin']='generated'
            output=io.BytesIO();Image.frombytes('RGBA',result.size,result.tobytes()).save(output,format='PNG');bytes_=output.getvalue();asset=id_+'_output'
            with self.lock:
                latest=self.job(owner,id_,True)
                if latest['status']=='CANCELLED':
                    return
                self._get_pair(owner,job['pair_id'])
                storage_used=sum(f.stat().st_size for f in self.root.glob('*') if f.is_file())
                if storage_used+len(bytes_)>self.config.max_storage*max(1,len(self.config.tokens)):
                    raise GateError('STORAGE_LIMIT',413)
                path=self.root/asset;path.write_bytes(bytes_);os.chmod(path,0o600)
                latest.update(**receipt,status='READY',latency_ms=round((time.monotonic()-started)*1000),output={'asset_id':asset,'path':f'/api/assets/{asset}','sha256':digest(bytes_),'width':p['width'],'height':p['height'],'origin':receipt['origin'],'provider':job['provider'],'model_or_version':receipt['model_or_version'],'resolution_verified':False,'resolution_origin':'provider-native' if job['provider']=='bria' else 'simulation','source_placement':p if job['mode']=='faithful' or job['provider']=='demo' else None,'source_pixel_protection':'normalized-sRGB-RGBA-overwrite' if job['mode']=='faithful' or job['provider']=='demo' else 'NONE'})
                self._save_job(latest)
        except (ProviderError,GateError,ValueError,OSError,Image.DecompressionBombError) as e:
            with self.lock:
                try:
                    latest=self.job(owner,id_,True)
                except GateError:
                    return
                if latest['status']=='CANCELLED':
                    return
                code=getattr(e,'code','PROVIDER_INVALID_IMAGE')
                latest.update(status='HELD' if code=='PROVIDER_PENDING_TIMEOUT' else 'CANCELLED' if code=='CANCELLED' else 'FAILED',error=code)
                self._save_job(latest)

    def cancel(self,owner,id_):
        with self.lock:
            job=self.job(owner,id_,True)
            if job['status'] in ('PENDING','RUNNING','HELD'):
                job.update(status='CANCELLED',error=None);self._save_job(job)
            # Once submitted, upstream generation may finish and use its credit.
            return {'job_id':id_,'status':job['status'],'upstream_cancel_guaranteed':False}

    def accept(self,owner,id_):
        with self.lock:
            job=self.job(owner,id_,True)
            if job['status'] not in ('READY','ACCEPTED'):
                raise GateError('JOB_NOT_READY',409)
            pair=self._get_pair(owner,job['pair_id']);asset={**job['output'],'sha256':job['output']['sha256']}
            pair['variants'][job['target']]['hd']=asset
            if not any(record['job_id']==id_ for record in pair['jobs']):
                pair['jobs'].append({k:v for k,v in {**job,'status':'ACCEPTED'}.items() if k!='status_url'})
            self.db.execute('UPDATE pairs SET data=? WHERE id=?',(json.dumps(pair),pair['pair_id']));job['status']='ACCEPTED';self._save_job(job)
            return pair

    def asset(self,owner,id_):
        if not isinstance(id_,str) or not ID_PATTERN.fullmatch(id_):
            raise GateError('NOT_FOUND',404)
        with self.lock:
            if id_.endswith('_original') or id_.endswith('_normalized'):
                pair_id=id_.rsplit('_',1)[0];p=self._get_pair(owner,pair_id);mime=p['original']['mime'] if id_.endswith('_original') else 'image/png'
            elif id_.endswith('_output'):
                j=self.job(owner,id_[:-7],True)
                if j['status'] not in ('READY','ACCEPTED'):
                    raise GateError('NOT_FOUND',404)
                mime='image/png'
            else:
                raise GateError('NOT_FOUND',404)
            path=self.root/id_
            if not path.is_file():
                raise GateError('NOT_FOUND',404)
            return path.read_bytes(),mime

    def delete(self,owner,id_):
        with self.lock:
            self._get_pair(owner,id_)
            jobs=self.db.execute('SELECT id FROM jobs WHERE pair_id=? AND owner=?',(id_,owner)).fetchall()
            for row in jobs:
                (self.root/f'{row[0]}_output').unlink(missing_ok=True)
            for suffix in ('original','normalized'):
                (self.root/f'{id_}_{suffix}').unlink(missing_ok=True)
            self.db.execute('DELETE FROM jobs WHERE pair_id=? AND owner=?',(id_,owner));self.db.execute('DELETE FROM comparisons WHERE pair_id=? AND owner=?',(id_,owner));self.db.execute('DELETE FROM pairs WHERE id=? AND owner=?',(id_,owner));self.db.commit()
            return {'deleted':id_,'local_private_bytes_removed':True,'provider_deletion':'NOT_GUARANTEED; organization retention applies','backups_and_browser_copies_removed':False}

    def purge(self):
        with self.lock:
            self.last_purge=time.time()
            expired=self.db.execute('SELECT id,owner FROM pairs WHERE created<?',(time.time()-self.config.ttl,)).fetchall()
            for id_,owner in expired:
                self.delete(owner,id_)
            return len(expired)

    def compare(self,owner,data):
        if not isinstance(data,dict) or len(json.dumps(data))>20000 or not SHA_PATTERN.fullmatch(str(data.get('comparison_id',''))):
            raise GateError('INVALID_COMPARISON')
        with self.lock:
            pair=self._get_pair(owner,data.get('pair_id'))
            if data.get('original_sha256')!=pair['original']['sha256']:
                raise GateError('INPUT_HASH_MISMATCH')
            # The gateway never trusts a browser's aggregate eligibility flag.
            data={**data,'server_eligibility':'NOT_INDEPENDENTLY_VERIFIED','server_controlled_aggregate':False}
            try:
                self.db.execute('INSERT INTO comparisons VALUES (?,?,?,?)',(data['comparison_id'],owner,pair['pair_id'],json.dumps(data)));self.db.commit()
            except sqlite3.IntegrityError:
                raise GateError('SCORE_LOCKED',409) from None
            return {'comparison_id':data['comparison_id'],'locked':True,'controlled_aggregate':False}


class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,engine):
        self.engine=engine
        self.semaphore=threading.BoundedSemaphore(12)
        super().__init__(address,Handler)

    def process_request(self,request,client_address):
        if not self.semaphore.acquire(blocking=False):
            self.shutdown_request(request)
            return
        super().process_request(request,client_address)

    def process_request_thread(self,*args):
        try:
            super().process_request_thread(*args)
        finally:
            self.semaphore.release()


class Handler(BaseHTTPRequestHandler):
    server_version='DualFrame/1'
    sys_version=''
    def log_message(self,*args):
        pass  # Request URLs, prompts, filenames and tokens are never logged.

    def response(self,status,value,mime='application/json'):
        content=value if isinstance(value,bytes) else json.dumps(value).encode()
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(content)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' https: http://localhost:8765 http://127.0.0.1:8765; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'")
        origin=self.headers.get('Origin')
        if origin in self.server.engine.config.origins:
            self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin');self.send_header('Access-Control-Allow-Headers','Authorization,Content-Type');self.send_header('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS')
        self.end_headers()
        try:
            self.wfile.write(content)
        except (BrokenPipeError,ConnectionResetError):
            pass

    def handle_api(self):
        self.connection.settimeout(15)
        e=self.server.engine;path=urllib.parse.urlsplit(self.path).path
        try:
            origin=self.headers.get('Origin')
            if origin and origin not in e.config.origins:
                raise GateError('ORIGIN_DENIED',403)
            if time.time()-e.last_purge>30:
                e.purge()
            if self.command=='OPTIONS':
                if not origin:
                    raise GateError('ORIGIN_REQUIRED',403)
                self.response(204,b'','text/plain');return
            if path=='/api/health' and self.command=='GET':
                self.response(200,{'status':'OK','provider_status':'HELD_BY_DEFAULT','version':'1.0'});return
            auth=self.headers.get('Authorization','')
            owner=e.auth(auth[7:] if auth.startswith('Bearer ') else '');e.rate(owner)
            if self.command=='GET' and path=='/api/capabilities':
                self.response(200,{'live_enabled':e.config.live_gate(),'provider':'bria','max_free_requests':e.config.free_cap,'ttl_seconds':e.config.ttl,'private':True});return
            if self.command=='GET' and path=='/api/pairs':
                self.response(200,{'pairs':e.pairs(owner)});return
            if self.command=='GET' and path.startswith('/api/jobs/'):
                self.response(200,e.job(owner,path.split('/')[-1]));return
            if self.command=='GET' and path.startswith('/api/assets/'):
                data,mime=e.asset(owner,path.split('/')[-1]);self.response(200,data,mime);return
            if self.command=='GET' and path.startswith('/api/pairs/'):
                self.response(200,e.pair(owner,path.split('/')[-1]));return
            if self.command=='DELETE' and path.startswith('/api/pairs/'):
                self.response(200,e.delete(owner,path.split('/')[-1]));return
            if self.command!='POST':
                raise GateError('NOT_FOUND',404)
            if self.headers.get('Transfer-Encoding'):
                raise GateError('TRANSFER_ENCODING_DENIED')
            try:
                size=int(self.headers.get('Content-Length','0'))
            except ValueError:
                raise GateError('INVALID_LENGTH') from None
            limit=MAX_BYTES if path=='/api/uploads' else 24000
            if size<=0 or size>limit:
                raise GateError('UPLOAD_SIZE_LIMIT',413)
            body=self.rfile.read(size)
            if len(body)!=size:
                raise GateError('TRUNCATED_BODY')
            if path=='/api/uploads':
                if self.headers.get('Content-Type','').split(';')[0] not in ('image/png','image/jpeg','image/webp'):
                    raise GateError('CONTENT_TYPE_DENIED',415)
                _,_,sniffed_mime=image_info(body)
                if sniffed_mime!=self.headers.get('Content-Type','').split(';')[0]:
                    raise GateError('MIME_MISMATCH',415)
                p=e.upload(owner,body)
                self.response(201,p);return
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':
                raise GateError('CONTENT_TYPE_DENIED',415)
            request=json.loads(body)
            if path=='/api/expand':
                self.response(202,e.expand(owner,request));return
            if path.endswith('/cancel') and path.startswith('/api/jobs/'):
                self.response(200,e.cancel(owner,path.split('/')[-2]));return
            if path.endswith('/accept') and path.startswith('/api/jobs/'):
                self.response(200,e.accept(owner,path.split('/')[-2]));return
            if path=='/api/compare':
                self.response(201,e.compare(owner,request));return
            raise GateError('NOT_FOUND',404)
        except GateError as err:
            self.response(err.status,{'error':err.code})
        except (json.JSONDecodeError,UnicodeDecodeError):
            self.response(400,{'error':'INVALID_JSON'})
        except (TimeoutError,OSError):
            self.response(408,{'error':'REQUEST_TIMEOUT'})
        except Exception:
            self.response(500,{'error':'INTERNAL_ERROR'})

    def do_GET(self):
        if urllib.parse.urlsplit(self.path).path.startswith('/api/'):
            return self.handle_api()
        path=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).lstrip('/') or 'index.html'
        if not re.fullmatch(r'[a-zA-Z0-9_.\-/]+',path) or any(part.startswith('.') for part in path.split('/')):
            return self.response(404,{'error':'NOT_FOUND'})
        target=(PUBLIC_ROOT/path).resolve()
        if PUBLIC_ROOT not in target.parents or not target.is_file():
            return self.response(404,{'error':'NOT_FOUND'})
        mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'}.get(target.suffix)
        if not mime:
            return self.response(404,{'error':'NOT_FOUND'})
        self.response(200,target.read_bytes(),mime)

    do_POST=handle_api
    do_DELETE=handle_api
    do_OPTIONS=handle_api


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--bind',default='127.0.0.1');parser.add_argument('--port',type=int,default=8765);args=parser.parse_args()
    config=Config();engine=Engine(config);server=Server((args.bind,args.port),engine)
    print(f'DualFrame local runner: http://{args.bind}:{server.server_port}/ · LIVE_PROVIDER_HELD={not config.live_gate()} · invite configured={bool(config.tokens)}',flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close();engine.close()


if __name__=='__main__':
    main()
