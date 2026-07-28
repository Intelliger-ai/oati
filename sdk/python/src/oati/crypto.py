from __future__ import annotations
import base64, json
from datetime import datetime
from typing import Any
from .core import canonical_json

Q=2**255-19; L=2**252+27742317777372353535851937790883648493; D=(-121665*pow(121666,Q-2,Q))%Q; I=pow(2,(Q-1)//4,Q)
def _xrecover(y):
    x=pow((y*y-1)*pow(D*y*y+1,Q-2,Q)%Q,(Q+3)//8,Q)
    if (x*x-(y*y-1)*pow(D*y*y+1,Q-2,Q))%Q: x=x*I%Q
    return x if x%2==0 else Q-x
def _decode_point(data:bytes):
    y=int.from_bytes(data,"little")&((1<<255)-1); x=_xrecover(y)
    if x&1 != data[31]>>7: x=Q-x
    return x,y,1,x*y%Q
def _add(p,q):
    a=(p[1]-p[0])*(q[1]-q[0])%Q; b=(p[1]+p[0])*(q[1]+q[0])%Q; c=2*D*p[3]*q[3]%Q; d=2*p[2]*q[2]%Q
    e=b-a; f=d-c; g=d+c; h=b+a
    return e*f%Q,g*h%Q,f*g%Q,e*h%Q
def _scalar(p,n):
    result=(0,1,1,0)
    while n:
        if n&1: result=_add(result,p)
        p=_add(p,p); n>>=1
    return result
def _equal(p,q): return p[0]*q[2]%Q==q[0]*p[2]%Q and p[1]*q[2]%Q==q[1]*p[2]%Q
def _encode_point(p):
    inv=pow(p[2],Q-2,Q);x=p[0]*inv%Q;y=p[1]*inv%Q
    encoded=bytearray(y.to_bytes(32,"little"));encoded[31]|=(x&1)<<7;return bytes(encoded)
B=_decode_point(bytes.fromhex("5866666666666666666666666666666666666666666666666666666666666666"))
def _b64(value:str)->bytes: return base64.urlsafe_b64decode(value+"="*((4-len(value)%4)%4))
def _ed25519_verify(public:bytes,message:bytes,signature:bytes)->bool:
    if len(public)!=32 or len(signature)!=64:return False
    try: a=_decode_point(public); r=_decode_point(signature[:32]); s=int.from_bytes(signature[32:],"little")
    except Exception:return False
    if s>=L:return False
    import hashlib
    h=int.from_bytes(hashlib.sha512(signature[:32]+public+message).digest(),"little")%L
    return _equal(_scalar(B,s),_add(r,_scalar(a,h)))

class ReplayCache:
    def __init__(self): self._values:set[str]=set()
    def accept(self,key:str)->bool:
        if key in self._values:return False
        self._values.add(key);return True

def sign_document(document:dict[str,Any],private_jwk:dict[str,Any],verification_method:str,audience:str,nonce:str,created:str,expires:str)->dict[str,Any]:
    import hashlib
    seed=_b64(private_jwk["d"])
    if len(seed)!=32 or len(nonce)<16: raise ValueError("Ed25519 seed and a 16-character nonce are required")
    digest=hashlib.sha512(seed).digest();scalar=int.from_bytes(bytes([digest[0]&248])+digest[1:31]+bytes([(digest[31]&63)|64]),"little");public=_encode_point(_scalar(B,scalar))
    header=_b64encode(canonical_json({"alg":"EdDSA","b64":False,"crit":["b64"],"kid":verification_method,"typ":"oati+jws"}).encode())
    proof={"type":"OatiJwsProof2026","cryptosuite":"eddsa-jcs-2022","algorithm":"EdDSA","created":created,"expires":expires,"verification_method":verification_method,"proof_purpose":"assertionMethod","audience":audience,"nonce":nonce}
    signed=json.loads(json.dumps(document));signed["proof"]=proof;message=header.encode()+b"."+canonical_json(signed).encode()
    r=int.from_bytes(hashlib.sha512(digest[32:]+message).digest(),"little")%L;r_encoded=_encode_point(_scalar(B,r));challenge=int.from_bytes(hashlib.sha512(r_encoded+public+message).digest(),"little")%L
    proof["signature"]=header+".."+_b64encode(r_encoded+((r+challenge*scalar)%L).to_bytes(32,"little"));return signed

def verify_document(document:dict[str,Any],bundle:dict[str,Any],audience:str,now:str,replay:ReplayCache|None=None)->list[str]:
    proof=document.get("proof",{}); codes:set[str]=set(); current=datetime.fromisoformat(now.replace("Z","+00:00"))
    created=_time(proof.get("created")); expires=_time(proof.get("expires"))
    if expires and expires<=current: codes.add("PROOF_EXPIRED")
    if created and (current-created).total_seconds()>300: codes.add("PROOF_TOO_OLD")
    audiences=proof.get("audience",[]); audiences=[audiences] if isinstance(audiences,str) else audiences
    if audience not in audiences: codes.add("AUDIENCE_MISMATCH")
    key=next((item for item in bundle.get("keys",[]) if item.get("id")==proof.get("verification_method")),None)
    if key and key.get("status")=="revoked": codes.add("KEY_REVOKED")
    if not key: codes.add("KEY_NOT_FOUND")
    if key and not ({key.get("issuer")} & set(bundle.get("trust_anchors",[]))): codes.add("ISSUER_NOT_TRUSTED")
    if key and not codes.intersection({"KEY_REVOKED","KEY_NOT_FOUND"}):
        try:
            signature_value=proof["signature"]; header,encoded=signature_value.split("..")
            unsigned=json.loads(json.dumps(document)); del unsigned["proof"]["signature"]
            message=header.encode()+b"."+canonical_json(unsigned).encode()
            if not _ed25519_verify(_b64(key["public_key_jwk"]["x"]),message,_b64(encoded)): codes.add("SIGNATURE_INVALID")
        except Exception: codes.add("SIGNATURE_INVALID")
    if not codes and replay is not None and not replay.accept(f'{proof.get("verification_method")}\0{audience}\0{proof.get("nonce")}'): codes.add("REPLAY_DETECTED")
    return sorted(codes)
def _time(value):
    try:return datetime.fromisoformat(value.replace("Z","+00:00"))
    except (AttributeError,ValueError):return None
def _b64encode(value:bytes)->str:return base64.urlsafe_b64encode(value).decode().rstrip("=")
