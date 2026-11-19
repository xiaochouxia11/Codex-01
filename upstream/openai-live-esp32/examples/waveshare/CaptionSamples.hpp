#pragma once

// Local display diagnostics only; these samples are never sent to the API.
namespace live_caption_view {
constexpr const char *glyph_samples[] = {
    "He says, “I’d like a goldfish.”\n"
    "‘Do you want an aquarium?’\n"
    "“I don’t care what star sign it is.”",
    "Café, crème brûlée, naïve.\n"
    "Ångström, Łódź, Œuvre.\n"
    "“Quotes” ‘apostrophes’ …\n"
    "en–dash em—dash −minus\n"
    "€10 · £5 · 20 °C → 68 °F",
    "Non-breaking: a\u00a0b a\u202fb\n"
    "Hyphens: a‐b a‑b\n"
    "Guillemets: «oui» ‹yes›\n"
    "Prime: 5′ 10″ · 50% ± 1\n"
    "São Paulo, Zürich, François.\n"
    "Fallback: 🐟 cafe\u0301",
};
} // namespace live_caption_view
