from __future__ import annotations
import json,time
from datetime import datetime,timezone
from dataclasses import dataclass
from typing import Callable,Any
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode,urlparse
from urllib.request import Request,urlopen
from .core import validate_schema

RECORD_TYPES=("organisation","agent","passport","mandate","receipt","issuer","key","revocation","service","profile")
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
        return self._lookup_selected(record_type,"id",record_id,reload=reload,no_store=no_store)
    def lookup_revocation_by_target(self,target:str,*,reload:bool=False,no_store:bool=False)->dict[str,Any]:return self.lookup_revocation_by_target_detailed(target,reload=reload,no_store=no_store).record
    def lookup_revocation_by_target_detailed(self,target:str,*,reload:bool=False,no_store:bool=False)->LookupResult:return self._lookup_selected("revocation","target",target,reload=reload,no_store=no_store)
    def discover_organisation(self,organisation_id:str)->dict[str,Any]:
        if not organisation_id.startswith("oati:org:"):raise LookupError("LOOKUP_BAD_REQUEST","valid organisation id required")
        last=None
        for resolver in self.resolver_urls:
            endpoint=resolver.rstrip("/")+"/discovery?"+urlencode({"organisation_id":organisation_id})
            try:
                with self.opener(Request(endpoint,headers={"Accept":"application/json"}),timeout=self.timeout) as response:value=json.load(response)
            except HTTPError as error:
                if error.code==404:raise LookupError("LOOKUP_NOT_FOUND","discovery not found",status=404) from error
                last=LookupError("LOOKUP_UNAVAILABLE",f"discovery returned HTTP {error.code}",status=error.code);continue
            except (URLError,OSError) as error:last=LookupError("LOOKUP_UNAVAILABLE",str(error));continue
            if not isinstance(value,dict) or value.get("organisation_id")!=organisation_id or not isinstance(value.get("services"),list) or not isinstance(value.get("profiles"),list):raise LookupError("LOOKUP_INVALID_RESPONSE","invalid discovery response")
            services=[_decode_discovery(record,"service",organisation_id) for record in value["services"]]
            profiles=[_decode_discovery(record,"profile",organisation_id) for record in value["profiles"]]
            profile_ids={item["record"]["id"] for item in profiles}
            if any(profile not in profile_ids for item in services for profile in item["document"]["accepted_profiles"]):raise LookupError("LOOKUP_INVALID_RESPONSE","service references an unpublished profile")
            return {"organisation_id":organisation_id,"services":services,"profiles":profiles}
        raise last or LookupError("LOOKUP_UNAVAILABLE","no resolver was available")
    def discover_federated(self,domain:str,organisation_id:str)->dict[str,Any]:
        parsed=urlparse(domain if "://" in domain else "https://"+domain)
        if parsed.scheme!="https" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:raise LookupError("LOOKUP_BAD_REQUEST","federation requires a bare HTTPS domain")
        endpoint=f"https://{parsed.netloc}/.well-known/oati"
        try:
            with self.opener(Request(endpoint,headers={"Accept":"application/json"}),timeout=self.timeout) as response:document=json.load(response)
        except HTTPError as error:raise LookupError("LOOKUP_NOT_FOUND" if error.code==404 else "LOOKUP_UNAVAILABLE","federation lookup failed",status=error.code) from error
        except (URLError,OSError,TimeoutError) as error:raise LookupError("LOOKUP_UNAVAILABLE",str(error)) from error
        valid=isinstance(document,dict) and document.get("oati_version")=="1.0" and organisation_id in document.get("organisations",[]) and isinstance(document.get("resolvers"),list) and bool(document["resolvers"])
        if not valid or any(urlparse(item).scheme!="https" for item in document.get("resolvers",[])) or _expired(document.get("expires_at")):raise LookupError("LOOKUP_INVALID_RESPONSE","invalid, unrelated, or expired federation document")
        return LookupClient(document["resolvers"],timeout=self.timeout,max_retries=self.max_retries,base_delay=self.base_delay,ttl=self.ttl,negative_ttl=self.negative_ttl,opener=self.opener).discover_organisation(organisation_id)
    def _lookup_selected(self,record_type:str,selector:str,value:str,*,reload:bool,no_store:bool)->LookupResult:
        if record_type not in RECORD_TYPES or not value:raise ValueError("valid record type and selector value are required")
        key=record_type+"\0"+selector+"\0"+value;cached=self._cache.get(key)
        if not reload and not no_store and cached and cached.expires_at>time.monotonic():
            if cached.not_found:raise LookupError("LOOKUP_NOT_FOUND","OATI record was not found",status=404)
            return LookupResult(dict(cached.record or {}),cached.resolver_url,"hit",{})
        last:LookupError|None=None
        for resolver in self.resolver_urls:
            try:
                reusable=cached if cached and cached.resolver_url==resolver else None
                result,etag,rate,revalidated=self._request_with_retry(resolver,record_type,selector,value,reusable)
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
            return {"state":"invalid_proof" if proof=="invalid" else "unavailable" if proof=="unavailable" else "unknown" if proof=="unknown" else "found","record":result.record,"response":result}
        except LookupError as error:return {"state":"not_found" if error.code=="LOOKUP_NOT_FOUND" else "unavailable","error":error}
    def clear_cache(self):self._cache.clear()
    def _request_with_retry(self,resolver,record_type,selector,value,cached):
        last=None
        for attempt in range(self.max_retries+1):
            if attempt:time.sleep(min(self.base_delay*2**(attempt-1),5) if not last or last.retry_after is None else min(last.retry_after,5))
            try:return self._request(resolver,record_type,selector,value,cached)
            except LookupError as error:
                last=error
                if error.code not in ("LOOKUP_RATE_LIMITED","LOOKUP_UNAVAILABLE","LOOKUP_TIMEOUT") or attempt==self.max_retries:raise
        raise last
    def _request(self,resolver,record_type,selector,selector_value,cached):
        endpoint=resolver.rstrip("/")+"/lookup?"+urlencode({"type":record_type,selector:selector_value});headers={"Accept":"application/json"}
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
        matches=isinstance(value,dict) and (value.get("id")==selector_value if selector=="id" else value.get("type")=="revocation" and value.get("public_attributes",{}).get("target")==selector_value and value.get("public_attributes",{}).get("revocation_status") in ("good","suspended","revoked","unknown"))
        if not matches or value.get("type")!=record_type:raise LookupError("LOOKUP_INVALID_RESPONSE","resolver returned a mismatched record")
        value=_normalize_record(value)
        rate={"limit":_integer(response_headers.get("X-RateLimit-Limit")),"remaining":_integer(response_headers.get("X-RateLimit-Remaining")),"reset_at":response_headers.get("X-RateLimit-Reset")}
        if record_type=="key":
            attributes=value.get("public_attributes",{})
            value={**value,"issued_at":value.get("issued_at") or attributes.get("valid_from"),"expires_at":value.get("expires_at") or attributes.get("valid_until")}
        return value,response_headers.get("ETag"),{key:value for key,value in rate.items() if value is not None},False

