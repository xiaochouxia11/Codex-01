# Exceptions: TypeScript

Exception classes raised by `@openai/guardrails`.

```typescript
export class GuardrailError extends Error {}

export class GuardrailTripwireTriggered extends GuardrailError {
  public readonly guardrailResult: GuardrailResult;
}

export class GuardrailConfigurationError extends GuardrailError {}

export class GuardrailNotFoundError extends GuardrailError {}

export class GuardrailExecutionError extends GuardrailError {
  public readonly cause?: Error;
}
```

- `GuardrailTripwireTriggered`: thrown when a guardrail tripwire fires. Contains the `guardrailResult`.
- `GuardrailConfigurationError`: configuration issues (invalid spec, missing params).
- `GuardrailNotFoundError`: referenced guardrail name not registered.
- `GuardrailExecutionError`: runtime failure within a guardrail (optional `cause`).

For the full source, see [src/exceptions.ts](https://github.com/openai/openai-guardrails-js/blob/main/src/exceptions.ts) in the repository.


