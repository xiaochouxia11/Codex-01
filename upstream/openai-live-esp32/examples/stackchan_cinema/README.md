# StackChan memory cinema

> **Experimental example. Not officially supported by OpenAI.**

This is a separate firmware example from the [basic StackChan voice app](../stackchan/README.md).
It shares the SDK, camera, audio, display and motion drivers, and replaces captions
with silent archival film. The basic app does not build the cinema engine or index.

| Behavior | What drives the screen |
| --- | --- |
| Visual subconscious | Short conversation excerpts select related clips, with weighted randomness among close matches and a penalty for recent clips and source films. |
| Time-travel camera | The Responses backend takes a fresh `capture_photo`, describes its visible subject to `set_visual_scene`, and queues an archival counterpart. |
| Wander (idle dreams) | The device follows precomputed neighbors with occasional exploration, entirely offline. |
| Requested clip | The backend searches/inspects the local catalog and queues a specific clip. The requested clip plays completely, then selection stays with that subject until a new user topic or timeout. |

These are evocative associations, not factual evidence or a live camera feed.
Movies have **no audio track or audio playback path**. Voice sessions use the
existing Live SDK and start when you press Start. Tap a movie to reveal Start/Stop;
controls hide after a short interval. A camera photo still appears for two seconds.
Stopping a session shows usage briefly before dreaming resumes. `cinema off`
restores the caption interface.

All automatic mode/topic changes and explicit clip requests wait for the current
clip to finish. The ending frame must be displayed for a full frame interval; a
new cue only replaces the pending selection. This adds up to the current clip's
remaining duration to a new request. Photo/usage overlays pause and resume the
clip; explicitly turning cinema off still takes effect immediately. Slow SD reads
may hold the final frame longer, and overloaded playback may skip intermediate
frames to stay in real time.

The cinema personality is relaxed, warm and slightly dreamy: unhurried speech,
gentle pauses and occasional sensory imagery, with clear, direct answers for
practical questions. It keeps the `marin` voice. Each successful connection queues
one short welcome: "Hey. I'm here. Where shall we wander today?" The model may
paraphrase the wording, and speech remains interruptible. This is sent as frontend
spoken context, without a camera action or Responses call. Edit
[`CinemaPersonality.hpp`](main/CinemaPersonality.hpp) to adjust the frontend and
backend prompts or greeting. Other device examples keep their existing behavior.

## Talk about the video library

Try “Find a video of a boat and play it,” “What is in this clip?” or “What kinds
of films do you have?” The Responses backend calls tools on the ESP32:

| Tool | Behavior |
| --- | --- |
| `search_videos` | Local semantic/keyword search. `play: true` with a nonempty query and `offset: 0` queues the best available match and holds the matching subject. `play: false` lists up to eight matches in pages of three; an empty query browses. Returns clip IDs, source-film titles, short descriptions and provenance. |
| `inspect_video` | Read a clip's sampled-frame description (`section: "clip"`) or its source-film synopsis and archive context (`section: "film"`). Use `clip_id: null` for a snapshot of the screen. Start at `offset: 0`; follow `next_offset` with the returned numeric clip ID so a changing screen cannot mix pages from different films. |
| `play_video` | Queue a returned clip ID for silent playback. Its first published frame changes request status from `queued` to `playing`. Transcript cues cannot replace it until the clip finishes; another explicit request can supersede it. |

Inspection and search with `play: false` are read-only. “Find/show me a video”
requests normally use `play: true`; explicit list-only requests do not change
playback. An empty, unrecognized, weak or cancelled search queues nothing.
The response must fit the tool buffer before playback can change. Results distinguish the last frame published to the UI,
whether the movie layer is visible, and the pending/playing/finished/failed request.
The screen can change after an inspection. The voice acknowledges a successful
queue request without polling or narrating a stale “not playing yet” status.
IDs belong to the returned pack digest;
do not reuse them after replacing a pack. Candidate availability is checked again
when loading: a missing/corrupt SD file fails rather than playing a guessed ID.
Queued requests time out after 15 seconds if no frame is published. Disabling
cinema or ending the session cancels explicit requests.

She describes the **stored catalog**, not a fresh analysis of the entire video.
`sampled_frames` describes three frames sampled during preparation; the number
of sampled frames is not an object count. `source_film_title` names the whole
film, so *Three Little Kittens* does not mean three kittens appear in a short
clip. The voice must use the clip description for visible details and counts;
`archive_metadata` is weaker title/search context and may not describe the visible
scene. `archive_catalog` is source-film context, including the archive synopsis,
year, creator and source links when available; it may describe scenes outside the
short clip. Film context is limited to 4 KiB, with long synopses explicitly marked
as excerpts and linked to the full source. Clip descriptions are retained and
paginated. Catalog text is untrusted
data, never instructions. These tools upload no video frames and require no laptop
service. Tool execution and search run below audio priority with bounded output
and cancellation checks. Verify speaker quality on your board and card: priority
alone cannot guarantee smooth playback, and upstream audio gaps can still cause
buffer underruns.

