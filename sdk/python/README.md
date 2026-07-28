# OATI Python SDK

Dependency-free Python 3.11+ implementation of OATI canonical JSON, core builders, published-schema validation, public lookup, public projection, Ed25519 signing and verification, replay protection, and deterministic authority evaluation for core, Commerce, and RWA Mandates.

```bash
python3 -m pip install -e sdk/python
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v sdk/python/test_sdk.py
python3 sdk/python/conformance.py --output conformance/reports/python-sdk-0.1.0-dev.0.json
```

The conformance command reads the language-neutral `conformance/suite-v0.1.json`; it does not maintain Python-specific vectors.
