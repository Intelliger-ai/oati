from __future__ import annotations
import json, math, re
from copy import deepcopy
from datetime import datetime
from functools import lru_cache
from importlib.resources import files
from pathlib import Path
from typing import Any

SCHEMAS = {"proof":"proof.schema.json","verificationKey":"verification-key.schema.json","issuer":"issuer.schema.json","revocation":"revocation.schema.json","evaluationRequest":"evaluation-request.schema.json","evaluationResult":"evaluation-result.schema.json","publicRecord":"public-record.schema.json","serviceDiscovery":"service-discovery.schema.json","profileDiscovery":"profile-discovery.schema.json","wellKnown":"well-known.schema.json","conformanceSuite":"conformance-suite.schema.json","conformanceReport":"conformance-report.schema.json","passport":"passport.schema.json","mandate":"mandate.schema.json","envelope":"transaction-envelope.schema.json","decision":"decision.schema.json","receipt":"receipt.schema.json","commerceOffer":"commerce/merchant-service-profile.schema.json","commerceMandate":"commerce/purchase-mandate.schema.json","commerceReceipt":"commerce/commerce-receipt.schema.json","rwaAsset":"rwa/asset-profile.schema.json","rwaStateClaim":"rwa/asset-state-claim.schema.json","rwaMandate":"rwa/asset-mandate.schema.json","rwaReceipt":"rwa/rwa-receipt.schema.json"}
PUBLIC_FIELDS = ("type","id","display_name","status","issuer","organisation_id","issued_at","expires_at","assurance_level","proof_status","public_attributes")
PUBLIC_ATTRIBUTES_BY_TYPE = {
    "organisation": ("environment", "website", "jurisdiction", "signed_document"),
    "issuer": ("environment", "parent", "revoked_at", "signed_document"),
    "key": ("controller", "algorithm", "public_key_jwk", "revoked_at", "signed_document"),
    "agent": ("protocol", "protocols", "signed_document"),
    "passport": ("subject", "signed_document"),
    "mandate": ("subject", "signed_document"),
    "receipt": ("transaction_id", "mandate_id", "outcome", "signed_document"),
    "revocation": ("target", "revocation_status", "effective_at", "signed_document"),
    "service": ("document", "signed_document"),
    "profile": ("document", "signed_document"),
}
SENSITIVE_PUBLIC_FIELDS = {"access_token", "api_key", "credential", "internal_id", "kms_key", "operator_notes", "password", "private_attributes", "private_key", "refresh_token", "secret", "tenant_id"}

def canonical_json(value: Any) -> str:
    def render(item: Any) -> str:
        if item is None: return "null"
        if item is True: return "true"
        if item is False: return "false"
        if isinstance(item,(int,float)): return _canonical_number(item)
        if isinstance(item,str):
            _check_unicode(item)
            return json.dumps(item,ensure_ascii=False,separators=(",",":"))
        if isinstance(item,list): return "["+",".join(render(child) for child in item)+"]"
        if isinstance(item,dict):
            if not all(isinstance(key,str) for key in item): raise TypeError("JSON object keys must be strings")
            for key in item: _check_unicode(key)
            keys=sorted(item,key=lambda key:key.encode("utf-16-be"))
            return "{"+",".join(render(key)+":"+render(item[key]) for key in keys)+"}"
        raise TypeError(f"not a JSON value: {type(item).__name__}")
    return render(value)

def _check_unicode(value:str)->None:
    if any(0xD800<=ord(character)<=0xDFFF for character in value):
        raise ValueError("canonical JSON rejects lone Unicode surrogates")

