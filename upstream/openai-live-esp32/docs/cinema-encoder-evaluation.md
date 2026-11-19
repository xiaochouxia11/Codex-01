# Cinema encoder evaluation

The recommended cinema pack now uses **POTION 4M / 128D**, keeping int8 storage
and performing query encoding and retrieval entirely on the ESP32. Existing
GloVe 50D packs still build and run. The initial comparison below motivated the
change; its raw candidate results are distinct from the deployed retrieval policy.

## Implemented deployment profile

- Pinned 29,528-token WordPiece vocabulary, per-row int8 quantization with float
  scales, normalized pooling and cached whole-word caption vectors. Weights and
  the tokenizer are hash checked before loading through safetensors.
- Bounded ASCII normalization: 2,048 input bytes, 100 characters per word,
  256 WordPiece tokens and eight distinct query terms. This English profile is
  intentionally not full Unicode BERT tokenization. Unknown-token vectors and
  special tokens are excluded; an incomplete WordPiece word is discarded whole.
- Document vectors combine the main visual sentence and its first two-sentence
  context. Titles, synopses, mood and sampled-frame boilerplate do not establish
  visible subjects. Quoted title-card text is excluded from word evidence.
- Top 64 pooled candidates are checked against up to 24 caption words, using
  whole-word vectors and learned term magnitudes. Important missing subjects
  cannot be averaged away. Combined score is 55% pooled cosine / 45% evidence;
  minimum 0.50, with additional pooled/word-evidence floors. These are calibrated
  heuristics, not probabilities. GloVe retains its separate 0.72 threshold.
- Negated/exclusion queries return an explicit unsupported result. Generic
  greetings and chatter do not select footage. Topic retention and recency
  penalties operate on the eligible matches, preserving existing user controls.
- The fixed-size C++ encoder allocates no heap memory. Weights and clip vectors
  are memory mapped from flash; movies remain on SD. The model is not loaded
  into PSRAM, and there is no runtime embedding API or laptop service.

## Validation and limits

The prepared 1,940-clip catalog retained every ordered media ID, filename, size
and SHA-256 when rebuilt. Python and the native C++ probe agreed on result IDs
for 73 diagnostic queries; maximum component error in query vectors was below
0.000001. These examples informed calibration and are not a held-out accuracy
benchmark. Synthetic regressions cover tokenizer bounds, incomplete words,
subword/cache separation, invalid input, exclusions, missing caption evidence,
threshold propagation, cancellation, media identity and legacy pack support.

`cat`, `cats`, `kitten`, `kittens`, `can you find a cat video`, and
`I really love cats` now retrieve the sampled one-kitten clip. `sports` and
`basketball` retrieve game footage. Smartphones, magic unicorns and nonsense
queries in this catalog return no confident match rather than a nearby guess.
Actual sampled frames were checked for the kitten, basketball and boat examples;
other diagnostic labels rely on the generated captions.

Limitations remain: “I have a pet cat at home” and some action-qualified queries
can return no match despite related footage. Word order, negation interpretation,
object counts and visual verification are not solved by this static encoder.
Conservative abstention is preferable to asserting a wrong subject. Descriptions
remain sampled-frame observations, not verification of every frame in a movie.

Use `tools/cinema_probe.cpp` against a generated pack to reproduce host C++
queries, or add `--encode` to inspect the vectors. On-device `cinema status`
reports encoder/dimensions, memory-mapped table sizes, query wall time, query
stack watermark and CPU windows; host timing is not an ESP32 latency claim.

## Initial comparison

An offline comparison used all 1,940 descriptions in one prepared catalog and
23 short/conversational queries. These are diagnostic examples, not a labeled
accuracy benchmark or an ESP32 performance measurement. Only short-clip visual
descriptions were embedded; source-film titles and synopses were excluded.

