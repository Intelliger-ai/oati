import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).parent / "src"))

from oati import (  # noqa: E402
    LookupClient,
    LookupError,
    ReplayCache,
    canonical_json,
    create_decision,
    create_envelope,
    create_mandate,
    create_passport,
    create_receipt,
    evaluate_authority,
    project_public_record,
    validate_schema,
    verify_document,
)


ROOT = Path(__file__).resolve().parents[2]


def fixture(path: str):
    return json.loads((ROOT / path).read_text())


class Response:
    def __init__(self, value=None, *, status=200, headers=None):
        self.value = value
        self.status = status
        self.headers = headers or {}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def read(self, *_):
        return json.dumps(self.value).encode()


class SDKParityTest(unittest.TestCase):
    def test_builders_canonical_json_and_public_projection(self):
        source = {"id": "oati:mandate:test:1", "actions": ["read"], "nested": {"z": 1, "a": 2}}
        built = create_mandate(source)
        built["actions"][0] = "write"
        self.assertEqual(source["actions"], ["read"])
        self.assertEqual(built["oati_version"], "1.0")
        builders = {
            "passport": create_passport,
            "mandate": create_mandate,
            "envelope": create_envelope,
            "decision": create_decision,
            "receipt": create_receipt,
        }
        for name, builder in builders.items():
            with self.subTest(builder=name):
                value = {"id": f"oati:{name}:test"}
                self.assertEqual(builder(value)["oati_version"], "1.0")
                self.assertNotIn("oati_version", value)
        self.assertEqual(canonical_json({"z": 1, "a": {"y": 2, "b": 3}}), '{"a":{"b":3,"y":2},"z":1}')

        private = fixture("conformance/privacy/private-registry-record.json")
        expected = fixture("conformance/privacy/expected-public-record.json")
        projected = project_public_record(private)
        self.assertEqual(projected, expected)
        self.assertNotIn("private_attributes", projected)

    def test_discovery_schemas_return_language_neutral_codes(self):
        cases = (
            ("serviceDiscovery", "service-valid.json", []),
            ("serviceDiscovery", "service-invalid.json", ["SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_ENUM", "SCHEMA_PATTERN", "SCHEMA_REQUIRED"]),
            ("profileDiscovery", "profile-valid.json", []),
            ("profileDiscovery", "profile-invalid.json", ["SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_FORMAT", "SCHEMA_PATTERN"]),
            ("wellKnown", "well-known-invalid.json", ["SCHEMA_ADDITIONALPROPERTIES", "SCHEMA_FORMAT", "SCHEMA_PATTERN", "SCHEMA_UNIQUEITEMS"]),
        )
        for schema, name, expected in cases:
            with self.subTest(name=name):
                self.assertEqual(validate_schema(schema, fixture(f"conformance/discovery/{name}")), expected)

    def test_all_published_examples_validate(self):
        examples = (
            ("proof", "proof.json"),
            ("issuer", "issuer.json"),
            ("verificationKey", "verification-key.json"),
            ("revocation", "revocation.json"),
            ("passport", "passport.json"),
            ("mandate", "mandate.json"),
            ("receipt", "receipt.json"),
            ("evaluationRequest", "evaluation-request.json"),
            ("evaluationResult", "evaluation-result.json"),
            ("publicRecord", "public-record.json"),
            ("envelope", "commerce/transaction-envelope.json"),
            ("decision", "decision.json"),
            ("wellKnown", "well-known-oati.json"),
            ("commerceOffer", "commerce/merchant-service-profile.json"),
            ("commerceMandate", "commerce/purchase-mandate.json"),
            ("commerceReceipt", "commerce/commerce-receipt.json"),
            ("rwaAsset", "rwa/asset-profile.json"),
            ("rwaStateClaim", "rwa/asset-state-claim.json"),
            ("rwaMandate", "rwa/mint-mandate.json"),
            ("rwaReceipt", "rwa/rwa-receipt.json"),
        )
        for schema, path in examples:
            with self.subTest(schema=schema):
                self.assertEqual(validate_schema(schema, fixture(f"examples/{path}")), [])

    def test_crypto_lifecycle_matrix_and_replay(self):
        cases = (
            ("es256-signed-envelope.json", "es256-trust-bundle.json", []),
            ("es256-tampered-envelope.json", "es256-trust-bundle.json", ["SIGNATURE_INVALID"]),
            ("signed-envelope.json", "issuer-chain-trust-bundle.json", []),
            ("signed-envelope.json", "issuer-chain-broken-bundle.json", ["ISSUER_NOT_TRUSTED"]),
            ("signed-envelope.json", "issuer-chain-cycle-bundle.json", ["ISSUER_NOT_TRUSTED"]),
            ("signed-envelope.json", "issuer-suspended-bundle.json", ["ISSUER_REVOKED"]),
            ("signed-envelope.json", "rotation-retired-bundle.json", []),
            ("signed-envelope.json", "rotation-retired-without-expiry-bundle.json", ["KEY_INVALID"]),
            ("signed-envelope.json", "rotation-proof-after-key-expiry-bundle.json", ["KEY_INVALID"]),
            ("signed-envelope.json", "revocation-key-target-bundle.json", ["KEY_REVOKED"]),
            ("signed-envelope.json", "revocation-issuer-target-bundle.json", ["ISSUER_REVOKED"]),
            ("signed-envelope.json", "revocation-document-suspended-bundle.json", ["DOCUMENT_REVOKED"]),
            ("signed-envelope.json", "revocation-future-effective-bundle.json", []),
            ("signed-envelope.json", "revocation-ambiguous-bundle.json", ["REVOCATION_UNAVAILABLE"]),
            ("signed-envelope.json", "revocation-unavailable-bundle.json", ["REVOCATION_UNAVAILABLE"]),
        )
        for document_name, bundle_name, expected in cases:
            with self.subTest(bundle=bundle_name):
                self.assertEqual(
                    verify_document(
                        fixture(f"conformance/crypto/{document_name}"),
                        fixture(f"conformance/crypto/{bundle_name}"),
                        "https://merchant.example",
                        "2026-07-27T12:02:00Z",
                        ReplayCache(),
                    ),
                    expected,
                )

        document = fixture("conformance/crypto/signed-envelope.json")
        bundle = fixture("conformance/crypto/trust-bundle.json")
        replay = ReplayCache()
        self.assertEqual(verify_document(document, bundle, "https://merchant.example", "2026-07-27T12:02:00Z", replay), [])
        self.assertEqual(verify_document(document, bundle, "https://merchant.example", "2026-07-27T12:02:00Z", replay), ["REPLAY_DETECTED"])

    def test_evaluator_runs_every_shared_vector(self):
        for vector in fixture("conformance/evaluator/cases.json")["cases"]:
            with self.subTest(name=vector["name"]):
                actual = evaluate_authority(vector["request"])
                expected = vector["expected"]
                self.assertEqual(actual["decision"], expected["decision"])
                self.assertEqual(actual["reason_codes"], expected["reason_codes"])
                if "next_usage" in expected:
                    self.assertEqual(actual.get("next_usage"), expected["next_usage"])

    def test_lookup_failover_rate_limit_state_and_discovery(self):
        calls = []

        def opener(request, timeout):
            calls.append((request.full_url, timeout))
            if "primary.test" in request.full_url:
                raise HTTPError(request.full_url, 503, "unavailable", {}, None)
            return Response(
                {"type": "agent", "id": "oati:agent:test", "status": "active", "issuer": "oati:issuer:test", "proof_status": "verified", "public_attributes": {}},
                headers={"X-RateLimit-Limit": "100", "X-RateLimit-Remaining": "73"},
            )

        client = LookupClient(
            ["https://primary.test/oati/v1", "https://secondary.test/oati/v1"],
            max_retries=0,
            opener=opener,
        )
        result = client.lookup_detailed("agent", "oati:agent:test")
        self.assertEqual(result.resolver_url, "https://secondary.test/oati/v1")
        self.assertEqual(result.rate_limit, {"limit": 100, "remaining": 73})
        self.assertEqual(len(calls), 2)

        invalid = LookupClient(
            ["https://resolver.test/oati/v1"],
            opener=lambda *_args, **_kwargs: Response(
                {"type": "key", "id": "oati:key:test", "status": "active", "issuer": "oati:issuer:test", "issued_at":"2026-01-01T00:00:00Z","expires_at":"2027-01-01T00:00:00Z","proof_status": "invalid", "public_attributes": {"controller":"oati:issuer:test","algorithm":"EdDSA","public_key_jwk":"{}"}}
            ),
        )
        self.assertEqual(invalid.lookup_state("key", "oati:key:test")["state"], "invalid_proof")

        discovery_payload=fixture("conformance/discovery/organisation-valid.json")
        discovery = LookupClient(
            ["https://resolver.test/oati/v1"],
            opener=lambda *_args, **_kwargs: Response(
                discovery_payload
            ),
        )
        discovered=discovery.discover_organisation("oati:org:merchant-b")
        self.assertEqual(discovered["services"][0]["record"]["id"], "oati:service:merchant-b:checkout")

        untrusted = LookupClient(
            ["https://resolver.test/oati/v1"],
            opener=lambda *_args, **_kwargs: Response(
                {
                    "organisation_id": "oati:org:test",
                    "services": [{"type": "service", "id": "oati:service:test:api", "status": "active", "issuer": "oati:issuer:test", "organisation_id": "oati:org:test", "proof_status": "unknown", "public_attributes": {}}],
                    "profiles": [],
                }
            ),
        )
        with self.assertRaisesRegex(LookupError, "untrusted discovery record"):
            untrusted.discover_organisation("oati:org:test")

        def federated_opener(request,timeout):
            if request.full_url=="https://merchant.example/.well-known/oati":return Response({"oati_version":"1.0","organisations":["oati:org:merchant-b"],"resolvers":["https://resolver.test/oati/v1"]})
            return Response(discovery_payload)
        federated=LookupClient(["https://unused.test/oati/v1"],opener=federated_opener).discover_federated("merchant.example","oati:org:merchant-b")
        self.assertEqual(federated["profiles"][0]["document"]["id"],"oati:profile:merchant-b:commerce-1")

    def test_lookup_etag_revalidation_and_negative_cache(self):
        responses = [
            Response(
                {"type": "agent", "id": "oati:agent:test", "status": "active", "issuer": "oati:issuer:test", "proof_status": "verified", "public_attributes": {}},
                headers={"ETag": '"agent-v1"'},
            ),
            Response(status=304),
        ]
        requests = []

        def opener(request, timeout):
            requests.append(request)
            return responses.pop(0)

        client = LookupClient(["https://resolver.test/oati/v1"], ttl=0, opener=opener)
        self.assertEqual(client.lookup_detailed("agent", "oati:agent:test").cache, "miss")
        self.assertEqual(client.lookup_detailed("agent", "oati:agent:test").cache, "revalidated")
        self.assertEqual(requests[1].get_header("If-none-match"), '"agent-v1"')

        misses = []

        def missing(request, timeout):
            misses.append(request.full_url)
            error = HTTPError(request.full_url, 404, "missing", {}, None)
            error.close()
            raise error

        negative = LookupClient(["https://resolver.test/oati/v1"], opener=missing)
        for _ in range(2):
            with self.assertRaises(LookupError) as error:
                negative.lookup("agent", "oati:agent:missing")
            self.assertEqual(error.exception.code, "LOOKUP_NOT_FOUND")
        self.assertEqual(len(misses), 1)


if __name__ == "__main__":
    unittest.main()
