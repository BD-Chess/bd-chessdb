"""Bria v2 outpainting contract. No generation retries; bounded status polling.

Real account/model/usage verification is still required. The adapter version is
an API contract identifier, not a claim about Bria's undisclosed model weights.
"""
import base64
import ipaddress
import json
import math
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

BRIA_ENDPOINT = 'https://engine.prod.bria-api.com/v2/image/edit/expand'
MAX_RESPONSE = 32 * 1024 * 1024


class ProviderError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ProviderError('PROVIDER_REDIRECT_DENIED')


def validate_remote_url(url, allowed_hosts, resolve=True):
    # Provider convenience URLs are untrusted JSON, not necessarily strings.
    # Reject malformed values before urlsplit can escape via AttributeError.
    if not isinstance(url, str) or not url or len(url) > 8192:
        raise ProviderError('PROVIDER_URL_DENIED')
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
            raise ValueError()
        if parsed.hostname not in allowed_hosts:
            raise ValueError()
        if resolve:
            addresses = socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM)
            if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
                raise ValueError()
        return url
    except (ValueError, OSError):
        raise ProviderError('PROVIDER_URL_DENIED') from None


def parse_response(status, payload):
    if status == 429:
        raise ProviderError('PROVIDER_RATE_LIMIT')
    if not isinstance(payload, dict):
        raise ProviderError('PROVIDER_INVALID_RESPONSE')
    if status in (420, 423):
        return {'state': 'pending', 'request_id': payload.get('request_id'), 'status_url': payload.get('status_url')}
    if status not in (200, 202):
        raise ProviderError('PROVIDER_HTTP_ERROR')
    result = payload.get('result') or {}
    if not isinstance(result, dict):
        raise ProviderError('PROVIDER_INVALID_RESPONSE')
    state = str(payload.get('status', payload.get('state', ''))).upper()
    if state in ('ERROR', 'FAILED', 'FAILURE', 'CANCELLED'):
        raise ProviderError('PROVIDER_FAILED')
    url = result.get('image_url') or payload.get('image_url')
    if url:
        if not isinstance(url, str) or not payload.get('request_id'):
            raise ProviderError('PROVIDER_INVALID_RESPONSE')
        return {'state': 'ready', 'image_url': url, 'request_id': str(payload['request_id']), 'seed': result.get('seed'), 'provider_prompt': result.get('prompt')}
    if status == 202 or state in ('PENDING', 'IN_PROGRESS', 'RUNNING', 'PROCESSING', 'QUEUED', 'IN_QUEUE') or payload.get('status_url'):
        return {'state': 'pending', 'request_id': payload.get('request_id'), 'status_url': payload.get('status_url')}
    raise ProviderError('PROVIDER_INVALID_RESPONSE')


def bria_payload(png, job, placement):
    if not isinstance(job.get('prompt', ''), str) or not job.get('prompt', '').isascii():
        raise ProviderError('BRIA_ENGLISH_ASCII_PROMPT_REQUIRED')
    p = placement
    body = {'image': base64.b64encode(png).decode('ascii'), 'canvas_size': [p['width'], p['height']],
            'original_image_size': [p['source_width'], p['source_height']], 'original_image_location': [p['x'], p['y']],
            'seed': job['seed'], 'sync': False, 'preserve_alpha': True,
            'prompt_content_moderation': True, 'visual_input_content_moderation': True,
            'visual_output_content_moderation': True}
    # aspect_ratio is deliberately omitted: its documented crop/resize behavior
    # cannot guarantee an unchanged source rectangle.
    if job.get('prompt'):
        body['prompt'] = job['prompt']
    if job.get('parameters',{}).get('negative_prompt'):
        body['negative_prompt']=job['parameters']['negative_prompt']
    return body


