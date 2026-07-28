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

def canonical_json(value: Any) -> str:
    def check(item: Any) -> None:
        if item is None or isinstance(item,(str,bool,int)): return
        if isinstance(item,float):
            if not math.isfinite(item): raise ValueError("canonical JSON rejects non-finite numbers")
            return
        if isinstance(item,list):
            for child in item: check(child)
            return
        if isinstance(item,dict):
            if not all(isinstance(key,str) for key in item): raise TypeError("JSON object keys must be strings")
            for child in item.values(): check(child)
            return
        raise TypeError(f"not a JSON value: {type(item).__name__}")
    check(value)
    return json.dumps(value,ensure_ascii=False,separators=(",",":"),sort_keys=True)

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
    expected=schema.get("type")
    valid_type = expected is None or (expected=="object" and isinstance(value,dict)) or (expected=="array" and isinstance(value,list)) or (expected=="string" and isinstance(value,str)) or (expected=="integer" and isinstance(value,int) and not isinstance(value,bool)) or (expected=="number" and isinstance(value,(int,float)) and not isinstance(value,bool)) or (expected=="boolean" and isinstance(value,bool))
    if not valid_type: codes.add("SCHEMA_TYPE"); return
    if "const" in schema and value!=schema["const"]: codes.add("SCHEMA_CONST")
    if "enum" in schema and value not in schema["enum"]: codes.add("SCHEMA_ENUM")
    if isinstance(value,str):
        if len(value)<schema.get("minLength",0): codes.add("SCHEMA_MINLENGTH")
        if "pattern" in schema and re.search(schema["pattern"],value) is None: codes.add("SCHEMA_PATTERN")
        if schema.get("format")=="date-time":
            try: datetime.fromisoformat(value.replace("Z","+00:00"))
            except ValueError: codes.add("SCHEMA_FORMAT")
        if schema.get("format")=="uri" and ":" not in value: codes.add("SCHEMA_FORMAT")
    if isinstance(value,list):
        if len(value)<schema.get("minItems",0): codes.add("SCHEMA_MINITEMS")
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
