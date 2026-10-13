"""Bria v2 outpainting contract. No generation retries; bounded status polling.

Real account/model/usage verification is still required. The adapter version is
an API contract identifier, not a claim about Bria's undisclosed model weights.
"""
import base64
import ipaddress
import json
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
    if status in (420, 423):
        return {'state': 'pending', 'request_id': payload.get('request_id'), 'status_url': payload.get('status_url')}
    if status not in (200, 202):
        raise ProviderError('PROVIDER_HTTP_ERROR')
    if not isinstance(payload, dict):
        raise ProviderError('PROVIDER_INVALID_RESPONSE')
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
                status, image = self.transport('GET', state['image_url'], None, False)
                if status != 200 or not isinstance(image, bytes) or not image or len(image) > MAX_RESPONSE:
                    raise ProviderError('PROVIDER_INVALID_IMAGE')
                return image, {'provider_request_id': state['request_id'], 'provider_seed': state.get('seed'),
                               'model_or_version': self.version, 'provider_model_id': 'NOT_EXPOSED',
                               'provider_cost': None, 'provider_usage': 'NOT_EXPOSED_BY_RESPONSE'}
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
