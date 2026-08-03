/** Max distinct paths tracked per session before we stop adding new ones (bounds memory). */
export const MAX_TRACKED_PATHS = 500

/** Max sessions tracked at once. Sessions are normally released on session.idle;
 *  this bounds memory if a session is abandoned without going idle. */
export const MAX_TRACKED_SESSIONS = 100

/** Max distinct `subagent_type` buckets per session. `subagent_type` is model-supplied
 *  and therefore unbounded cardinality; anything beyond this is folded into "other". */
export const MAX_SUBAGENT_BUCKETS = 32

/** Max characters retained from any model-supplied string before truncation. */
export const MAX_LABEL_LENGTH = 64

/** Env var that gates metrics collection and reporting. Set to "1" (or any truthy value) to enable. */
export const METRICS_ENV_VAR = "LEAD_METRICS"
