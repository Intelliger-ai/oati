# Independent cryptographic review gate

Status: **awaiting independent review**. This directory is an audit-readiness package, not an audit report and not evidence of independent review.

OATI may leave cryptographic developer-preview status only after an organizationally independent protocol and implementation security team reviews a pinned commit, produces a written report, and retests remediations. The review must not be performed solely by Intelliger, an OATI contributor, an AI agent, or the implementation author.

## Required engagement

The commissioned scope is defined in [`REQUEST_FOR_REVIEW.md`](REQUEST_FOR_REVIEW.md), the security model in [`THREAT_MODEL.md`](THREAT_MODEL.md), and exact source targets in [`REVIEW_TARGETS.md`](REVIEW_TARGETS.md). The private OATI Platform repository has a companion scope for KMS/Transit issuance, tenant isolation, approval segregation, registry publication, and revocation operations. Reviewers require read access to the pinned private commit under the agreed disclosure terms.

The reviewer must deliver:

1. protocol-design and domain-separation analysis;
2. manual implementation review of every in-scope language;
3. independent known-answer, negative, differential, and malformed-input tests;
4. findings with severity, exploit scenario, affected commit/file, and remediation;
5. review of canonicalization, signature encoding, key validation, trust chains, revocation, time, audience, and replay behavior;
6. a remediation retest against a second pinned commit;
7. a public report, or a public executive report plus privately retained technical report when responsible disclosure requires delay.

## Release gate

`production_security_claim_eligible` remains `false` until all of these are true:

- `review_commit`, reviewer organization, dates, and stable report URLs are recorded;
- no critical or high findings remain open;
- every medium finding is fixed or has a documented, reviewer-accepted disposition;
- remediation is independently retested;
- cross-language conformance passes on the remediated commit;
- the cryptographic profile and implementation limitations are updated from the actual report;
- maintainers approve the claim change separately from the implementation author.

Run `node scripts/check-independent-review.mjs` to validate this gate. CI runs the same check. A passing gate only checks required evidence metadata; it does not independently validate the review’s quality.

## Reproducible handoff

The review must target a clean, immutable Git commit. From a clean checkout:

```sh
git rev-parse HEAD
node scripts/security-review-manifest.mjs > oati-security-review-manifest.json
./conformance/run-all.sh
(cd sdk/typescript && pnpm test)
(cd sdk/go && go test ./...)
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v sdk/python/test_sdk.py
(cd cli && go test ./...)
```

The manifest records the commit, file paths, byte sizes, and SHA-256 hashes for the in-scope public material. The handoff must also record the private platform commit separately; no private source or credentials belong in the public manifest.
