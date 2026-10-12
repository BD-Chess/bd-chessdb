#!/usr/bin/env python3
"""Build only LAB with the unchanged shared PWA generator.

Heavy engines remain outside its exact precache allowlist and use normal
browser HTTP caching on explicit engine use. No custom worker extension.
"""
import runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]

def build():
    baseline=runpy.run_path(str(ROOT/'tools/build-chess-channel-pwas.py'))
    baseline['build']('LAB',False)
    baseline['build']('LAB',True)

if __name__=='__main__': build()