class BriaAdapter:
    version = 'bria-expand-v2-contract-20261013'

    def __init__(self, token, asset_hosts=(), transport=None, timeout=20, polls=8, interval=2):
        self.token = token
        self.asset_hosts = tuple(asset_hosts)
        self.timeout = timeout
        self.polls = min(polls, 12)
        self.interval = min(interval, 5)
        self.transport = transport or self._request

    def _request(self, method, url, body=None, auth=True):
        hosts = ('engine.prod.bria-api.com',) if auth else self.asset_hosts
        validate_remote_url(url, hosts)
        headers = {'Accept': 'application/json' if auth else 'image/png,image/jpeg,image/webp'}
        if auth:
            headers['api_token'] = self.token
        if body is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            response = urllib.request.build_opener(NoRedirect()).open(req, timeout=self.timeout)
            with response:
                data = response.read(MAX_RESPONSE + 1)
                if len(data) > MAX_RESPONSE:
                    raise ProviderError('PROVIDER_RESPONSE_LIMIT')
                return response.status, json.loads(data) if auth else data
        except urllib.error.HTTPError as e:
            # No provider response body or signed URL is leaked into logs.
            if e.code == 429:
                raise ProviderError('PROVIDER_RATE_LIMIT') from None
            if e.code in (420, 423):
                return e.code, {'status': 'PENDING'}
            raise ProviderError('PROVIDER_HTTP_ERROR') from None
        except (TimeoutError, socket.timeout, urllib.error.URLError):
            raise ProviderError('PROVIDER_TIMEOUT') from None
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ProviderError('PROVIDER_INVALID_RESPONSE') from None

    def expand(self, png, job, placement, cancelled=lambda: False, on_submit=lambda receipt: None):
        if cancelled():
            raise ProviderError('CANCELLED')
        status, payload = self.transport('POST', BRIA_ENDPOINT, bria_payload(png, job, placement), True)
        state = parse_response(status, payload)
        on_submit({k: state.get(k) for k in ('request_id', 'status_url')})
        for attempt in range(self.polls + 1):
            if cancelled():
                raise ProviderError('CANCELLED')
            if state['state'] == 'ready':
                validate_remote_url(state['image_url'], self.asset_hosts, resolve=False)
                require_short_signed_asset(state['image_url'])
                status, image = self.transport('GET', state['image_url'], None, False)
                if status != 200 or not isinstance(image, bytes) or not image or len(image) > MAX_RESPONSE:
                    raise ProviderError('PROVIDER_INVALID_IMAGE')
                return image, {'provider_request_id': state['request_id'], 'provider_seed': state.get('seed'),
                               'model_or_version': self.version, 'provider_model_id': 'NOT_EXPOSED',
                               'provider_cost': None, 'provider_usage': 'NOT_EXPOSED_BY_RESPONSE','provider_parameters':{k:v for k,v in bria_payload(png,job,placement).items() if k!='image'}}
            if attempt == self.polls:
                raise ProviderError('PROVIDER_PENDING_TIMEOUT')
            url = state.get('status_url')
            if not url:
                raise ProviderError('PROVIDER_INVALID_RESPONSE')
            validate_remote_url(url, ('engine.prod.bria-api.com',), resolve=False)
            time.sleep(self.interval)
            status, payload = self.transport('GET', url, None, True)
            # A polling result may omit request_id; retain the submission identity.
            if state.get('request_id') and isinstance(payload, dict):
                payload.setdefault('request_id', state['request_id'])
            new_state = parse_response(status, payload)
            if not new_state.get('status_url'):
                new_state['status_url'] = url
            state = new_state
        raise ProviderError('PROVIDER_PENDING_TIMEOUT')



    def resume(self,job,placement,cancelled=lambda:False):
        request_id=job.get('provider_request_id');url=job.get('status_url')
        if not request_id or not url:
            raise ProviderError('PROVIDER_INVALID_RESPONSE')
        validate_remote_url(url,('engine.prod.bria-api.com',),resolve=False)
        for attempt in range(self.polls+1):
            if cancelled():
                raise ProviderError('CANCELLED')
            status,payload=self.transport('GET',url,None,True)
            if isinstance(payload,dict):
                payload.setdefault('request_id',request_id)
            state=parse_response(status,payload)
            if state['state']=='ready':
                validate_remote_url(state['image_url'],self.asset_hosts,resolve=False)
                require_short_signed_asset(state['image_url'])
                status,data=self.transport('GET',state['image_url'],None,False)
                if status!=200 or not isinstance(data,bytes) or not data or len(data)>MAX_RESPONSE:
                    raise ProviderError('PROVIDER_INVALID_IMAGE')
                return data,{'provider_request_id':request_id,'model_or_version':self.version,'provider_model_id':'NOT_EXPOSED','provider_cost':None,'provider_usage':'NOT_EXPOSED_BY_RESPONSE','provider_parameters':{k:v for k,v in bria_payload(b'',job,placement).items() if k!='image'}}
            if attempt==self.polls:
                raise ProviderError('PROVIDER_PENDING_TIMEOUT')
            time.sleep(self.interval)
        raise ProviderError('PROVIDER_PENDING_TIMEOUT')


def require_short_signed_asset(url):
    query=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    # A bearer URL is accepted only with an explicit short-lived signature.
    if query.get('X-Amz-Signature') and query.get('X-Amz-Credential'):
        try:
            expiry=int(query.get('X-Amz-Expires',['0'])[0])
            if 0<expiry<=3600 and query.get('X-Amz-Date'):
                return True
        except (TypeError,ValueError):
            pass
    raise ProviderError('PROVIDER_PRIVATE_ASSET_HELD')


