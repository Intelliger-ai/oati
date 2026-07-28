from __future__ import annotations
import json
from urllib.error import HTTPError,URLError
from urllib.parse import urlencode
from urllib.request import urlopen

class LookupError(RuntimeError):
    def __init__(self,code:str,message:str):super().__init__(message);self.code=code
def lookup(base_url:str,record_type:str,record_id:str,timeout:float=5.0)->dict:
    url=base_url.rstrip("/")+"/lookup?"+urlencode({"type":record_type,"id":record_id})
    try:
        with urlopen(url,timeout=timeout) as response: value=json.load(response)
    except HTTPError as error:
        raise LookupError("LOOKUP_NOT_FOUND" if error.code==404 else "LOOKUP_UNAVAILABLE",f"lookup returned HTTP {error.code}") from error
    except (URLError,TimeoutError) as error: raise LookupError("LOOKUP_UNAVAILABLE",str(error)) from error
    if not isinstance(value,dict) or value.get("type")!=record_type or value.get("id")!=record_id:raise LookupError("LOOKUP_INVALID_RESPONSE","resolver returned a mismatched record")
    return value
