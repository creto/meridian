# Load measurements

These numbers were measured in-process on the form engine. They are not a k6 run against a deployed server. k6 is not installed here, so a public-fill or agent-submit rate is not claimed.

## Field engine

`runFieldBench` on the calculation and validation functions:

| Fields | Calculate | Validate |
|---:|---:|---:|
| 50 | 3.13 ms | 0.51 ms |
| 200 | 5.07 ms | 0.15 ms |

500 and 1000 field sizes are implemented by the same function and were not part of this timed sample.

## Grid window

`runGridBench` keeps a window of 19 rows for 100, 1,000, and 10,000 row lists. The window does not grow with the list.

## Local health route

`scripts/load-health.mjs` issued 100 concurrent reads of `GET /api/agent/v1/health/live` on this machine. All 100 returned OK in 3432 ms. The embedded database was already open, so each read logged that persistence was unavailable. Do not use 29 requests per second as a capacity number. k6 was not run.


## Not measured

- Concurrent submission create
- Agent validate over HTTP
- Public fill over HTTP
- Job status polling
- Workflow task completion under load

Do not treat the table above as a capacity number for a hosted deployment.
