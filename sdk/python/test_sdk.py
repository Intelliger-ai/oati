import base64,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/"src"))
from oati import LookupClient,ReplayCache,canonical_json,project_public_record,sign_document,validate_schema,verify_document

class SDKTest(unittest.TestCase):
    def test_public_projection_allows_each_type_and_rejects_nested_secrets(self):
        allowed={"organisation":"environment","issuer":"parent","key":"algorithm","agent":"protocols","passport":"subject","mandate":"subject","receipt":"outcome","revocation":"target","service":"document","profile":"document"}
        for record_type,attribute in allowed.items():
            value="{}" if attribute=="document" else "public"
            source={"type":record_type,"id":f"oati:{record_type}:privacy","display_name":record_type,"status":"active","issuer":"oati:issuer:privacy","proof_status":"verified","public_attributes":{attribute:value,"customer_payload":"secret"}}
            self.assertEqual(project_public_record(source)["public_attributes"],{attribute:value})
        source={"type":"service","id":"oati:service:privacy","display_name":"service","status":"active","issuer":"oati:issuer:privacy","proof_status":"verified","public_attributes":{"document":json.dumps({"metadata":{"api_key":"must-not-leak"}})}}
        with self.assertRaisesRegex(ValueError,"forbidden field api_key"):project_public_record(source)
        source["public_attributes"]["document"]=json.dumps({"key":{"kty":"OKP","d":"private"}})
        with self.assertRaisesRegex(ValueError,"private JWK material"):project_public_record(source)

    def test_canonical_json_rfc8785_edges(self):
        self.assertEqual(canonical_json({"one":1.0,"negative":-0.0,"fixed":1e20,"scientific":1e21}),'{"fixed":100000000000000000000,"negative":0,"one":1,"scientific":1e+21}')
        self.assertEqual(canonical_json({"דּ":7,"😀":6,"€":5}),'{"€":5,"😀":6,"דּ":7}')
        with self.assertRaises(ValueError):canonical_json({"invalid":"\ud800"})

    def test_schema_validation_enforces_numeric_size_and_one_of(self):
        proof={"type":"OatiJwsProof2026","cryptosuite":"eddsa-jcs-2022","algorithm":"EdDSA","created":"2026-07-27T12:00:00Z","expires":"2026-07-27T12:05:00Z","verification_method":"oati:key:test:1","proof_purpose":"assertionMethod","audience":[],"nonce":"proof-nonce-00001","signature":"abc..def"}
        self.assertIn("SCHEMA_ONEOF",validate_schema("proof",proof))
        service=json.loads((Path(__file__).resolve().parents[2]/"conformance/discovery/service-valid.json").read_text())
        service["endpoints"][0]["priority"]=65536
        self.assertIn("SCHEMA_MAXIMUM",validate_schema("serviceDiscovery",service))
    def test_sign_and_verify_ed25519(self):
        root=Path(__file__).resolve().parents[2]
        private=json.loads((root/"conformance/crypto/ed25519-private.jwk").read_text())
        bundle=json.loads((root/"conformance/crypto/trust-bundle.json").read_text())
        document=json.loads((root/"conformance/crypto/unsigned-envelope.json").read_text())
        signed=sign_document(document,private,"oati:key:conformance:ed25519-1","https://merchant.example","python-proof-nonce-0001","2026-07-27T12:01:00Z","2026-07-27T12:06:00Z")
        self.assertEqual(verify_document(signed,bundle,"https://merchant.example","2026-07-27T12:02:00Z",ReplayCache()),[])
    def test_sign_and_verify_es256(self):
        from cryptography.hazmat.primitives.asymmetric import ec
        private_key=ec.generate_private_key(ec.SECP256R1());numbers=private_key.private_numbers();public=numbers.public_numbers
        encode=lambda value:base64.urlsafe_b64encode(value.to_bytes(32,"big")).decode().rstrip("=")
        private={"kty":"EC","crv":"P-256","x":encode(public.x),"y":encode(public.y),"d":encode(numbers.private_value)}
        document={"oati_version":"1.0","id":"oati:tx:test:es256","agent_id":"oati:agent:test","issued_at":"2026-07-27T12:00:00Z"}
        signed=sign_document(document,private,"oati:key:test:es256","https://merchant.example","python-es256-nonce-001","2026-07-27T12:00:00Z","2026-07-27T12:05:00Z")
        signature=base64.urlsafe_b64decode(signed["proof"]["signature"].split("..")[1]+"==")
        self.assertEqual(len(signature),64)
        bundle={"trust_anchors":["oati:issuer:test"],"keys":[{"id":"oati:key:test:es256","controller":"oati:agent:test","issuer":"oati:issuer:test","algorithm":"ES256","public_key_jwk":{"kty":"EC","crv":"P-256","x":private["x"],"y":private["y"]},"status":"active","valid_from":"2026-07-27T11:00:00Z","valid_until":"2026-07-27T13:00:00Z","proof_status":"verified"}],"issuers":[],"revocations":[]}
        self.assertEqual(verify_document(signed,bundle,"https://merchant.example","2026-07-27T12:01:00Z",ReplayCache()),[])
        mismatched={**private,"x":encode((public.x+1)%(2**256))}
        with self.assertRaisesRegex(ValueError,"do not match"):sign_document(document,mismatched,"oati:key:test:es256","https://merchant.example","python-es256-nonce-002","2026-07-27T12:00:00Z","2026-07-27T12:05:00Z")
    def test_lookup_client_caches_typed_record(self):
        calls=[]
        class Response:
            status=200;headers={"ETag":"test-v1","X-RateLimit-Remaining":"59"}
            def __enter__(self):return self
            def __exit__(self,*_):pass
            def read(self,*_):return b'{"type":"agent","id":"oati:agent:test","display_name":"Test","status":"active","issuer":"oati:issuer:test","proof_status":"verified","public_attributes":{}}'
        def opener(request,timeout):calls.append((request.full_url,timeout));return Response()
        client=LookupClient(["https://resolver.test/oati/v1"],opener=opener)
        self.assertEqual(client.lookup_detailed("agent","oati:agent:test").cache,"miss")
        self.assertEqual(client.lookup_detailed("agent","oati:agent:test").cache,"hit")
        self.assertEqual(len(calls),1)
    def test_lookup_revocation_by_target(self):
        calls=[]
        class Response:
            status=200;headers={}
            def __enter__(self):return self
            def __exit__(self,*_):pass
            def read(self,*_):return b'{"type":"revocation","id":"oati:revocation:test:1","status":"active","issuer":"oati:issuer:root","proof_status":"verified","public_attributes":{"target":"oati:issuer:test","revocation_status":"good"}}'
        def opener(request,timeout):calls.append(request.full_url);return Response()
        client=LookupClient(["https://resolver.test/oati/v1"],opener=opener)
        record=client.lookup_revocation_by_target("oati:issuer:test")
        self.assertEqual(record["id"],"oati:revocation:test:1")
        self.assertIn("type=revocation&target=oati%3Aissuer%3Atest",calls[0])
    def test_all_profile_examples_validate(self):
        root=Path(__file__).resolve().parents[2]
        fixtures=(("commerceOffer","commerce/merchant-service-profile.json"),("commerceMandate","commerce/purchase-mandate.json"),("commerceReceipt","commerce/commerce-receipt.json"),("rwaAsset","rwa/asset-profile.json"),("rwaStateClaim","rwa/asset-state-claim.json"),("rwaMandate","rwa/mint-mandate.json"),("rwaReceipt","rwa/rwa-receipt.json"))
        for schema,path in fixtures:self.assertEqual(validate_schema(schema,json.loads((root/"examples"/path).read_text())),[],schema)
if __name__=="__main__":unittest.main()