def lookup(base_url:str,record_type:str,record_id:str,timeout:float=5.0)->dict:return LookupClient([base_url],timeout=timeout,max_retries=0).lookup(record_type,record_id)
def _integer(value):
    try:return int(value)
    except (TypeError,ValueError):return None
def _retry_after(value):
    try:return float(value)
    except (TypeError,ValueError):return None
def _expired(value):
    if not value:return False
    try:return datetime.fromisoformat(value.replace("Z","+00:00"))<=datetime.now(timezone.utc)
    except (TypeError,ValueError):return True
def _decode_discovery(record,kind,organisation_id):
    if not isinstance(record,dict) or record.get("type")!=kind or record.get("organisation_id")!=organisation_id or record.get("status")!="active" or record.get("proof_status")!="verified":raise LookupError("LOOKUP_INVALID_RESPONSE","untrusted discovery record")
    try:document=json.loads(record.get("public_attributes",{}).get("document",""))
    except (TypeError,ValueError) as error:raise LookupError("LOOKUP_INVALID_RESPONSE","invalid discovery document") from error
    if not isinstance(document,dict) or document.get("id")!=record.get("id") or document.get("organisation_id")!=organisation_id or document.get("issuer")!=record.get("issuer") or document.get("status")!="active":raise LookupError("LOOKUP_INVALID_RESPONSE","discovery document does not match record")
    if validate_schema("serviceDiscovery" if kind=="service" else "profileDiscovery",document) or _expired(record.get("expires_at")) or _expired(document.get("expires_at")):raise LookupError("LOOKUP_INVALID_RESPONSE","invalid or expired discovery document")
    return {"record":record,"document":document}
def _normalize_record(value):
    attributes=value.get("public_attributes")
    if not isinstance(attributes,dict) or not isinstance(value.get("status"),str) or not isinstance(value.get("issuer"),str) or value.get("proof_status") not in ("verified","invalid","unavailable","unknown"):raise LookupError("LOOKUP_INVALID_RESPONSE","resolver returned an invalid public record")
    if not all(isinstance(item,str) for item in attributes.values()):raise LookupError("LOOKUP_INVALID_RESPONSE","public attributes must be strings")
    if value.get("type")=="key":
        value={**value,"issued_at":value.get("issued_at") or attributes.get("valid_from"),"expires_at":value.get("expires_at") or attributes.get("valid_until")}
        if not value.get("issued_at") or not value.get("expires_at") or not attributes.get("controller") or attributes.get("algorithm") not in ("EdDSA","ES256") or not attributes.get("public_key_jwk"):raise LookupError("LOOKUP_INVALID_RESPONSE","resolver returned an invalid key record")
    if value.get("type") in ("service","profile"):_decode_discovery(value,value["type"],value.get("organisation_id"))
    return value
