# OATI Python SDK

Python 3.11+ implementation of OATI canonical JSON, core builders, published-schema validation, public lookup, public projection, Ed25519/ES256 signing and verification, issuer-chain and key-lifecycle validation, fail-closed revocation, replay protection, and deterministic authority evaluation for core, Commerce, and RWA Mandates. ES256 signing uses the maintained `cryptography` backend for secure nonce generation and P-256 operations.

```bash
python3 -m pip install -e sdk/python
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s sdk/python -p 'test*.py' -v
python3 sdk/python/conformance.py --implementation-version 0.2.0-dev.0 --output conformance/reports/python-sdk-0.2.0-dev.0-suite-0.4.0.json
```

The wheel and source distribution include the complete schema bundle; validation never reaches back into a repository checkout. Verify either artifact from a fresh virtual environment with:

```bash
cd sdk/python
python -m pip install build
python scripts/generate_schema_bundle.py
python scripts/test_package_install.py --format wheel
python scripts/test_package_install.py --format sdist
```

The conformance command reads the language-neutral `conformance/suite-v0.4.json`; it does not maintain Python-specific vectors.
The SDK test suite also exercises these capabilities directly, including resolver failover, ETag revalidation, negative caching, typed lookup states, rate-limit metadata, discovery trust checks, every shared evaluator case, and the complete shared crypto lifecycle matrix.

Use `LookupClient.lookup_revocation_by_target()` when resolving current revocation state from a governed target ID rather than a revocation-record ID.

`LookupClient.discover_organisation()` and `discover_federated()` return validated `{record, document}` pairs and fail closed on expired, mismatched, unverified, or unpublished Profile references. Lookup states use the portable names `found`, `not_found`, `invalid_proof`, `unknown`, and `unavailable`.
