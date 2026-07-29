from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from typing import Any

COMMERCE="https://specs.intelliger.ai/oati/profiles/commerce/v0.1"; RWA="https://specs.intelliger.ai/oati/profiles/rwa/v0.1"
def evaluate_authority(request:dict[str,Any])->dict[str,Any]:
    m=request["mandate"]; e=request["envelope"]; now=_time(request["evaluation_time"]); reasons:set[str]=set()
    if m.get("status")!="active": reasons.add("MANDATE_NOT_ACTIVE")
    if _time(m["not_before"])>now: reasons.add("MANDATE_NOT_YET_ACTIVE")
    if _time(m["expires_at"])<=now: reasons.add("MANDATE_EXPIRED")
    if e.get("mandate_id")!=m.get("id"): reasons.add("MANDATE_REFERENCE_MISMATCH")
    if e.get("agent_id")!=m.get("subject"): reasons.add("SUBJECT_MISMATCH")
    if e.get("action") not in m.get("actions",[]): reasons.add("ACTION_NOT_ALLOWED")
    _constraint(m,"resources",e.get("resource"),"RESOURCE_NOT_ALLOWED",reasons)
    if e.get("purpose")!=m.get("purpose"): reasons.add("PURPOSE_MISMATCH")
    _constraint(m,"counterparties",e.get("counterparty"),"COUNTERPARTY_NOT_ALLOWED",reasons); _constraint(m,"destinations",e.get("destination"),"DESTINATION_NOT_ALLOWED",reasons)
    if "profile" in e and e.get("profile")!=m.get("profile"): reasons.add("PROFILE_MISMATCH")
    if request.get("parent_mandate"): _child(m,request["parent_mandate"],request.get("delegation_depth",1),now,reasons)
    elif m.get("parent_mandate"): reasons.add("PARENT_MANDATE_REQUIRED")
    usage=_usage(request.get("usage",{})); delta=_consumption(request,m)
    _consumption_context(request,delta,reasons)
    _limits(m,usage,delta,reasons)
    if request.get("commerce") is not None or m.get("profile")==COMMERCE: _commerce(m,e,request.get("commerce"),usage,reasons)
    if request.get("rwa") is not None or m.get("profile")==RWA: _rwa(m,e,request.get("rwa"),usage,"minted_supply" in request.get("usage",{}),now,reasons)
    codes=sorted(reasons)
    return {"oati_version":"1.0","decision":"allow" if not codes else "deny","mandate_id":m["id"],"transaction_id":e["id"],"reason_codes":codes,"next_usage":_apply(usage,delta,request.get("rwa")) if not codes else usage}

def _child(c,p,depth,now,r):
    if c.get("parent_mandate")!=p.get("id"):r.add("PARENT_MANDATE_MISMATCH")
    if p.get("status")!="active" or _time(p["not_before"])>now or _time(p["expires_at"])<=now:r.add("PARENT_MANDATE_NOT_ACTIVE")
    d=p.get("delegation",{});
    if not d.get("allowed") or depth>d.get("max_depth",0):r.add("DELEGATION_NOT_ALLOWED")
    if not _subset(c.get("actions",[]),p.get("actions",[])):r.add("CHILD_ACTION_AMPLIFICATION")
    for field,code in (("resources","CHILD_RESOURCE_AMPLIFICATION"),("counterparties","CHILD_COUNTERPARTY_AMPLIFICATION"),("destinations","CHILD_DESTINATION_AMPLIFICATION")):
        if field in p and (field not in c or not _subset(c[field],p[field])):r.add(code)
    if c.get("purpose")!=p.get("purpose"):r.add("CHILD_PURPOSE_AMPLIFICATION")
    if _time(c["not_before"])<_time(p["not_before"]) or _time(c["expires_at"])>_time(p["expires_at"]):r.add("CHILD_TIME_AMPLIFICATION")
    if not _narrow(c.get("limits"),p.get("limits")):r.add("CHILD_LIMIT_AMPLIFICATION")
    if not _narrow(c.get("data_use"),p.get("data_use")):r.add("CHILD_DATA_USE_AMPLIFICATION")
    cd=c.get("delegation");
    if cd and cd.get("allowed") and cd.get("max_depth",0)>max(0,d.get("max_depth",0)-depth):r.add("CHILD_DELEGATION_AMPLIFICATION")
    if c.get("profile")!=p.get("profile"):
        if c.get("profile") or p.get("profile"):r.add("CHILD_PROFILE_AMPLIFICATION")
        return
    ce=c.get("extensions",{});pe=p.get("extensions",{});cc=ce.get("commerce");pc=pe.get("commerce")
    if pc and (not cc or not _same(cc,pc,("merchant_organisation_id","service_id","offer_id","currency","billing_model","terms_digest")) or Decimal(cc["max_unit_price"])>Decimal(pc["max_unit_price"]) or Decimal(cc["max_total"])>Decimal(pc["max_total"]) or cc["max_quantity"]>pc["max_quantity"]):r.add("CHILD_COMMERCE_AMPLIFICATION")
    cr=ce.get("rwa");pr=pe.get("rwa")
    if pr and (not cr or not _same(cr,pr,("asset_id","state_claim_id","network","token_contract","operation","unit")) or Decimal(cr["max_quantity"])>Decimal(pr["max_quantity"]) or cr["minimum_approvals"]<pr["minimum_approvals"] or not _subset(pr.get("required_roles",[]),cr.get("required_roles",[])) or pr.get("one_time") is True and cr.get("one_time") is not True):r.add("CHILD_RWA_AMPLIFICATION")

