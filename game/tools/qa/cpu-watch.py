"""Read Windows process CPU counters without commands, credentials or mutation."""
import ctypes
import os
from ctypes import wintypes as W


def snapshot():
    if os.name != 'nt':
        return {}
    k=ctypes.WinDLL('kernel32',use_last_error=True)
    class Entry(ctypes.Structure):
        _fields_=[('size',W.DWORD),('usage',W.DWORD),('pid',W.DWORD),('heap',ctypes.c_size_t),
                  ('module',W.DWORD),('threads',W.DWORD),('parent',W.DWORD),('priority',W.LONG),
                  ('flags',W.DWORD),('name',W.WCHAR*260)]
    k.CreateToolhelp32Snapshot.restype=W.HANDLE
    k.OpenProcess.restype=W.HANDLE
    k.CloseHandle.argtypes=[W.HANDLE]
    k.Process32FirstW.argtypes=[W.HANDLE,ctypes.POINTER(Entry)]
    k.Process32NextW.argtypes=[W.HANDLE,ctypes.POINTER(Entry)]
    k.GetProcessTimes.argtypes=[W.HANDLE]+[ctypes.POINTER(W.FILETIME)]*4
    handle=k.CreateToolhelp32Snapshot(2,0)
    entry=Entry();entry.size=ctypes.sizeof(entry)
    out={}
    try:
        ok=k.Process32FirstW(handle,ctypes.byref(entry))
        while ok:
            h=k.OpenProcess(0x1000,False,entry.pid)
            if h:
                times=[W.FILETIME() for _ in range(4)]
                if k.GetProcessTimes(h,*[ctypes.byref(x) for x in times]):
                    values=[(x.dwHighDateTime<<32)|x.dwLowDateTime for x in times]
                    out[entry.pid]={'parent':entry.parent,'name':entry.name,'created':values[0],'cpu':(values[2]+values[3])/1e7}
                k.CloseHandle(h)
            ok=k.Process32NextW(handle,ctypes.byref(entry))
    finally:
        k.CloseHandle(handle)
    return out


def foreign_cpu(before,after,intermediate=()):
    # This Python process, venv parent and its Playwright/browser descendants.
    family={os.getpid()}
    snapshots=[before,*intermediate,after]
    for rows in snapshots:
        for _ in range(10):
            family.update(pid for pid,r in rows.items() if r['parent'] in family)
    deltas=[]
    totals={}
    for previous,current in zip(snapshots,snapshots[1:]):
        for pid,r in current.items():
            old=previous.get(pid)
            if pid not in family:
                used=max(0,r['cpu']-old['cpu']) if old and old['created']==r['created'] else r['cpu']
                key=(pid,r['created'],r['name'])
                totals[key]=totals.get(key,0)+used
    deltas=[{'process':key[2],'cpuSeconds':round(used,3)} for key,used in totals.items() if used]
    deltas.sort(key=lambda r:-r['cpuSeconds'])
    return {'top':deltas[:5], 'totalSeconds':round(sum(r['cpuSeconds'] for r in deltas),3),
            'readableProcesses':len(after),'busy':bool(deltas and deltas[0]['cpuSeconds']>2) or sum(r['cpuSeconds'] for r in deltas)>4}
