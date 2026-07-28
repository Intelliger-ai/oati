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

- the independent organization attests its independence and discloses conflicts and subcontractors;
- initial-review, remediated-public, and private-platform commits are pinned;
- the reproducible public source-manifest digest and SHA-256 hashes for every report are recorded;
- no critical or high findings remain open;
- every medium finding is fixed or has a documented, reviewer-accepted disposition;
- remediation is independently retested;
- cross-language conformance passes on the remediated commit;
- the review has not expired and its validity period is no longer than 366 days;
- the cryptographic profile and implementation limitations are updated from the actual report;
- separate security and release maintainers approve the claim change after review completion.

Ordinary development CI runs `node scripts/check-independent-review.mjs`. This permits an honest pre-review state only while the public developer-preview warnings and `production_security_claim_eligible: false` remain in place. Release automation runs:

```sh
node scripts/check-independent-review.mjs --require-completed
```

Release mode additionally reproduces the security-sensitive source manifest and requires it to match the independently reviewed digest. The dedicated reusable workflow is [`.github/workflows/release-security-gate.yml`](../../.github/workflows/release-security-gate.yml). Any package, container, tag, or GitHub Release publishing workflow must depend on that workflow. Repository administrators must also configure the `v*` tag ruleset/required workflow described in [`RELEASE_GATE.md`](RELEASE_GATE.md); CI files alone cannot prevent an administrator from manually bypassing GitHub.

A passing gate verifies required evidence metadata and source identity. It does not independently prove the reviewer’s competence, report quality, organizational independence, or accuracy; those remain human governance responsibilities.

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

The manifest records the commit, file paths, byte sizes, individual SHA-256 hashes, and one stable `content_sha256` over the ordered file inventory. Store that content digest in `status.json` after remediation retest. The handoff must also record the private platform commit separately; no private source or credentials belong in the public manifest.
