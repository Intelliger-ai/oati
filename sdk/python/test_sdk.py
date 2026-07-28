import json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/"src"))
from oati import ReplayCache,sign_document,verify_document

class SDKTest(unittest.TestCase):
    def test_sign_and_verify_ed25519(self):
        root=Path(__file__).resolve().parents[2]
        private=json.loads((root/"conformance/crypto/ed25519-private.jwk").read_text())
        bundle=json.loads((root/"conformance/crypto/trust-bundle.json").read_text())
        document=json.loads((root/"conformance/crypto/unsigned-envelope.json").read_text())
        signed=sign_document(document,private,"oati:key:conformance:ed25519-1","https://merchant.example","python-proof-nonce-0001","2026-07-27T12:01:00Z","2026-07-27T12:06:00Z")
        self.assertEqual(verify_document(signed,bundle,"https://merchant.example","2026-07-27T12:02:00Z",ReplayCache()),[])
if __name__=="__main__":unittest.main()
