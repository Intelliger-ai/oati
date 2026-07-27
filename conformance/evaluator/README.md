# Deterministic evaluator conformance

`cases.json` is the shared language-neutral suite for core authority, delegation, consumption, Commerce, and RWA decisions. Every case supplies the evaluation time and prior usage explicitly and declares the exact sorted reason codes and proposed next usage.

Implementations must not mutate the request or persist `next_usage`. The application commits the decision and state transition atomically after any required action succeeds.
