#!/usr/bin/python3
"""Linux reader lifecycle guard; fixed argv from host.py, never from a webpage."""
import ctypes
import os
import resource
import signal
import sys

parent = int(sys.argv[1])
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:  # PR_SET_PDEATHSIG
    raise SystemExit("Cannot bind reader lifetime")
if os.getppid() != parent or parent == 1:
    raise SystemExit("Native host already closed")
resource.setrlimit(resource.RLIMIT_FSIZE, (2097152, 2097152))
os.execv(sys.argv[2], sys.argv[2:])
