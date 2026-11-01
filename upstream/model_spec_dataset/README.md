# OpenAI Model Spec Eval Dataset
A public-domain dataset of prompts and scenarios for evaluating compliance with the [OpenAI Model Spec as of 2025-12-18](https://model-spec.openai.com/2025-12-18.html).

This dataset is intended to be run with the [Model Spec Eval harness](https://github.com/openai/model_spec_evals).

The dataset currently contains 596 prompts. However, 9 of them cannot be run through the public OpenAI API, and will be skipped by the above harness,
because those examples involve system messages while the API only effectively supports developer messages  (in the Inspect chat message
format, they are "system" messages but they are sent as "developer" messages to the OpenAI API for newer models like o-series and GPT-5.X).

Each prompt contains some metadata:
- `target` is the **rubric** mentioned in [Introducing Model Spec Evals](https://alignment.openai.com/model-spec-evals/) which tells the grader the crux of the prompt and what constitutes compliance.
- `focus_id` corresponds to the focus area found in the `model_spec.md` file in the form `[^xxxx]`. This is the focus directly tested by the prompt.
- `section_id` corresponds to the id of the immediate section in which the `focus_id` is found.
- `sections` corresponds to the chain of sections containing `section_id`.
- `skip` (if present) indicates whether the prompt should be skipped for technical reasons, as mentioned above.