FAL_MODELS = {
    'fal-bria': {'endpoint_id': 'fal-ai/bria/expand', 'queue_id': 'fal-ai/bria', 'modes': ['faithful', 'smart']},
    'fal-sunburst': {'endpoint_id': 'openai/gpt-image-2.5/sunburst/edit', 'queue_id': 'openai/gpt-image-2.5', 'modes': ['faithful', 'smart', 'infographic']},
    'fal-nano': {'endpoint_id': 'google/nano-banana-2.1/edit', 'queue_id': 'google/nano-banana-2.1', 'modes': ['faithful', 'smart', 'infographic']},
}
FAL_PRIVACY_HEADERS = {
    'X-Fal-Store-IO': '0',
    'X-Fal-No-Retry': '1',
    'x-app-fal-disable-fallback': 'true',
    'X-Fal-Object-Lifecycle-Preference': json.dumps({'expiration_duration_seconds': 3600, 'initial_acl': {'default': 'forbid', 'rules': []}}, separators=(',', ':')),
}

def fal_payload(png, job, placement):
    model = job.get('model')
    spec = FAL_MODELS.get(model)
    if not spec or job.get('mode', 'faithful') not in spec['modes']:
        raise ProviderError('MODEL_MODE_UNSUPPORTED')
    params = job.get('parameters') or {}
    image = 'data:image/png;base64,' + base64.b64encode(png).decode('ascii')
    if model == 'fal-bria':
        direct = bria_payload(png, job, placement)
        body = {k: direct[k] for k in ('canvas_size', 'original_image_size', 'original_image_location', 'seed')}
        body.update(image_url=image, sync_mode=False)
        if job.get('prompt'):
            body['prompt'] = job['prompt']
        if params.get('negative_prompt'):
            body['negative_prompt'] = params['negative_prompt']
    else:
        instruction = {
            'faithful': 'Expand the scene into the target aspect ratio. Preserve the original subject, continue the background coherently, and avoid cropping. The gateway will restore the protected original rectangle exactly.',
            'smart': 'Recompose this image for the target aspect ratio, preserving the main subject and scene identity. Creative changes are allowed and will be disclosed.',
            'infographic': 'Recompose as a readable infographic or text layout in the target aspect ratio. Preserve intended wording and meaning; do not invent data. Creative changes are allowed and will be disclosed.',
        }[job['mode']]
        prompt = instruction + ' Target: ' + ('16:9 landscape.' if job['target'] == 'landscape' else '9:16 portrait.')
        if job.get('prompt'):
            prompt += '\n' + job['prompt']
        body = {'prompt': prompt, 'image_urls': [image], 'num_images': 1, 'output_format': 'png', 'sync_mode': False}
        if model == 'fal-sunburst':
            body.update(image_size={'width': placement['width'], 'height': placement['height']}, quality=params.get('quality', 'high'), background=params.get('background', 'auto'), enable_safety_checker=True)
        else:
            body.update(aspect_ratio='16:9' if job['target'] == 'landscape' else '9:16', resolution='4K' if job['quality'] == '4k' else '2K', seed=job['seed'], thinking_level=params.get('thinking_level', 'medium'), limit_generations=True, enable_web_search=False, safety_tolerance='4')
    return body


def fal_state(status, payload, request_id=None):
    if status == 429:
        raise ProviderError('PROVIDER_RATE_LIMIT')
    if status not in (200, 201, 202) or not isinstance(payload, dict):
        raise ProviderError('PROVIDER_INVALID_RESPONSE')
    state = str(payload.get('status', '')).upper()
    request_id = payload.get('request_id') or request_id
    if not isinstance(request_id, str) or not request_id or len(request_id) > 128 or not all(c.isalnum() or c in '_-' for c in request_id):
        raise ProviderError('PROVIDER_INVALID_RESPONSE')
    if state in ('FAILED', 'ERROR', 'CANCELLED') or payload.get('error'):
        raise ProviderError('PROVIDER_FAILED')
    if state in ('IN_QUEUE', 'IN_PROGRESS', 'QUEUED', 'RUNNING', 'PENDING') or status == 202:
        return {'state': 'pending', 'request_id': request_id, 'status_url': payload.get('status_url'), 'response_url': payload.get('response_url'), 'cancel_url': payload.get('cancel_url')}
    image = payload.get('image')
    if image is None:
        images = payload.get('images')
        if isinstance(images, list) and len(images) == 1:
            image = images[0]
    if isinstance(image, dict) and isinstance(image.get('url'), str):
        return {'state': 'ready', 'request_id': request_id, 'image_url': image['url'], 'seed': payload.get('seed'), 'reported_image': {k: image.get(k) for k in ('width','height','content_type','file_size')}}
    if state == 'COMPLETED':
        return {'state': 'complete', 'request_id': request_id}
    raise ProviderError('PROVIDER_INVALID_RESPONSE')


