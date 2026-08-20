// Pin the process to UTC before anything parses or formats a date.
//
// `new Date("2024-01-01T00:00:00")` — an ISO string with a time but no offset —
// is interpreted in the HOST's timezone, so the same request resolves eight
// hours apart on a +08:00 dev machine versus a UTC container. Date-only strings
// ("2024-01-01") are always UTC per spec, so without this the two formats
// disagree with each other as well. Pinning here makes both deterministic and
// makes them agree.
//
// Hardcoded rather than read from .env on purpose: the whole point is to
// decouple behaviour from the deployment environment, and a knob would just
// keep the hazard alive. Explicit offsets from clients ("...+08:00") are still
// honoured and converted correctly — this only settles the ambiguous forms.
process.env.TZ = "UTC";

export const isProduction = process.env.NODE_ENV === "production";
