from __future__ import annotations
import json,time
from dataclasses import dataclass
from typing import Callable,Any
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode
from urllib.request import Request,urlopen

RECORD_TYPES=("organisation","agent","passport","mandate","receipt","issuer","key","revocation")
class LookupError(RuntimeError):
    def __init__(self,code:str,message:str,*,status:int|None=None,retry_after:float|None=None):super().__init__(message);self.code=code;self.status=status;self.retry_after=retry_after
@dataclass(frozen=True)
class LookupResult:
    record:dict[str,Any];resolver_url:str;cache:str;rate_limit:dict[str,Any]
@dataclass
class _CacheEntry:
    record:dict[str,Any]|None;resolver_url:str;expires_at:float;etag:str|None=None;not_found:bool=False

class LookupClient:
    def __init__(self,resolver_urls:list[str]|None=None,*,timeout:float=5,max_retries:int=2,base_delay:float=.2,ttl:float=60,negative_ttl:float=10,opener:Callable[...,Any]=urlopen):
        self.resolver_urls=resolver_urls or ["https://api.intelliger.ai/oati/v1"];self.timeout=timeout;self.max_retries=max_retries;self.base_delay=base_delay;self.ttl=ttl;self.negative_ttl=negative_ttl;self.opener=opener;self._cache:dict[str,_CacheEntry]={}
    def lookup(self,record_type:str,record_id:str,*,reload:bool=False,no_store:bool=False)->dict[str,Any]:return self.lookup_detailed(record_type,record_id,reload=reload,no_store=no_store).record
    def lookup_detailed(self,record_type:str,record_id:str,*,reload:bool=False,no_store:bool=False)->LookupResult:
        if record_type not in RECORD_TYPES or not record_id:raise ValueError("valid record type and id are required")
        key=record_type+"\0"+record_id;cached=self._cache.get(key)
        if not reload and not no_store and cached and cached.expires_at>time.monotonic():
            if cached.not_found:raise LookupError("LOOKUP_NOT_FOUND","OATI record was not found",status=404)
            return LookupResult(dict(cached.record or {}),cached.resolver_url,"hit",{})
        last:LookupError|None=None
        for resolver in self.resolver_urls:
            try:
                result,etag,rate,revalidated=self._request_with_retry(resolver,record_type,record_id,cached)
                if not no_store:self._cache[key]=_CacheEntry(result,resolver,time.monotonic()+self.ttl,etag)
                return LookupResult(result,resolver,"revalidated" if revalidated else "miss",rate)
            except LookupError as error:
                last=error
                if error.code=="LOOKUP_NOT_FOUND":
                    if not no_store:self._cache[key]=_CacheEntry(None,resolver,time.monotonic()+self.negative_ttl,not_found=True)
                    raise
        raise last or LookupError("LOOKUP_UNAVAILABLE","no resolver was available")
    def lookup_state(self,record_type:str,record_id:str)->dict[str,Any]:
        try:
            result=self.lookup_detailed(record_type,record_id);proof=result.record.get("proof_status")
            return {"state":"invalid-proof" if proof=="invalid" else "unknown" if proof in ("unknown","unavailable") else "found","record":result.record}
        except LookupError as error:return {"state":"not-found" if error.code=="LOOKUP_NOT_FOUND" else "unavailable","error":error}
    def clear_cache(self):self._cache.clear()
    def _request_with_retry(self,resolver,record_type,record_id,cached):
        last=None
        for attempt in range(self.max_retries+1):
            if attempt:time.sleep(min(self.base_delay*2**(attempt-1),5) if not last or last.retry_after is None else min(last.retry_after,5))
            try:return self._request(resolver,record_type,record_id,cached)
            except LookupError as error:
                last=error
                if error.code not in ("LOOKUP_RATE_LIMITED","LOOKUP_UNAVAILABLE","LOOKUP_TIMEOUT") or attempt==self.max_retries:raise
        raise last
    def _request(self,resolver,record_type,record_id,cached):
        endpoint=resolver.rstrip("/")+"/lookup?"+urlencode({"type":record_type,"id":record_id});headers={"Accept":"application/json"}
        if cached and cached.etag:headers["If-None-Match"]=cached.etag
        try:
            with self.opener(Request(endpoint,headers=headers),timeout=self.timeout) as response:
                if getattr(response,"status",200)==304 and cached and cached.record:return dict(cached.record),cached.etag,{},True
                value=json.load(response);response_headers=response.headers
        except HTTPError as error:
            retry=_retry_after(error.headers.get("Retry-After")) if error.headers else None
            code="LOOKUP_NOT_FOUND" if error.code==404 else "LOOKUP_RATE_LIMITED" if error.code==429 else "LOOKUP_UNAVAILABLE"
            raise LookupError(code,f"lookup returned HTTP {error.code}",status=error.code,retry_after=retry) from error
        except TimeoutError as error:raise LookupError("LOOKUP_TIMEOUT",str(error)) from error
        except (URLError,OSError) as error:raise LookupError("LOOKUP_UNAVAILABLE",str(error)) from error
        if not isinstance(value,dict) or value.get("type")!=record_type or value.get("id")!=record_id:raise LookupError("LOOKUP_INVALID_RESPONSE","resolver returned a mismatched record")
        rate={"limit":_integer(response_headers.get("X-RateLimit-Limit")),"remaining":_integer(response_headers.get("X-RateLimit-Remaining")),"reset_at":response_headers.get("X-RateLimit-Reset")}
        return value,response_headers.get("ETag"),{key:value for key,value in rate.items() if value is not None},False

def lookup(base_url:str,record_type:str,record_id:str,timeout:float=5.0)->dict:return LookupClient([base_url],timeout=timeout,max_retries=0).lookup(record_type,record_id)
def _integer(value):
    try:return int(value)
    except (TypeError,ValueError):return None
def _retry_after(value):
    try:return float(value)
    except (TypeError,ValueError):return None