class FalAdapter:
    """Queue adapter with one POST, explicit no-retry/fallback and private v3 ACL.

    The deny-default ACL must be independently confirmed to allow authenticated
    account access before live activation. Older/public CDN outputs are HELD.
    Transport test doubles take (method, url, body, access), access='api'|'media'.
    """
    version = 'fal-queue-contract-20261013'

    def __init__(self, token, transport=None, timeout=20, polls=8, interval=2, billing_read=False):
        self.token = token
        self.transport = transport or self._request
        self.timeout, self.polls, self.interval = timeout, min(polls,12), min(interval,5)
        self.storage_token=None
        self.billing_read=billing_read

    def _request(self, method, url, body=None, access='api'):
        hosts = ('queue.fal.run',) if access == 'api' else ('rest.fal.ai',) if access=='storage' else ('api.fal.ai',) if access=='billing' else ('v3b.fal.media',)
        validate_remote_url(url, hosts)
        headers = {'Authorization': ('Bearer '+self.storage_token) if access=='media' and self.storage_token else 'Key '+self.token, 'Accept': 'image/png,image/jpeg,image/webp' if access == 'media' else 'application/json'}
        if access=='media' and not self.storage_token:
            raise ProviderError('PROVIDER_PRIVATE_ASSET_ACCESS_HELD')
        if access == 'api':
            headers.update(FAL_PRIVACY_HEADERS)
        if body is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            with urllib.request.build_opener(NoRedirect()).open(request,timeout=self.timeout) as response:
                data=response.read(MAX_RESPONSE+1)
                if len(data)>MAX_RESPONSE:
                    raise ProviderError('PROVIDER_RESPONSE_LIMIT')
                return response.status,data if access=='media' else json.loads(data)
        except urllib.error.HTTPError as e:
            raise ProviderError('PROVIDER_RATE_LIMIT' if e.code==429 else 'PROVIDER_PRIVATE_ASSET_ACCESS_HELD' if access=='media' and e.code in (401,403) else 'PROVIDER_HTTP_ERROR') from None
        except (TimeoutError,socket.timeout,urllib.error.URLError):
            raise ProviderError('PROVIDER_TIMEOUT') from None
        except (json.JSONDecodeError,UnicodeDecodeError):
            raise ProviderError('PROVIDER_INVALID_RESPONSE') from None

    def expand(self,png,job,placement,cancelled=lambda:False,on_submit=lambda receipt:None):
        if cancelled():
            raise ProviderError('CANCELLED')
        spec=FAL_MODELS.get(job.get('model'))
        if not spec:
            raise ProviderError('INVALID_MODEL')
        status,payload=self.transport('POST','https://queue.fal.run/'+spec['endpoint_id'],fal_payload(png,job,placement),'api')
        state=fal_state(status,payload)
        # Persist the submission identity before validating convenience URLs.
        on_submit({'request_id':state['request_id']})
        for key in ('status_url','response_url','cancel_url'):
            if payload.get(key):
                self._queue_url(payload[key],state['request_id'])
                state[key]=payload[key]
        on_submit({k:state.get(k) for k in ('request_id','status_url','response_url','cancel_url')})
        return self._reconcile({**job,'source_placement':placement},state,cancelled)

    def _queue_url(self,url,request_id):
        validate_remote_url(url,('queue.fal.run',),resolve=False)
        parsed=urllib.parse.urlsplit(url)
        if parsed.query or parsed.fragment or '/requests/'+request_id not in parsed.path or not parsed.path.endswith(('/requests/'+request_id,'/requests/'+request_id+'/status','/requests/'+request_id+'/cancel','/requests/'+request_id+'/response')):
            raise ProviderError('PROVIDER_URL_DENIED')
        return url

    def resume(self,job,placement,cancelled=lambda:False):
        request_id=job.get('provider_request_id')
        fal_state(202,{'request_id':request_id})
        return self._reconcile({**job,'source_placement':placement},{'state':'pending','request_id':request_id,'status_url':job.get('status_url'),'response_url':job.get('response_url')},cancelled)

    def _private_asset(self,url):
        validate_remote_url(url,('v3b.fal.media',),resolve=False)
        acl_url='https://rest.fal.ai/storage/files/acl?url='+urllib.parse.quote(url,safe='')
        status,payload=self.transport('GET',acl_url,None,'storage')
        acl=payload.get('acl',payload) if isinstance(payload,dict) else None
        if status!=200 or not isinstance(acl,dict) or acl.get('default')!='forbid' or acl.get('rules')!=[]:
            raise ProviderError('PROVIDER_ACL_UNVERIFIED')
        status,credentials=self.transport('POST','https://rest.fal.ai/storage/auth/token?storage_type=fal-cdn-v3',{'expiration_seconds':300},'storage')
        if status not in (200,201) or not isinstance(credentials,dict) or not isinstance(credentials.get('token'),str) or not credentials['token']:
            raise ProviderError('PROVIDER_PRIVATE_ASSET_ACCESS_HELD')
        self.storage_token=credentials['token']
        return self.transport('GET',url,None,'media')

    def _actual_cost(self,request_id,endpoint_id):
        if not self.billing_read:
            return None
        try:
            url='https://api.fal.ai/v1/models/billing-events?'+urllib.parse.urlencode({'request_id':request_id,'endpoint_id':endpoint_id})
            status,payload=self.transport('GET',url,None,'billing')
            if status!=200 or not isinstance(payload,dict) or payload.get('has_more') or not isinstance(payload.get('billing_events'),list):
                return None
            events=[e for e in payload['billing_events'] if isinstance(e,dict) and e.get('request_id')==request_id and e.get('endpoint_id')==endpoint_id]
            if not events or any(type(e.get('cost_total')) not in (int,float) or not math.isfinite(e['cost_total']) or e['cost_total']<0 for e in events):
                return None
            return sum(e['cost_total'] for e in events)
        except ProviderError:
            return None

    def _reconcile(self,job,state,cancelled):
        status_url=state.get('status_url') or job.get('status_url')
        response_url=state.get('response_url') or job.get('response_url')
        for url in (status_url,response_url):
            if url:
                self._queue_url(url,state['request_id'])
        for attempt in range(self.polls+1):
            if cancelled():
                raise ProviderError('CANCELLED')
            if state['state']=='ready':
                # Only authenticated private CDN is supported, never external/old CDN.
                try:
                    validate_remote_url(state['image_url'],('v3b.fal.media',),resolve=False)
                except ProviderError:
                    raise ProviderError('PROVIDER_PRIVATE_ASSET_HELD') from None
                status,data=self._private_asset(state['image_url'])
                if status!=200 or not isinstance(data,bytes) or not data or len(data)>MAX_RESPONSE:
                    raise ProviderError('PROVIDER_INVALID_IMAGE')
                actual_cost=self._actual_cost(state['request_id'],FAL_MODELS[job['model']]['endpoint_id'])
                return data,{'provider_request_id':state['request_id'],'provider_seed':state.get('seed'),'provider_model_id':FAL_MODELS[job['model']]['endpoint_id'],'model_or_version':FAL_MODELS[job['model']]['endpoint_id'],'provider_cost':actual_cost,'cost_currency':'USD' if actual_cost is not None else None,'provider_usage':'REQUEST_MATCHED_BILLING_EVENTS' if actual_cost is not None else 'ACTUAL_BILLING_NOT_RETURNED','provider_parameters':{k:v for k,v in fal_payload(b'',job,job.get('source_placement',{'width':1920,'height':1080,'source_width':1,'source_height':1,'x':0,'y':0})).items() if k not in ('image_url','image_urls')},'provider_reported_image':state.get('reported_image'),'provider_privacy':{'store_io':False,'retry':False,'fallback':False,'acl':'deny-public-authenticated-account-only; independent review required','expiry_seconds':3600}}
            if state['state']=='complete':
                if not response_url:
                    raise ProviderError('PROVIDER_INVALID_RESPONSE')
                status,payload=self.transport('GET',response_url,None,'api')
                state=fal_state(status,payload,state['request_id'])
                if state['state']!='ready':
                    raise ProviderError('PROVIDER_INVALID_RESPONSE')
                continue
            if attempt==self.polls:
                raise ProviderError('PROVIDER_PENDING_TIMEOUT')
            time.sleep(self.interval)
            if not status_url:
                raise ProviderError('PROVIDER_INVALID_RESPONSE')
            status,payload=self.transport('GET',status_url,None,'api')
            state=fal_state(status,payload,state['request_id'])
        raise ProviderError('PROVIDER_PENDING_TIMEOUT')
