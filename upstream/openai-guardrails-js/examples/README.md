# Guardrails TypeScript Examples

This directory contains TypeScript examples demonstrating various features of the Guardrails SDK.

## Examples

#### 1. `hello_world.ts`
Basic interactive chatbot demonstrating drop-in replacement for OpenAI client with guardrails.

#### 2. `azure_example.ts`
Azure OpenAI integration with guardrails using the Azure-specific client.

**Azure Setup:**
1. Create an `.env` file in the examples directory.
2. Fill in your Azure OpenAI credentials:
   - `AZURE_ENDPOINT`
   - `AZURE_API_KEY`
   - `AZURE_API_VERSION`
   - `AZURE_DEPLOYMENT`


#### 3. `local_model.ts`
Local model integration using Ollama with guardrails validation.

**Ollama Setup:**
1. Install and run Ollama:
```bash
ollama serve
ollama pull gemma3
```

#### 4. `streaming.ts`
Demonstrates streaming responses with real-time guardrail validation.

#### 5. `suppress_tripwire.ts`
Shows how to run guardrails without throwing exceptions when violations occur.

## Disclaimers

Please note that Guardrails may use Third-Party Services such as the [Presidio open-source framework](https://github.com/microsoft/presidio), which are subject to their own terms and conditions and are not developed or verified by OpenAI.

Developers are responsible for implementing appropriate safeguards to prevent storage or misuse of sensitive or prohibited content (including but not limited to personal data, child sexual abuse material, or other illegal content). OpenAI disclaims liability for any logging or retention of such content by developers. Developers must ensure their systems comply with all applicable data protection and content safety laws, and should avoid persisting any blocked content generated or intercepted by Guardrails.