def _canonical_number(value:int|float)->str:
    number=float(value)
    if not math.isfinite(number): raise ValueError("canonical JSON rejects non-finite numbers")
    if number==0: return "0"
    rendered=repr(number).lower()
    if "e" not in rendered:
        return rendered.removesuffix(".0")
    mantissa,raw_exponent=rendered.split("e")
    exponent=int(raw_exponent)
    sign="-" if mantissa.startswith("-") else ""
    unsigned=mantissa.removeprefix("-")
    whole,fraction=(unsigned.split(".")+[""])[:2]
    digits=whole+fraction
    decimal_position=len(whole)+exponent
    if 1e-6<=abs(number)<1e21:
        if decimal_position<=0: return sign+"0."+"0"*(-decimal_position)+digits
        if decimal_position>=len(digits): return sign+digits+"0"*(decimal_position-len(digits))
        return sign+digits[:decimal_position]+"."+digits[decimal_position:]
    coefficient=digits[0]+(("."+digits[1:]) if len(digits)>1 else "")
    scientific_exponent=decimal_position-1
    return sign+coefficient+"e"+("+" if scientific_exponent>=0 else "")+str(scientific_exponent)

def _builder(value: dict[str,Any], arrays: tuple[str,...]=()) -> dict[str,Any]:
    result=deepcopy(value); result["oati_version"]="1.0"
    for key in arrays:
        if key in result: result[key]=list(result[key])
    return result
def create_passport(value): return _builder(value,("verification_methods",))
def create_mandate(value): return _builder(value,("actions","resources","counterparties","destinations"))
def create_envelope(value): return _builder(value)
def create_decision(value): return _builder(value,("reason_codes","obligations"))
def create_receipt(value): return _builder(value)

def project_public_record(source: dict[str,Any]) -> dict[str,Any]:
    projected={key:deepcopy(source[key]) for key in PUBLIC_FIELDS if key in source}
    allowed = PUBLIC_ATTRIBUTES_BY_TYPE.get(projected.get("type"))
    if allowed is None:
        raise ValueError("unsupported public record type")
    attributes = projected.get("public_attributes")
    if not isinstance(attributes, dict):
        raise ValueError("public_attributes must be an object")
    filtered: dict[str, str] = {}
    for name in allowed:
        if name not in attributes:
            continue
        value = attributes[name]
        if not isinstance(value, str):
            raise ValueError(f"public attribute {name} must be a string")
        if name in {"document", "public_key_jwk", "signed_document"}:
            try:
                document = json.loads(value)
            except json.JSONDecodeError as error:
                raise ValueError(f"public attribute {name} must contain valid JSON") from error
            def inspect(current: Any, depth: int = 0) -> None:
                if depth > 32:
                    raise ValueError(f"public attribute {name} exceeds the nesting limit")
                if isinstance(current, list):
                    for item in current: inspect(item, depth + 1)
                elif isinstance(current, dict):
                    for key, nested in current.items():
                        if key.lower() in SENSITIVE_PUBLIC_FIELDS:
                            raise ValueError(f"public attribute {name} contains forbidden field {key}")
                        inspect(nested, depth + 1)
                    if isinstance(current.get("kty"), str) and "d" in current:
                        raise ValueError(f"public attribute {name} contains private JWK material")
            inspect(document)
        filtered[name] = value
    projected["public_attributes"] = filtered
    required=("type","id","display_name","status","issuer","proof_status","public_attributes")
    if any(key not in projected for key in required): raise ValueError("registry source cannot produce a public record")
    return projected

@lru_cache(maxsize=1)
def _bundled_schemas() -> dict[str,dict[str,Any]]:
    return json.loads(files("oati").joinpath("_schema_bundle.json").read_text(encoding="utf-8"))

def _load_schema(source: Path|dict[str,dict[str,Any]], reference: str) -> dict[str,Any]:
    name=Path(reference).name
    return json.loads((source/reference).read_text()) if isinstance(source,Path) else source[name]

def validate_schema(name: str, value: Any, schema_root: Path|None=None) -> list[str]:
    source=Path(schema_root) if schema_root is not None else _bundled_schemas()
    if name not in SCHEMAS: raise KeyError(name)
    schema=_load_schema(source,SCHEMAS[name])
    codes:set[str]=set(); _validate(value,schema,schema,codes,source)
    return sorted(codes)