def _limits(m,u,d,r):
    if u["consumed"]:r.add("MANDATE_ALREADY_CONSUMED")
    if d["idempotency_key"] and d["idempotency_key"] in u["idempotency_keys"]:r.add("IDEMPOTENCY_REPLAY")
    limits=m.get("limits",{})
    if "max_calls" in limits and u["calls"]+d["calls"]>limits["max_calls"]:r.add("CALL_LIMIT_EXCEEDED")
    if m.get("profile") is None and "max_quantity" in limits and Decimal(u["quantity"])+Decimal(d["quantity"])>Decimal(str(limits["max_quantity"])):r.add("QUANTITY_LIMIT_EXCEEDED")
    if "max_total" in limits and d["amount"]!="0":
        currency=limits.get("currency")
        if currency and (d["currency"]!=currency or u["amount"]!="0" and u["currency"]!=currency):r.add("BUDGET_CURRENCY_MISMATCH")
        if Decimal(u["amount"])+Decimal(d["amount"])>Decimal(limits["max_total"]):r.add("BUDGET_EXCEEDED")
def _commerce(m,e,c,u,r):
    limits=m.get("extensions",{}).get("commerce")
    if not c or not limits:r.add("COMMERCE_CONTEXT_REQUIRED");return
    signed=e.get("extensions",{}).get("commerce")
    envelope_mismatch=bool(signed) and (e.get("resource")!=c.get("service_id") or e.get("counterparty")!=c.get("merchant_organisation_id") or not _mapped(signed,c,(("offer_id","offer_id"),("currency","currency"),("quantity","quantity"),("quoted_unit_price","unit_price"),("quoted_total","total_amount"),("idempotency_key","idempotency_key"),("terms_digest","terms_digest"))))
    for f,code in (("merchant_organisation_id","COMMERCE_MERCHANT_NOT_ALLOWED"),("service_id","COMMERCE_SERVICE_NOT_ALLOWED"),("offer_id","COMMERCE_OFFER_NOT_ALLOWED")):
        if c.get(f)!=limits.get(f):r.add(code)
    if c["currency"]!=limits["currency"] or u["amount"]!="0" and u["currency"]!=c["currency"]:r.add("COMMERCE_CURRENCY_MISMATCH")
    if Decimal(c["unit_price"])>Decimal(limits["max_unit_price"]):r.add("COMMERCE_UNIT_PRICE_EXCEEDED")
    if Decimal(c["total_amount"])!=Decimal(c["unit_price"])*c["quantity"]:r.add("COMMERCE_TOTAL_INVALID")
    if Decimal(u["amount"])+Decimal(c["total_amount"])>Decimal(limits["max_total"]):r.add("COMMERCE_BUDGET_EXCEEDED")
    if Decimal(c["quantity"])>Decimal(limits["max_quantity"]):r.add("COMMERCE_QUANTITY_EXCEEDED")
    if limits.get("terms_digest") and c.get("terms_digest")!=limits["terms_digest"]:r.add("COMMERCE_TERMS_MISMATCH")
    if c["idempotency_key"] in u["idempotency_keys"]:r.add("IDEMPOTENCY_REPLAY")
    if envelope_mismatch and not any(code.startswith("COMMERCE_") for code in r):r.add("COMMERCE_ENVELOPE_CONTEXT_MISMATCH")
