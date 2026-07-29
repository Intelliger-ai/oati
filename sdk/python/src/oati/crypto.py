from __future__ import annotations
import base64, hashlib, json
from datetime import datetime,timedelta
from typing import Any
from .core import canonical_json

Q=2**255-19; L=2**252+27742317777372353535851937790883648493; D=(-121665*pow(121666,Q-2,Q))%Q; I=pow(2,(Q-1)//4,Q)
def _xrecover(y):
    x=pow((y*y-1)*pow(D*y*y+1,Q-2,Q)%Q,(Q+3)//8,Q)
    if (x*x-(y*y-1)*pow(D*y*y+1,Q-2,Q))%Q: x=x*I%Q
    return x if x%2==0 else Q-x
def _decode_point(data:bytes):
    if len(data)!=32:raise ValueError("Ed25519 point must be 32 bytes")
    encoded=int.from_bytes(data,"little");sign=encoded>>255;y=encoded&((1<<255)-1)
    if y>=Q:raise ValueError("non-canonical Ed25519 point")
    x=_xrecover(y)
    if (x*x*(D*y*y+1)-(y*y-1))%Q:raise ValueError("invalid Ed25519 point")
    if x&1 != sign:x=Q-x
    if x==0 and sign:raise ValueError("non-canonical Ed25519 sign bit")
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
    if s>=L or _small_order(a) or _small_order(r):return False
    import hashlib
    h=int.from_bytes(hashlib.sha512(signature[:32]+public+message).digest(),"little")%L
    return _equal(_scalar(B,s),_add(r,_scalar(a,h)))
def _small_order(point):return _equal(_scalar(point,8),(0,1,1,0))

P256_P=0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff
P256_A=P256_P-3
P256_N=0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551
P256_G=(0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296,0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5)
def _padd(p,q):
    if p is None:return q
    if q is None:return p
    if p[0]==q[0] and (p[1]+q[1])%P256_P==0:return None
    slope=((3*p[0]*p[0]+P256_A)*pow(2*p[1],P256_P-2,P256_P) if p==q else (q[1]-p[1])*pow((q[0]-p[0])%P256_P,P256_P-2,P256_P))%P256_P
    x=(slope*slope-p[0]-q[0])%P256_P;return x,(slope*(p[0]-x)-p[1])%P256_P
def _pmul(point,value):
    result=None
    while value:
        if value&1:result=_padd(result,point)
        point=_padd(point,point);value>>=1
    return result
def _es256_verify(jwk,message,signature):
    if len(signature)!=64:return False
    r=int.from_bytes(signature[:32],"big");s=int.from_bytes(signature[32:],"big")
    if not 0<r<P256_N or not 0<s<P256_N:return False
    x_bytes,y_bytes=_b64(jwk["x"]),_b64(jwk["y"])
    if len(x_bytes)!=32 or len(y_bytes)!=32:return False
    public=(int.from_bytes(x_bytes,"big"),int.from_bytes(y_bytes,"big"))
    if not 0<=public[0]<P256_P or not 0<=public[1]<P256_P or (public[1]*public[1]-public[0]*public[0]*public[0]-P256_A*public[0]-0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b)%P256_P:return False
    z=int.from_bytes(hashlib.sha256(message).digest(),"big");w=pow(s,-1,P256_N)
    point=_padd(_pmul(P256_G,z*w%P256_N),_pmul(public,r*w%P256_N));return point is not None and point[0]%P256_N==r

class ReplayCache:
    def __init__(self): self._values:set[str]=set()
    def accept(self,key:str)->bool:
        if key in self._values:return False
        self._values.add(key);return True

def sign_document(document:dict[str,Any],private_jwk:dict[str,Any],verification_method:str,audience:str,nonce:str,created:str,expires:str,algorithm:str|None=None)->dict[str,Any]:
    import hashlib
    algorithm=algorithm or ("EdDSA" if (private_jwk.get("kty"),private_jwk.get("crv"))==("OKP","Ed25519") else "ES256" if (private_jwk.get("kty"),private_jwk.get("crv"))==("EC","P-256") else "")
    if len(nonce)<16 or not verification_method or not audience:raise ValueError("verification method, audience, and a 16-character nonce are required")
    created_at,expires_at=_time(created),_time(expires)
    if not created_at or not expires_at or created_at.utcoffset() is None or expires_at.utcoffset() is None or expires_at<=created_at:raise ValueError("expires must be a valid timezone-aware instant after created")
    suite="eddsa-jcs-2022" if algorithm=="EdDSA" else "ecdsa-jcs-2019" if algorithm=="ES256" else None
    if not suite:raise ValueError("algorithm must be EdDSA or ES256")
    header=_b64encode(canonical_json({"alg":algorithm,"b64":False,"crit":["b64"],"kid":verification_method,"typ":"oati+jws"}).encode())
    proof={"type":"OatiJwsProof2026","cryptosuite":suite,"algorithm":algorithm,"created":created_at.isoformat().replace("+00:00","Z"),"expires":expires_at.isoformat().replace("+00:00","Z"),"verification_method":verification_method,"proof_purpose":"assertionMethod","audience":audience,"nonce":nonce}
    signed=json.loads(json.dumps(document));signed["proof"]=proof;message=header.encode()+b"."+canonical_json(signed).encode()
    if algorithm=="EdDSA":
        seed=_b64(private_jwk["d"])
        if len(seed)!=32:raise ValueError("EdDSA requires a 32-byte Ed25519 private seed")
        digest=hashlib.sha512(seed).digest();scalar=int.from_bytes(bytes([digest[0]&248])+digest[1:31]+bytes([(digest[31]&63)|64]),"little");public=_encode_point(_scalar(B,scalar))
        if private_jwk.get("x") and _b64(private_jwk["x"])!=public:raise ValueError("Ed25519 private and public JWK members do not match")
        r=int.from_bytes(hashlib.sha512(digest[32:]+message).digest(),"little")%L;r_encoded=_encode_point(_scalar(B,r));challenge=int.from_bytes(hashlib.sha512(r_encoded+public+message).digest(),"little")%L
        signature=r_encoded+((r+challenge*scalar)%L).to_bytes(32,"little")
    else:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        private_value=int.from_bytes(_b64(private_jwk["d"]),"big")
        if not 0<private_value<P256_N:raise ValueError("ES256 private scalar is outside the P-256 range")
        private_key=ec.derive_private_key(private_value,ec.SECP256R1());numbers=private_key.public_key().public_numbers()
        if len(_b64(private_jwk.get("x","")))!=32 or len(_b64(private_jwk.get("y","")))!=32 or numbers.x!=int.from_bytes(_b64(private_jwk["x"]),"big") or numbers.y!=int.from_bytes(_b64(private_jwk["y"]),"big"):raise ValueError("P-256 private and public JWK members do not match")
        r,s=decode_dss_signature(private_key.sign(message,ec.ECDSA(hashes.SHA256())))
        signature=r.to_bytes(32,"big")+s.to_bytes(32,"big")
    proof["signature"]=header+".."+_b64encode(signature);return signed

def verify_document(document:dict[str,Any],bundle:dict[str,Any],audience:str,now:str,replay:ReplayCache|None=None)->list[str]:
    if "proof" not in document or document.get("proof") is None:return ["PROOF_MISSING"]
    proof=document.get("proof"); malformed=_proof_malformed(proof)
    if malformed:return ["PROOF_MALFORMED"]
    codes:set[str]=set(); current=datetime.fromisoformat(now.replace("Z","+00:00"));skew=timedelta(seconds=30)
    created=_time(proof.get("created")); expires=_time(proof.get("expires"))
    if not created or not expires or expires<=created:return ["PROOF_MALFORMED"]
    if expires and expires<=current-skew: codes.add("PROOF_EXPIRED")
    if created and current-created>timedelta(minutes=5)+skew: codes.add("PROOF_TOO_OLD")
    if created and created>current+skew:codes.add("PROOF_NOT_YET_VALID")
    audiences=proof.get("audience",[]); audiences=[audiences] if isinstance(audiences,str) else audiences
    if audience not in audiences: codes.add("AUDIENCE_MISMATCH")
    key=next((item for item in bundle.get("keys",[]) if item.get("id")==proof.get("verification_method")),None)
    if not key: codes.add("KEY_NOT_FOUND")
    if key:
        _check_key(key,proof,created,current,skew,codes);_check_chain(key.get("issuer"),bundle,current,skew,codes);_check_revocations((key.get("id"),key.get("issuer"),document.get("id")),bundle,current,codes)
        claimed=document.get("issuer",document.get("agent_id"))
        if claimed and claimed not in (key.get("controller"),key.get("issuer")):codes.add("KEY_INVALID")
        try:
            if "KEY_INVALID" in codes:raise KeyError("invalid verification key")
            signature_value=proof["signature"]; header,encoded=signature_value.split("..")
            protected=json.loads(_b64(header));
            if protected.get("alg")!=proof.get("algorithm") or protected.get("kid")!=proof.get("verification_method") or protected.get("b64") is not False or protected.get("typ")!="oati+jws" or protected.get("crit") != ["b64"]:raise ValueError("header mismatch")
            unsigned=json.loads(json.dumps(document)); del unsigned["proof"]["signature"]
            message=header.encode()+b"."+canonical_json(unsigned).encode()
            signature=_b64(encoded);jwk=key["public_key_jwk"]
            valid=_ed25519_verify(_b64(jwk["x"]),message,signature) if proof.get("algorithm")=="EdDSA" else _es256_verify(jwk,message,signature) if proof.get("algorithm")=="ES256" else False
            if not valid: codes.add("SIGNATURE_INVALID")
        except KeyError:pass
        except Exception: codes.add("SIGNATURE_INVALID")
    if not codes and replay is not None and not replay.accept(f'{proof.get("verification_method")}\0{audience}\0{proof.get("nonce")}'): codes.add("REPLAY_DETECTED")
    return sorted(codes)
def _check_key(key,proof,created,current,skew,codes):
    algorithm=key.get("algorithm");jwk=key.get("public_key_jwk",{});status=key.get("status")
    if algorithm!=proof.get("algorithm") or key.get("id")!=proof.get("verification_method") or key.get("proof_status") not in (None,"verified"):codes.add("KEY_INVALID")
    if algorithm=="EdDSA" and (jwk.get("kty"),jwk.get("crv"))!=("OKP","Ed25519") or algorithm=="ES256" and (jwk.get("kty"),jwk.get("crv"))!=("EC","P-256") or algorithm not in ("EdDSA","ES256"):codes.add("KEY_INVALID")
    if algorithm=="EdDSA":
        try:
            point=_decode_point(_b64(jwk["x"]))
            if _small_order(point):codes.add("KEY_INVALID")
        except Exception:codes.add("KEY_INVALID")
    if status not in ("active","retired","revoked"):codes.add("KEY_INVALID")
    if status=="retired" and not key.get("valid_until"):codes.add("KEY_INVALID")
    valid_from=_time(key.get("valid_from"));valid_until=_time(key.get("valid_until"))
    if not valid_from or created<valid_from-skew or key.get("valid_until") and (not valid_until or created>=valid_until+skew):codes.add("KEY_INVALID")
    revoked_at=_time(key.get("revoked_at"))
    if key.get("revoked_at") and not revoked_at:codes.add("KEY_INVALID")
    if status=="revoked" or revoked_at and revoked_at<=current:codes.add("KEY_REVOKED")
def _check_chain(start,bundle,current,skew,codes):
    anchors=set(bundle.get("trust_anchors",[]));visited=set();issuer_id=start
    for _ in range(9):
        if issuer_id in visited:break
        visited.add(issuer_id);issuer=next((item for item in bundle.get("issuers",[]) if item.get("id")==issuer_id),None)
        _check_revocations((None,issuer_id,None),bundle,current,codes)
        if issuer_id in anchors:return
        if not issuer or issuer.get("proof_status") not in (None,"verified"):break
        valid_from=_time(issuer.get("valid_from"));valid_until=_time(issuer.get("valid_until"));revoked=_time(issuer.get("revoked_at"))
        invalid_time=(issuer.get("valid_from") and not valid_from) or (issuer.get("valid_until") and not valid_until) or (issuer.get("revoked_at") and not revoked)
        if issuer.get("status")!="active" or invalid_time or revoked and revoked<=current or valid_from and valid_from>current+skew or valid_until and valid_until<=current-skew:codes.add("ISSUER_REVOKED");return
        issuer_id=issuer.get("parent")
        if not issuer_id:break
    codes.add("ISSUER_NOT_TRUSTED")
def _check_revocations(targets,bundle,current,codes):
    unavailable=set(bundle.get("unavailable_targets",[]));result=("KEY_REVOKED","ISSUER_REVOKED","DOCUMENT_REVOKED")
    for index,target in enumerate(targets):
        if not target:continue
        if target in unavailable:codes.add("REVOCATION_UNAVAILABLE");continue
        matches=[item for item in bundle.get("revocations",[]) if item.get("target")==target]
        if len(matches)>1:codes.add("REVOCATION_UNAVAILABLE");continue
        if not matches or matches[0].get("status")=="good":continue
        effective=_time(matches[0].get("effective_at"))
        if effective and effective>current:continue
        codes.add(result[index])
def _time(value):
    try:return datetime.fromisoformat(value.replace("Z","+00:00"))
    except (AttributeError,ValueError):return None
def _proof_malformed(proof):
    if not isinstance(proof,dict):return True
    algorithm=proof.get("algorithm");suite="eddsa-jcs-2022" if algorithm=="EdDSA" else "ecdsa-jcs-2019" if algorithm=="ES256" else None
    audience=proof.get("audience");audiences=[audience] if isinstance(audience,str) else audience
    signature=proof.get("signature")
    return proof.get("type")!="OatiJwsProof2026" or not suite or proof.get("cryptosuite")!=suite or not isinstance(proof.get("created"),str) or not isinstance(proof.get("expires"),str) or not isinstance(proof.get("verification_method"),str) or not proof.get("verification_method") or proof.get("proof_purpose")!="assertionMethod" or not isinstance(audiences,list) or not audiences or any(not isinstance(item,str) or not item for item in audiences) or not isinstance(proof.get("nonce"),str) or len(proof.get("nonce",""))<16 or not isinstance(signature,str) or signature.count("..")!=1 or any(not part or not all(character.isalnum() or character in "_-" for character in part) for part in signature.split(".."))
def _b64encode(value:bytes)->str:return base64.urlsafe_b64encode(value).decode().rstrip("=")
