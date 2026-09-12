import sys
from pathlib import Path
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import wl_codec as c

def test_round_trip():
    vault,key=c.create_vault('test-only-credential','test-vault','test-only-token')
    assert c.unlock('test-only-credential',vault)==key
    value={'seq':1,'body':'Črke in ideje — neskončnost ∞'}
    assert c.open_box(c.seal(value,key,'event'),key,'event')==value

def test_wrong_password():
    vault,_=c.create_vault('test-only-credential','test-vault','test-only-token')
    with pytest.raises(Exception):c.unlock('wrong',vault)

def test_wrong_aad():
    _,key=c.create_vault('test','test','token')
    with pytest.raises(Exception):c.open_box(c.seal({'x':1},key,'a'),key,'b')

def test_tamper():
    _,key=c.create_vault('test','test','token')
    box=c.seal({'x':1},key,'a'); box['sha256']='0'*64
    with pytest.raises(ValueError):c.open_box(box,key,'a')

def test_canonical_unicode():
    assert c.canonical({'z':'č','a':1})==b'{"a":1,"z":"\xc4\x8d"}'

def test_invalid_kdf():
    with pytest.raises(ValueError):c.derive('test',{'name':'PBKDF2-SHA256','iterations':1,'salt':'AAAA'})
