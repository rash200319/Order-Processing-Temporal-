# Temporal Order Processing

An order-fulfillment workflow built with Temporal and TypeScript. It coordinates validation, inventory reservation, payment, shipping, and customer confirmation while providing retries and compensation when payment fails.

## Workflow

```text
Validate order
      |
Reserve inventory
      |
Charge payment ---- failure ---> Release inventory
      |
Create shipment
      |
Send confirmation
```

The external systems are represented by in-memory activities so the example can run locally without credentials or databases.

## Run locally

1. Install the [Temporal CLI](https://docs.temporal.io/cli).
2. Start a local Temporal Server:

   ```bash
   temporal server start-dev
   ```

3. Install dependencies and start the worker:

   ```bash
   npm install
   npm run start.watch
   ```

4. In another terminal, start an order workflow:

   ```bash
   npm run workflow
   ```

5. Run the workflow and activity tests:

   ```bash
   npm test
   ```

## Temporal concepts demonstrated

- Durable workflow orchestration
- Activity retries with bounded attempts
- Compensation for a failed payment
- Workflow testing with real and mocked activities
- Business IDs used as workflow IDs