def _validate(value:Any,schema:dict[str,Any],root:dict[str,Any],codes:set[str],schema_source:Path|dict[str,dict[str,Any]])->None:
    if "$ref" in schema:
        reference=schema["$ref"]
        if reference.startswith("#/"):
            target=root
            for part in reference.removeprefix("#/").split("/"): target=target[part]
            _validate(value,target,root,codes,schema_source)
        else:
            external=_load_schema(schema_source,reference)
            _validate(value,external,external,codes,schema_source)
        return
    for branch in schema.get("allOf",[]): _validate(value,branch,root,codes,schema_source)
    if "oneOf" in schema:
        matches=0
        for branch in schema["oneOf"]:
            branch_codes:set[str]=set();_validate(value,branch,root,branch_codes,schema_source)
            if not branch_codes:matches+=1
        if matches!=1:codes.add("SCHEMA_ONEOF")
    if "if" in schema:
        condition_codes:set[str]=set();_validate(value,schema["if"],root,condition_codes,schema_source)
        if not condition_codes and "then" in schema:_validate(value,schema["then"],root,codes,schema_source)
    expected=schema.get("type")
    valid_type = expected is None or (expected=="object" and isinstance(value,dict)) or (expected=="array" and isinstance(value,list)) or (expected=="string" and isinstance(value,str)) or (expected=="integer" and isinstance(value,int) and not isinstance(value,bool)) or (expected=="number" and isinstance(value,(int,float)) and not isinstance(value,bool)) or (expected=="boolean" and isinstance(value,bool))
    if not valid_type: codes.add("SCHEMA_TYPE"); return
    if "const" in schema and value!=schema["const"]: codes.add("SCHEMA_CONST")
    if "enum" in schema and value not in schema["enum"]: codes.add("SCHEMA_ENUM")
    if isinstance(value,str):
        if len(value)<schema.get("minLength",0): codes.add("SCHEMA_MINLENGTH")
        if "maxLength" in schema and len(value)>schema["maxLength"]: codes.add("SCHEMA_MAXLENGTH")
        if "pattern" in schema and re.search(schema["pattern"],value) is None: codes.add("SCHEMA_PATTERN")
        if schema.get("format")=="date-time":
            try: datetime.fromisoformat(value.replace("Z","+00:00"))
            except ValueError: codes.add("SCHEMA_FORMAT")
        if schema.get("format")=="uri" and ":" not in value: codes.add("SCHEMA_FORMAT")
    if isinstance(value,list):
        if len(value)<schema.get("minItems",0): codes.add("SCHEMA_MINITEMS")
        if "maxItems" in schema and len(value)>schema["maxItems"]: codes.add("SCHEMA_MAXITEMS")
        if schema.get("uniqueItems") and len({canonical_json(item) for item in value})!=len(value): codes.add("SCHEMA_UNIQUEITEMS")
        if "items" in schema:
            for item in value: _validate(item,schema["items"],root,codes,schema_source)
    if isinstance(value,dict):
        for required in schema.get("required",[]):
            if required not in value: codes.add("SCHEMA_REQUIRED")
        properties=schema.get("properties",{})
        if schema.get("additionalProperties") is False and any(key not in properties for key in value): codes.add("SCHEMA_ADDITIONALPROPERTIES")
        for key,item in value.items():
            if key in properties: _validate(item,properties[key],root,codes,schema_source)
            elif isinstance(schema.get("additionalProperties"),dict): _validate(item,schema["additionalProperties"],root,codes,schema_source)
    if isinstance(value,(int,float)) and not isinstance(value,bool):
        if "minimum" in schema and value<schema["minimum"]:codes.add("SCHEMA_MINIMUM")
        if "maximum" in schema and value>schema["maximum"]:codes.add("SCHEMA_MAXIMUM")
