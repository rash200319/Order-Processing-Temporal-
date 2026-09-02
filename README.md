# Agentic Temporal Order Processing

This project demonstrates a natural-language order-intake agent connected to a durable Temporal fulfillment workflow.

The application accepts a message such as:

> Hi, I'm customer-123. Need 1 keyboard and 2 mice, ship whenever.

The agent interprets the message and recommends `PROCEED` or `REJECT`. If the recommendation is allowed by deterministic policy code, Temporal runs the fulfillment saga.

```text
Natural-language request
        |
        v
Temporal processOrder workflow
        |
        +--> interpretOrder activity
        |       |
        |       +--> classify
        |       +--> extract order
        |       +--> policy_check tool
        |       +--> decide PROCEED or REJECT
        |
        +--> REJECTED: stop with no side effects
        |
        +--> PROCEED and policy allowed:
                validate order
                reserve inventory
                charge payment
                create shipment
                send confirmation

                payment failure
                    |
                    +--> release inventory, then rethrow
```

## What this project demonstrates

- TypeScript and the Temporal TypeScript SDK
- LangChain tools and structured output
- LangGraph state and conditional edges
- Groq as an optional live LLM provider
- Deterministic business-policy code
- Temporal activity retries and compensation
- An offline mode that works without an API key

## The two hard boundaries

### Policy boundary: the model asks, code calculates

The agent has one tool: `policy_check`.

The tool calls `checkOrderPolicy()` in [`src/agent/policy.ts`](src/agent/policy.ts). That ordinary TypeScript function owns the catalog and policy rules:

- `keyboard` costs 50 and allows at most 10 units
- `mouse` costs 20 and allows at most 20 units
- Unknown SKUs are rejected
- Zero or negative quantities are rejected
- Banned catalog items are rejected

The model is not trusted to calculate these rules. For example, `keyboard x 1000` is rejected because the TypeScript policy function returns `allowed: false`.

If the live model does not call `policy_check`, the graph produces no policy result. The decision node then rejects the order.

### Execution boundary: Temporal owns side effects

The agent can only recommend `PROCEED` or `REJECT`. It has no payment, inventory, shipping, or confirmation tools.

Only the Temporal workflow calls these activities:

- `validateOrder`
- `reserveInventory`
- `chargePayment`
- `releaseInventory`
- `createShipment`
- `sendConfirmation`

Even if a model incorrectly recommends `PROCEED`, the workflow checks `policyResult.allowed` before starting fulfillment. A rejected order returns immediately and never charges payment.

## LangGraph implementation

The graph state is defined in [`src/agent/state.ts`](src/agent/state.ts):

```text
rawText
intent
order
policyResult
decision
reason
```

The graph in [`src/agent/graph.ts`](src/agent/graph.ts) uses these stages:

1. `classify` identifies `new_order`, `cancel`, or `other`.
2. `extract` extracts the customer ID and requested catalog items.
3. `policy_check` invokes the LangChain tool.
4. `decide` returns `PROCEED` only when an order exists and the policy result is allowed.

The offline graph uses deterministic extraction and decision logic. The live graph uses Groq for extraction and the final decision. Groq is also given the `policy_check` tool during the policy node. Prices are filled from deterministic catalog values, not from the model.

## Groq configuration

The live path uses [`@langchain/groq`](https://www.npmjs.com/package/@langchain/groq). Groq documents `GROQ_API_KEY` and `llama-3.3-70b-versatile` for LangChain usage. See the [Groq LangChain documentation](https://console.groq.com/docs/langchain).

Never commit an API key or paste it into source code.

In PowerShell, configure the current terminal session:

```powershell
$env:GROQ_API_KEY = "your-groq-api-key"
$env:GROQ_MODEL = "llama-3.3-70b-versatile"
```

When `GROQ_API_KEY` is present, `interpretOrder` uses the live Groq graph. Without it, the activity uses the offline graph.

To force offline behavior, even when a key is configured:

```powershell
$env:AGENT_MODE = "mock"
```

The API key is read only inside the activity process. The Temporal workflow does not import the graph or call Groq directly. This keeps LLM calls outside deterministic workflow code.

## Project structure

```text
src/
  types.ts         shared order and workflow result types
  agent/
    state.ts       LangGraph state types
    policy.ts      deterministic catalog and policy function
    tools.ts       LangChain policy_check tool
    graph.ts       offline and live LangGraph implementations
  activities.ts    interpretOrder and fulfillment activities
  workflows.ts     deterministic Temporal saga
  worker.ts        Temporal worker
  client.ts        sample workflow client
  mocha/
    policy.test.ts
    tools.test.ts
    graph.test.ts
    interpret-order.test.ts
    workflows.test.ts
    workflows-mocks.test.ts
```

## Installation

Install Node.js 22 or the version specified by `.nvmrc`, then install dependencies:

```powershell
npm install
```

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd` instead:

```powershell
npm.cmd install
```

## Run locally

Start a local Temporal development server in one terminal:

```powershell
temporal server start-dev
```

Start the worker in a second terminal:

```powershell
npm.cmd run start
```

Start the sample workflow in a third terminal:

```powershell
npm.cmd run workflow
```

The sample client sends a natural-language order. The worker runs `processOrder`, which first executes `interpretOrder`. With no Groq key, the offline graph is used. With `GROQ_API_KEY`, the live Groq graph is used.

## Run the tests

The complete suite can run offline:

```powershell
$env:AGENT_MODE = "mock"
npm.cmd test
```

The tests verify:

- Policy rejects `keyboard x 1000`
- Unknown SKUs are rejected
- The LangChain tool uses deterministic policy code
- The graph proceeds for a valid order
- The graph rejects oversized orders
- Missing extraction rejects without a policy result
- `interpretOrder` works as a Temporal activity
- A valid workflow runs the full saga
- Payment failure retries three times and releases inventory
- A policy rejection skips validation, reservation, payment, shipping, and confirmation

## Important implementation details

### Why is the LLM in an activity?

Temporal workflows must be deterministic and replayable. Network calls to an LLM are not deterministic workflow operations, so the LLM runs inside `interpretOrder`, a Temporal activity. The workflow receives the activity result and makes only deterministic control-flow decisions from it.

### Why does validation still run after policy checking?

Policy checking answers whether the requested products and quantities are allowed. `validateOrder` is the fulfillment-side validation step and calculates the total used by the payment activity. Both checks are intentional boundaries.

### Why is payment compensation in the workflow?

Payment failure is part of the durable fulfillment saga. Temporal retries `chargePayment` up to three times. If all attempts fail, the workflow calls `releaseInventory` and then rethrows the failure. The agent never performs or compensates payment.

## Troubleshooting

### `npm.ps1 cannot be loaded`

Use `npm.cmd` instead of `npm` in PowerShell.

### Temporal tests try to download the CLI

The test helper reuses a local Temporal CLI when it can find one. You can also specify it explicitly:

```powershell
$env:TEMPORAL_CLI_PATH = "C:\path\to\temporal.exe"
```

### Groq errors during tests

Force the offline path:

```powershell
$env:AGENT_MODE = "mock"
npm.cmd test
```

### No Groq API key

No key is required for tests or the mock demo. The live path is optional.
