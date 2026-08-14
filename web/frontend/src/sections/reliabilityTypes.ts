// Matches reliability_state_view()'s envelope and reliability_view_rows()'s
// item shape (core/inkdrop_state.py). Every wanted/in-progress item's real
// pipeline stage plus which of the audit's known stuck-reason buckets (if
// any) it falls into -- see inkdrop_wanted_backlog_throughput_audit_20260811.

export const RELIABILITY_STAGE_ORDER = [
  "searched",
  "found",
  "grabbed",
  "downloading",
  "importing",
  "verified",
] as const;

export type ReliabilityStageKey = (typeof RELIABILITY_STAGE_ORDER)[number];

export type ReliabilityBucketKey =
  | "manual_review_needed"
  | "import_recheck_loop"
  | "known_bad_blocked"
  | "budget_starved"
  | "actively_processing"
  | "no_source_found_yet"
  | "other";

export type ReliabilityItem = {
  wanted_id: string;
  series_id?: string;
  issue_id?: string;
  wanted_status?: string;
  wanted_created_at?: number;
  wanted_updated_at?: number;
  series?: string;
  media_type?: string;
  issue_number?: string;
  issue_title?: string;
  queue_id?: string;
  queue_state?: string;
  current_source?: string;
  last_event?: string;
  queue_active?: boolean;
  queue_updated_at?: number;
  attempt_count?: number;
  last_attempt_id?: string;
  last_attempt_status?: string;
  last_attempt_failure_reason?: string;
  last_attempt_lifecycle_phase?: string;
  last_attempt_display_phase?: string;
  last_attempt_source?: string;
  last_attempt_completed_at?: number;
  last_attempt_started_at?: number;
  stage: ReliabilityStageKey;
  stage_label: string;
  bucket: ReliabilityBucketKey;
  bucket_label: string;
  reason: string;
};

export type ReliabilityBucketRollup = {
  key: ReliabilityBucketKey;
  label: string;
  count: number;
};

export type ReliabilitySummary = {
  ok: boolean;
  db_path?: string;
  generated_at?: number;
  total: number;
  buckets: ReliabilityBucketRollup[];
  by_bucket: Record<string, number>;
};

export type ReliabilityStageMeta = {
  key: ReliabilityStageKey;
  label: string;
};

export type ReliabilityViewPayload = {
  ok: boolean;
  view: "reliability";
  summary?: ReliabilitySummary;
  rows: ReliabilityItem[];
  count: number;
  loaded_count: number;
  total_count: number;
  has_more: boolean;
  limit: number;
  offset: number;
  bucket_filter?: string;
  stages: ReliabilityStageMeta[];
};