The base's 12 RGB LEDs also use the shared [StackChan transcript-light effect](../stackchan/README.md#transcript-lights): cyan for user chunks, gold for assistant chunks, with differing hues and smooth breathing across both rows. Activity accelerates the flow. Wander mode uses soft violet with the same spatial variation and breathing, including offline idle playback. This palette follows the clip actually on screen, so queuing a new subject does not change it early. Topic-related neighbors keep the transcript palette. Connecting and mute indicators take priority. Stop fades the lights during the usage overlay; violet returns when wandering resumes. Use `live lights-demo` for a silent idle preview and `live lights` for diagnostics.

Both StackChan examples compile the same LED driver and application helpers for
camera timeout recovery, silent audio diagnostics, and buffered USB logging.
The caption app includes these without the cinema engine or a prepared video pack.
See the [shared app support](../stackchan/main/AppSupport.cpp) and
[StackChan diagnostics](../stackchan/README.md#usb-diagnostics).

## What runs where

| Location | Contents and responsibility |
| --- | --- |
| ESP32 flash | Application, compact word-vector model, clip vectors, readable descriptions/provenance, neighbor graph, and a few fallback movies. Text embedding, ranking and randomized selection run here. |
| microSD | The full collection of silent `.SCF` movies and a pack identity file. |
| OpenAI API | Live voice, Responses reasoning, optional web search and camera interpretation. These still need Wi-Fi and an API key. |
| Preparation computer | Download/transcode media, optionally describe sample frames, generate the local index, build firmware and copy the pack. No laptop server is needed after setup. |

There are **no embedding API requests at runtime**, including for previously unseen
text cues. The recommended encoder is **POTION 4M, 128-dimensional**, with pinned
WordPiece vocabulary, per-row int8 weights and float scales. A bounded English/ASCII
profile runs identically in Python and C++; it does not implement full Unicode
BERT normalization. The original GloVe 50D pack path remains supported.

The first visual sentence and first two caption sentences supply document vectors.
Source-film titles, synopses, mood, boilerplate and quoted intertitle text are not
used as subject evidence. Pooled similarity retrieves 64 candidates; whole-word
caption evidence then reranks them, preserving learned term weights. This avoids
mistaking a shared subword such as `##cycle` for evidence that a bicycle is a
motorcycle. POTION uses its own calibrated 0.50 combined-score minimum, a 0.20
pooled-cosine floor, and explicit word-evidence checks; the legacy GloVe threshold
remains 0.72. No subject-specific aliases or handpicked clip IDs are needed.
Every automatic selection subtracts a recency penalty from the relevance score:
up to 0.08 for the same clip, or 0.02 for another clip from the same source film.
The penalty fades linearly over the last eight played clips; repeated occurrences
use the strongest penalty rather than accumulating. Fresh transcript cues do not
reset this history. Repeated matches with the same anchor and eligible set refresh
the topic without cancelling pending SD reads. The first selection for a new cue uses the best adjusted
score; later selections add weighted randomness. Both stay within 0.06 of the
best **unpenalized** relevance score, so novelty cannot introduce an unrelated
clip. Each eligible clip plays once per active topic. Rephrasing preserves which clips
have been seen; selection does not widen to weaker matches just to add novelty.
When no fresh confident match remains, playback continues through the original
subject clip's semantic neighbors. These are looser visual associations, not
additional confident search results. Selection stays anchored to that original
clip rather than wandering from neighbor to neighbor; it excludes the anchor
and current clip, prefers neighbors outside the eight-clip history, and retains
recency penalties when all neighbors have been seen. This avoids both an
immediate loop and a frozen screen during a long conversation. Explicit `play_video`
requests can replay the requested ID, and library search reports unpenalized
relevance scores. A good
conversation match stays available for three minutes after the latest matching
user cue. Unseen user text takes precedence over assistant text at each sample,
so a short utterance is not skipped when a reply starts before the next tick. Weak transcript fragments or unknown words retain that topic without
extending its deadline or interrupting a pending clip. Assistant narration cannot
replace an active user-selected subject. A confident new user cue replaces the pending topic immediately and becomes
visible after the current clip finishes; after expiry the assistant can seed a new subject. Search-and-play
holds its matching set for three minutes, including prefetch after the first
requested clip. An exact-ID request keeps a matching active topic, or anchors associations to that
clip if no matching context exists. With no recent good match, playback returns to dreaming through the
neighbor graph. Ending the session or disabling cinema clears the topic.

Explicit `set_visual_scene` and USB cues retain their 45-second lifetime and
20-second priority over transcript updates. An unsuccessful scene cue clears
the old topic instead of presenting it as the new request's result. A failed
library search does not change playback.

This small static model handles concrete English subjects better than long or
abstract requests. It does not understand word order, counts or negation.
Explicit exclusions such as “cat without dogs” are rejected; tools should use a
concise positive visual subject. Unknown/generic text can return no match, and
complex natural phrases can still miss relevant clips. A match is caption-based,
not proof that every frame shows the subject. The
[encoder evaluation](../../docs/cinema-encoder-evaluation.md) documents the
implementation, evidence and limitations. Model and clip vectors must be
regenerated together. The optional laptop inspector uses the same encoder.

## Prepare a pack

Use Python 3.11+, `ffmpeg`/`ffprobe`, and the pinned pretrained model files. Keep generated
assets, keys, and firmware outside version control:

```sh
python3 -m venv "$HOME/.cache/cinema-tools"
"$HOME/.cache/cinema-tools/bin/pip" install -r tools/cinema-requirements.txt
export PATH="$HOME/.cache/cinema-tools/bin:$PATH"
model_dir="$HOME/.cache/potion-base-4M"
model_revision=9b3cff412d30be9ae8603fe10224c224f3401869
mkdir -p "$model_dir"
for model_file in model.safetensors tokenizer.json README.md; do
  curl -fL --retry 3 \
    "https://huggingface.co/minishlab/potion-base-4M/resolve/$model_revision/$model_file" \
    -o "$model_dir/$model_file"
done
python tools/sample_cinema_catalog.py \
  --output "$HOME/.cache/cinema-sample" --count 250
python tools/prepare_stackchan_cinema.py \
  --output "$HOME/.cache/stackchan-cinema" \
  --sample "$HOME/.cache/cinema-sample/sample.json" \
  --potion-model-dir "$model_dir" \
  --key-file "$HOME/.config/openai-live-esp32/api-key" \
  --fallback-count 2
```

The preparer verifies all three pinned SHA-256 hashes before parsing the model
with `safetensors`; it does not execute downloaded model code or load pickle.
Hashes and the deployment profile are recorded in `encoder.json`; the upstream
model card is retained as `MODEL-CARD.md`. Weights/tokenizer files stay outside Git.
For legacy packs, use `--word-vectors /path/to/glove.6B.zip` instead; the original
GloVe SHA-256 check and 50D generation path are unchanged. Do not mix models and
clip vectors from different packs. Allow roughly 4.5 MB of flash for the POTION
word table and strings, plus clip vectors, metadata, app and fallback movies;
reduce `--fallback-count` if your firmware partition is too small.

The sampler enumerates the full film catalog in Cova's
[Moving Image Archive](https://www.movingimagearchive.com/), reconciles every film's
clip count with the reported total, and draws unique global clip positions with
equal probability. Films with more clips occupy proportionally more positions;
there is no topic, duration, aspect ratio, color, or per-film-cap preference in
this raw draw. The browse clip feed is not used because its offset is capped.

`population.json` saves the catalog snapshot; `sample.json` saves the random seed,
positions and resolved clip IDs. Only the sampled films' clip lists need fetching.
Reruns reuse the saved seed and cached pages; increasing `--count` preserves the
earlier draw prefix. Use a new output directory for a fresh population snapshot.
`--seed` allows explicit reproduction and `--plan-only` records positions without
resolving media metadata. Incomplete pages, duplicate IDs, inconsistent counts,
or changed source/count totals fail instead of producing a partial sample.
The archive has no immutable snapshot API: the final catalog recheck detects
count changes, but cannot rule out same-count replacements during collection.

Preparation makes up to eight-second, 320 × 240, 12 fps excerpts containing baseline
JPEG frames. Audio is removed. Each clip is bounded to 2 MiB and 144 frames.
The raw sample remains intact. Provenance, download/format failures and caption
usability can exclude clips from the playable pack; every exclusion is recorded,
and **excluded draws are not replaced**. Consequently, the raw draw is uniform
over the catalog; the playable subset is conditional on those checks. Random
sampling reflects the archive's actual subject mix and does not balance topics.

By default, three sampled frames are described with `gpt-4.1-mini` (override with
`--caption-model`). **This preparation step makes paid API calls**. The model can
exclude unusable scenes; sampling is not a human review of every frame. Use
`--metadata-only` to avoid caption calls and derive coarse descriptions from archive
source titles (and search context in curated mode) instead. This is less precise
and is labeled in the catalog.
Embedding itself is always local. A later normal preparation run upgrades cached
coarse descriptions to visual captions.

For a larger random library, increase the sampler's `--count` and prepare that
complete draw in a new output directory. Optionally set preparation `--workers`
(1–8). Source-page requests are rate limited; downloads, captions, and selections
are cached. The older curated mode remains available by omitting `--sample` and
setting preparation `--count` and `--pages-per-theme` (up to 50). It searches visual
themes and limits repeated source films, so it is **not a uniform random sample**.
Use `--existing` to regenerate a selected library's model/index without network calls.
This also generates `CinemaMetadata.hpp` for library tools. Older packs must be
regenerated before building this example. Adding the readable catalog alone does
not change movie bytes or clip IDs; the firmware checks that both generated
headers have matching pack identity and clip count.

To add archive synopses to an older pack, run this **after** preparation finishes:

```bash
python tools/enrich_cinema_catalog.py --output "$HOME/.cache/stackchan-cinema"
```

It fetches missing source-film pages once per film and regenerates readable
metadata. It makes no OpenAI API calls and changes neither movie bytes nor the
embedding/index identity. Rebuild and flash afterward; the SD movies need no
recopy for a metadata-only update. New preparations retain the archive synopsis
automatically. Film context is separate from clip embeddings to avoid matching
an eight-second clip to a subject visible only elsewhere in its source film.

The generated `pack/` includes:

| File | Purpose |
| --- | --- |
| `CINEMA3/*/*.SCF` | Movies for the card, grouped into directories of at most 256 clips. |
| `CINEMA3/INDEX.ID` | Pack identity checked against firmware. |
| `catalog.json` | Captions, moods, source links, time windows, hashes and provenance. |
| `encoder.json`, `embeddings.json` | Local encoder and clip vectors for inspection/reproduction. |
| `CinemaAssets.hpp` | Generated model, index and neighbor graph compiled into firmware. |
| `CinemaMetadata.hpp` | Readable UTF-8 catalog compiled into flash, bound to the same pack identity. No SD reads are needed for descriptions. |
| `fallback.bin` | A small diverse set of flash-resident movies. |
| `raw-sample.json`, `sampling-population.json`, `selection-report.json` | Random-mode draw, population snapshot and explicit exclusions. |

An expanded 1,916-clip collection spans 734 source films and uses about 964 MB for
movies; its application image is about 5 MiB of the 12 MiB partition. The initial
250-clip sample spans 177 source films and uses about 124 MB for movies.
At that average size, a 16 GB card has room for roughly 30,000 clips; actual capacity
depends on clip lengths, compression, filesystem overhead and other files. The
current index is limited to 30,000 clips and firmware must fit its 12 MiB app
partition. Preparation and transfer time are practical limits too. Generated media,
model weights, and indexes are not included in this source repository.

## Build, flash and load the card

First follow [StackChan preparation](../stackchan/README.md#build-and-flash) for
private key/Wi-Fi configuration and ESP-IDF. Use this separate example directory:

```sh
export STACKCHAN_CINEMA_PACK="$HOME/.cache/stackchan-cinema/pack"
idf.py -C examples/stackchan_cinema reconfigure build
idf.py -C examples/stackchan_cinema -p YOUR_PORT flash
```

Use a FAT32 microSD card. The app never formats it; exFAT is not enabled. Insert it
with the device powered off. Copy the whole `pack/CINEMA3` directory to the card's
root using a card reader, or leave the card in the StackChan and transfer over USB:

```sh
python tools/load_stackchan_cinema.py --port YOUR_PORT \
  --pack "$STACKCHAN_CINEMA_PACK"
```

The USB loader stops the session and cinema, verifies the firmware/pack identity,
then writes numbered movie files with per-file CRC readback verification. Completed
files are verified and skipped on a resumed run. Explicit completed transfer
failures are retried at most twice; malformed acknowledgements stop the copy.
If every payload block was acknowledged but the final receipt is missing, the
loader first confirms that the device is back at its command parser and has the
same pack identity, then rechecks that file's CRC (also at most two retries).
Missing payload acknowledgements are not retried automatically. The pack identity is committed
last, once all expected files are present. Restart the device after completion to
initialize the complete playable set. A card reader is faster for large collections.
The loader only writes inside `CINEMA3` (`CINEMA` for older format-2 packs);
keep unrelated files outside those directories.
Do not remove the card or power while a write is active.

An absent card or mismatched identity uses the small flash fallback. Missing,
corrupt or oversized movies are disabled for that boot. Changing a library requires
matching firmware and card files; run `reconfigure` when changing the pack path so
CMake does not retain the previous include directory. Copying arbitrary MP4 files
is not supported.
NVS and factory servo calibration retain their existing offsets. The basic app is
still built independently with `idf.py -C examples/stackchan build`.

CoreS3 shares GPIO35 between LCD D/C and SD MISO. The storage adapter locks the
display, drains pending transfers, changes pin direction for small SD reads, then
restores it before unlocking. A 4 KiB internal DMA buffer enables multi-sector
reads; copying directly into PSRAM makes ESP-IDF fall back to individual sector
commands. The copy into PSRAM happens after releasing the display lock, with a
yield between chunks. FAT/directory caches use internal RAM and 512-byte SD
sectors. Display completion uses the board support package's normal LVGL path.
Playback uses two compressed-movie PSRAM buffers
and two RGB565 buffers, validates frame bounds/CRC and decoded dimensions, and
skips missed frames. A background worker prefetches the next movie while the
current one plays; a slow read holds the final frame until the spare is ready.
Completed topic clips do not automatically replay. When the relevant set is
exhausted, anchored neighbor footage keeps playing; a new subject or
an explicit replay request takes priority.
The extra buffer costs at most 2 MiB of PSRAM. Video work and pending SD reads pause
before camera capture and stays hidden during its preview; a transient camera
timeout gets one bounded retry. Usage temporarily hides playback too. Background search runs at low priority with
periodic yields, separate from audio processing.

The prefetch worker runs on the other CPU core below microphone/speaker priority.
Busy display/SD access retries in place, preserving partial reads and checking
cancellation between attempts. Exhausting its bounded wait stays retryable; it
does not disable a valid movie. Actual file/CRC/decode failures still fail closed.

Format 3 groups movies into small directories under `CINEMA3`, avoiding long FAT
directory scans while holding the display lock. After regenerating an older pack,
flash its matching firmware and copy the new pack. The loader retains legacy flat
`CINEMA` files and their identity for rollback; they do not participate in the new
directory lookups. Legacy headers and the laptop tools still support flat packs.

Cinema requests a 240 ms PCM priming reserve to tolerate arrival bursts; other
examples retain the SDK's 120 ms default. This adds initial/rebuffer latency and
cannot repair missing upstream audio. Touch controls appear on touch-down, with
a 16 ms input polling period while cinema is enabled. `cinema status` reports
per-window maximum touch polling gaps, SD lock/open/read holds, display flush
submission time, and CPU samples
to distinguish card/display contention from audio/network issues.

## Diagnostics and optional laptop inspection

```text
cinema status
cinema cue ocean waves
cinema off
cinema on
cinema sd info
cinema trace on
cinema trace dump
cinema trace off
cinema trace clear
live quiet on
live quiet off
```

Run SD commands after `live stop` and `cinema off`.

`cinema status` reports available clips, rendered frames, timing, decode errors,
local-query failures, transition gaps, final-frame hold and associative-playback states, remaining topic hold time
and CPU use between samples.
Tracing is off by default. `cinema trace on` keeps the latest 64 cue/ranking and
actual-playback records in RAM (including transcript excerpts and whether a weak
cue retained the previous topic); `dump` explicitly
prints them over USB. Nothing is written to the card or sent to a server. Use
`off` to stop recording and `clear` to erase records; reboot also clears them.
`live quiet on` zeroes microphone
and speaker PCM for unattended tests while retaining the audio pipeline. It is
off by default and resets on reboot. Existing `live` diagnostics remain available.

The optional viewer is an inspection aid, not a runtime dependency:

```sh
python tools/stackchan_cinema.py "$STACKCHAN_CINEMA_PACK" --query "ocean waves"
python tools/stackchan_cinema.py "$STACKCHAN_CINEMA_PACK"
```

The latter binds to <http://127.0.0.1:8878/> and provides silent playback, local
search and source attribution. Neither command needs an API key.

## Provenance

[Third-party notices](../../THIRD_PARTY_NOTICES.md#optional-stackchan-cinema-assets)
identify POTION model MIT terms, the legacy GloVe PDDL data license, archive sources
and host-tool dependencies.
The preparer requires each film source to explicitly report `public_domain` and
retains its provenance. Inspect that record and original source before distributing
a pack or firmware. The repository's Apache-2.0 license covers project code, not an
independent guarantee about every downloaded movie or model asset.