| Encoder | Dimensions | Raw int8 weight bytes | Status |
| --- | ---: | ---: | --- |
| Original catalog's GloVe vocabulary | 50 | 1,078,850 | Original baseline |
| [POTION 2M](https://huggingface.co/minishlab/potion-base-2M/tree/389b9f64be5aa4ae7a6bc6fe95ef20ce485ae5da) | 64 | 1,889,792 | Offline candidate |
| [POTION 4M](https://huggingface.co/minishlab/potion-base-4M/tree/9b3cff412d30be9ae8603fe10224c224f3401869) | 128 | 3,779,584 | Selected for deployment |

Sizes exclude tokenizer strings/indexes, quantization scales, clip vectors and
application memory. POTION uses a 29,528-token WordPiece vocabulary and static
token-vector pooling. The models are distributed under MIT terms; no weights
or tokenizer data are committed here. See the [Model2Vec implementation](https://github.com/MinishLab/model2vec).

For this catalog, a sampled-frame description of one tabby kitten was the
relevant target. Its source film is titled *Three Little Kittens*; that title
was not used for embedding or as evidence of three visible animals.

| Query | Current retrieval | POTION 2M top result | POTION 4M top result |
| --- | --- | --- | --- |
| `cat` | Does not surface that kitten clip | Other footage | Kitten clip |
| `cats` | No confident match | Other footage | Kitten clip |
| `kitten` | Kitten clip | Kitten clip | Kitten clip |
| `kittens` | Unrecognized vocabulary | Kitten clip | Kitten clip |
| `can you find a cat video` | Other matches | Kitten clip | Kitten clip |

The 4M candidate also put an actual basketball game first for `sports`,
`basketball`, and `I was watching basketball last night`. However, its result
for `I really love cats` was less reliable, and `show me a cat, not a dog`
failed. Static pooling still does not understand word order or negation.

A second family, [Static Retrieval MRL](https://huggingface.co/sentence-transformers/static-retrieval-mrl-en-v1/tree/f60985c706f192d45d218078e49e5a8b6f15283a),
was tested at its supported 64/128-dimensional truncations. Its 128D version
found the kitten for `cat`, `kitten` and `kittens`, but ranked a wildlife montage
ahead for `cats` and missed the natural find request. The 64D version also
missed `cat`/`cats`. These initial cases favor testing POTION 4M first; they do
not establish an overall accuracy ranking. Static Retrieval MRL has 30,522
token rows, needs 3,906,816 raw int8 weight bytes at 128D, and is Apache-2.0
licensed. Neither it nor its tokenizer is included in the repository.

Each POTION candidate was evaluated with its original float32 weights, then with
per-row symmetric int8 weights (preserving a float scale) and int8 clip
vectors. Queries and clips used the same encoder and normalized mean pooling,
without special tokens or unknown-token vectors. Top-one results were unchanged
across all 23 queries for each candidate. This small test suggests int8 storage
is not the main source of the observed failures. Cosine scores from these models
are not directly comparable to the existing combined ranking score.

## Ongoing evaluation

- Evaluate a broader labeled set containing short words, plurals, ordinary
  conversational requests, unavailable subjects, misleading text cards and
  source-film title distractors. Include held-out queries and inspect actual
  frames, not only generated captions.
- Compare concise visual-subject descriptions with full captions. A film title,
  quoted intertitle, mood, or count of sampled frames must not become evidence
  that an object is visibly present.
- Calibrate confidence and randomness for the new score distribution. Reusing
  the current 0.72 threshold or selecting every nearest neighbor is incorrect.
- Match tokenizer/normalization and quantization on the computer and ESP32,
  with regression tests for unknown inputs, bounds and cancellation.
- Measure flash size, working memory and query latency during simultaneous
  voice/video playback. These laptop results do not establish audio safety.
- Rebuild the model and clip vectors together, preserving media IDs and checking
  pack identity. Existing movie files need not be transcoded solely because
  the text encoder changes.

The proposed runtime still performs query embedding and similarity search on
the device. Model preparation and evaluation happen on a computer; deployment
would not require a laptop embedding service.
