# Independent-review release gate operations

Current state: **release blocked**. The repository has not completed the required independent cryptographic and protocol security review.

## GitHub enforcement

Repository administrators must create a ruleset for tags matching `v*` that:

1. restricts tag creation and update to designated release maintainers;
2. requires the `Release security gate / Cryptographic and protocol review` workflow;
3. prevents force updates and deletion;
4. does not grant routine bypass permission;
5. records any emergency administrator bypass in the security incident log.

Every artifact-publishing workflow must call the reusable gate as a prerequisite:

```yaml
jobs:
  security-review:
    uses: ./.github/workflows/release-security-gate.yml

  publish:
    needs: security-review
    # package or container publication steps
```

Publishing credentials must exist only in the `publish` job/environment, not in the gate. Protect that environment with the same distinct release-maintainer approval recorded in the review status.

## Closing the gate

1. Generate the clean public source manifest at the initial reviewed commit.
2. Record the private platform commit in the reviewer’s confidential scope.
3. Move status to `in-review`; keep production claim eligibility false.
4. Record findings without publishing embargoed exploit details.
5. Remediate and move status to `remediation`.
6. Run every conformance and package matrix on the exact remediated source inventory.
7. Obtain an independent retest and immutable final, retest, and disposition report hashes.
8. Set `status: completed` only after separate security and release approvals.
9. Run `node scripts/check-independent-review.mjs --require-completed` from a clean checkout.
10. Create the protected release tag only after the required workflow is green.

Any subsequent change to a manifest-covered file makes the content digest disagree and closes the release gate. The reviewer must confirm whether the change needs a focused retest or a new full review. When the validity date passes, change the status to `expired` and restore developer-preview release blocking until re-review.

## Prohibited evidence

Do not place private platform source, credentials, private keys, undisclosed findings, customer information, or confidential technical reports in this public repository. Public evidence may be an executive report when the full technical report must remain under controlled disclosure, but the reviewer and maintainers must retain the exact hashed technical artifact.
