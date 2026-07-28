import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/"src"))
from oati import LookupClient,ReplayCache,sign_document,validate_schema,verify_document

class SDKTest(unittest.TestCase):
    def test_sign_and_verify_ed25519(self):
        root=Path(__file__).resolve().parents[2]
        private=json.loads((root/"conformance/crypto/ed25519-private.jwk").read_text())
        bundle=json.loads((root/"conformance/crypto/trust-bundle.json").read_text())
        document=json.loads((root/"conformance/crypto/unsigned-envelope.json").read_text())
        signed=sign_document(document,private,"oati:key:conformance:ed25519-1","https://merchant.example","python-proof-nonce-0001","2026-07-27T12:01:00Z","2026-07-27T12:06:00Z")
        self.assertEqual(verify_document(signed,bundle,"https://merchant.example","2026-07-27T12:02:00Z",ReplayCache()),[])
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
