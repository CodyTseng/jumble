// Shared Pulse constants. Both DeepPulseList (the feed) and the
// UserAggregationDetailPage write to the same Pulse IDB store, so they
// must agree on the per-author cap.
export const PULSE_EVENTS_PER_USER_CAP = 10