def _rwa(m,e,c,u,has_supply,now,r):
    limits=m.get("extensions",{}).get("rwa")
    if not c or not limits:r.add("RWA_CONTEXT_REQUIRED");return
    signed=e.get("extensions",{}).get("rwa")
    if signed and (e.get("resource")!=c.get("asset_id") or not _same(signed,c,("asset_id","state_claim_id","network","token_contract","operation","unit","quantity"))):r.add("RWA_ENVELOPE_CONTEXT_MISMATCH")
    if not _same(c,limits,("asset_id","state_claim_id","network","token_contract","operation","unit")):r.add("RWA_TARGET_MISMATCH")
    if _time(c["claim_valid_until"])<=now:r.add("RWA_STATE_CLAIM_EXPIRED")
    if Decimal(u["quantity"])+Decimal(c["quantity"])>Decimal(limits["max_quantity"]):r.add("RWA_QUANTITY_EXCEEDED")
    resulting=Decimal(c["current_supply"])+Decimal(c["quantity"])
    if resulting>Decimal(c["reserve"]):r.add("RWA_RESERVE_EXCEEDED")
    if c.get("maximum_supply") and resulting>Decimal(c["maximum_supply"]):r.add("RWA_MAXIMUM_SUPPLY_EXCEEDED")
    if has_supply and Decimal(u["minted_supply"])!=Decimal(c["current_supply"]):r.add("RWA_SUPPLY_STATE_MISMATCH")
    if c["approval_count"]<limits["minimum_approvals"]:r.add("RWA_APPROVAL_THRESHOLD_NOT_MET")
    if any(role not in c["approval_roles"] for role in limits.get("required_roles",[])):r.add("RWA_REQUIRED_ROLE_MISSING")
    if limits.get("one_time") and u["consumed"]:r.add("MANDATE_ALREADY_CONSUMED")
def _consumption(req,m):
    c=req.get("commerce");w=req.get("rwa");supplied=req.get("consumption",{})
    d={"calls":supplied.get("calls",1),"amount":supplied.get("amount","0"),"currency":supplied.get("currency",""),"quantity":supplied.get("quantity","0"),"idempotency_key":supplied.get("idempotency_key",""),"consume":supplied.get("consume") is True}
    if c:d.update(amount=c["total_amount"],currency=c["currency"],quantity=str(c["quantity"]),idempotency_key=c["idempotency_key"])
    elif w:d["quantity"]=w["quantity"]
    d["consume"]=d["consume"] or bool(m.get("extensions",{}).get("rwa",{}).get("one_time") or m.get("limits",{}).get("one_time"))
    return d
def _consumption_context(req,effective,r):
    supplied=req.get("consumption")
    if not supplied:return
    fields=("amount","currency","quantity","idempotency_key") if req.get("commerce") else ("quantity",) if req.get("rwa") else ()
    constrained=list(fields)
    if effective["consume"] and supplied.get("consume") is False:constrained.append("consume")
    if any(field in supplied and supplied[field]!=effective[field] for field in constrained):r.add("CONSUMPTION_CONTEXT_MISMATCH")
def _usage(v):return {"calls":v.get("calls",0),"amount":v.get("amount","0"),"currency":v.get("currency",""),"quantity":v.get("quantity","0"),"consumed":v.get("consumed",False),"idempotency_keys":sorted(v.get("idempotency_keys",[])),"minted_supply":v.get("minted_supply","0")}
def _apply(u,d,rwa):
    n=deepcopy(u);n.update(calls=u["calls"]+d["calls"],amount=_fmt(Decimal(u["amount"])+Decimal(d["amount"])),currency=d["currency"] or u["currency"],quantity=_fmt(Decimal(u["quantity"])+Decimal(d["quantity"])),consumed=u["consumed"] or d["consume"]);n["idempotency_keys"]=sorted(u["idempotency_keys"]+([d["idempotency_key"]] if d["idempotency_key"] else []));n["minted_supply"]=_fmt(Decimal(rwa["current_supply"])+Decimal(rwa["quantity"])) if rwa else u["minted_supply"];return n
def _narrow(c,p):
    if p is None:return True
    if c is None:return False
    for k,v in p.items():
        if k not in c:return False
        x=c[k]
        if isinstance(v,(int,float)) and x>v:return False
        if isinstance(v,str):
            try:
                if Decimal(x)>Decimal(v):return False
            except: 
                if x!=v:return False
        elif isinstance(v,list) and not _subset(x,v):return False
        elif isinstance(v,dict) and not _narrow(x,v):return False
        elif not isinstance(v,(str,list,dict,int,float)) and x!=v:return False
    return True
def _constraint(o,f,a,code,r):
    if f in o and a not in o[f]:r.add(code)
def _subset(a,b):return all(x in b for x in a)
def _same(a,b,fields):return all(a.get(f)==b.get(f) for f in fields)
def _mapped(a,b,fields):return all(a.get(left)==b.get(right) for left,right in fields)
def _time(v):return datetime.fromisoformat(v.replace("Z","+00:00"))
def _fmt(v:Decimal):return format(v,"f")
