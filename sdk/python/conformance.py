#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/"src"))
from oati import ReplayCache,canonical_json,evaluate_authority,project_public_record,validate_schema,verify_document

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--suite",default="../../conformance/suite-v0.3.json");parser.add_argument("--output");parser.add_argument("--implementation-version",default="0.1.0-dev.0");args=parser.parse_args()
    suite_path=(Path(__file__).parent/args.suite).resolve();base=suite_path.parent;suite=expand_suite(load(suite_path),suite_path,set());results=[]
    for case in suite["cases"]:
        try: outcome,codes=execute(case,base); expected=case["expected"];status="pass" if outcome==expected["outcome"] and sorted(set(codes))==sorted(expected["codes"]) else "fail"
        except Exception as error: outcome,codes,status="fail",["RUNNER_ERROR",str(error)],"fail"
        results.append({"id":case["id"],"category":case["category"],"status":status,"expected_outcome":case["expected"]["outcome"],"observed_outcome":outcome,"codes":sorted(set(codes))})
    passed=sum(item["status"]=="pass" for item in results);report={"report_version":"1.0","suite_version":suite["suite_version"],"standard_version":suite["standard_version"],"implementation":{"name":"intelliger-oati","version":args.implementation_version,"language":"python"},"summary":{"total":len(results),"passed":passed,"failed":len(results)-passed},"results":results};rendered=json.dumps(report,indent=2)+"\n"
    if args.output:Path(args.output).write_text(rendered)
    else:print(rendered,end="")
    raise SystemExit(1 if passed<len(results) else 0)
def execute(case,base):
    value=load(base/case["input"]);operation=case["operation"]
    if operation=="schema":
        codes=validate_schema(case["schema"],value);return ("fail" if codes else "pass",codes)
    if operation=="canonicalize":return ("pass",[]) if canonical_json(value)==(base/case["auxiliary"]).read_text().rstrip() else ("fail",["CANONICALIZATION_MISMATCH"])
    if operation.startswith("verify"):
        bundle=load(base/case["auxiliary"]);cache=ReplayCache();options=case["options"]
        if operation=="verify-replay":
            first=verify_document(value,bundle,options["audience"],options["now"],cache)
            if first:return "fail",first
        codes=verify_document(value,bundle,options["audience"],options["now"],cache);return ("fail" if codes else "pass",codes)
    if operation=="evaluate-suite":
        vectors=[item for item in value["cases"] if item["name"] in case.get("options",{}).get("case_names",[item["name"] for item in value["cases"]])]
        for vector in vectors:
            actual=evaluate_authority(vector["request"]);expected=vector["expected"]
            if actual["decision"]!=expected["decision"] or actual["reason_codes"]!=expected["reason_codes"] or "next_usage" in expected and actual["next_usage"]!=expected["next_usage"]:return "fail",["EVALUATOR_MISMATCH:"+vector["name"]]
        return "pass",[]
    if operation=="public-project":return ("pass",[]) if project_public_record(value)==load(base/case["auxiliary"]) else ("fail",["PUBLIC_PROJECTION_MISMATCH"])
    if operation=="discover":return discover(value,load(base/case["auxiliary"]),case.get("options",{}),base)
    raise ValueError(operation)
def discover(response,federation,options,base):
    organisation=options.get("organisation_id");now=options.get("now","")
    if organisation not in federation.get("organisations",[]):return "fail",["FEDERATION_ORGANISATION_MISMATCH"]
    if federation.get("expires_at") and federation["expires_at"]<=now:return "fail",["FEDERATION_EXPIRED"]
    if response.get("organisation_id")!=organisation or not isinstance(response.get("services"),list) or not isinstance(response.get("profiles"),list):return "fail",["DISCOVERY_ORGANISATION_MISMATCH"]
    profiles={record.get("id") for record in response["profiles"]}
    for kind,records in (("service",response["services"]),("profile",response["profiles"])):
        for record in records:
            if record.get("type")!=kind or record.get("status")!="active" or record.get("proof_status")!="verified":return "fail",["DISCOVERY_UNTRUSTED_RECORD"]
            if record.get("organisation_id")!=organisation:return "fail",["DISCOVERY_ORGANISATION_MISMATCH"]
            try:document=json.loads(record.get("public_attributes",{}).get("document",""))
            except (TypeError,ValueError):return "fail",["DISCOVERY_DOCUMENT_INVALID"]
            if document.get("id")!=record.get("id") or document.get("organisation_id")!=record.get("organisation_id") or document.get("issuer")!=record.get("issuer") or document.get("status")!=record.get("status"):return "fail",["DISCOVERY_DOCUMENT_MISMATCH"]
            if record.get("expires_at","") and record["expires_at"]<=now or document.get("expires_at","") and document["expires_at"]<=now:return "fail",["DISCOVERY_EXPIRED"]
            codes=validate_schema("serviceDiscovery" if kind=="service" else "profileDiscovery",document,base.parent/"schemas")
            if codes:return "fail",codes
            if kind=="service" and any(profile not in profiles for profile in document["accepted_profiles"]):return "fail",["DISCOVERY_PROFILE_NOT_FOUND"]
    return "pass",[]
def load(path):return json.loads(path.read_text())
def expand_suite(suite,path,visited):
    if path in visited:raise ValueError(f"cyclic conformance suite inheritance at {path}")
    visited.add(path)
    if "extends" not in suite:return suite
    parent_path=path.parent/suite["extends"];parent=expand_suite(load(parent_path),parent_path,visited)
    if parent["standard_version"]!=suite["standard_version"]:raise ValueError("inherited suite standard version mismatch")
    ids={case["id"] for case in parent["cases"]}
    if any(case["id"] in ids for case in suite["cases"]):raise ValueError("duplicate inherited conformance case")
    return {**suite,"cases":[*parent["cases"],*suite["cases"]]}
if __name__=="__main__":main()
