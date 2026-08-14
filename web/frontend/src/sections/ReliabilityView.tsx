import { useEffect, useRef, useState } from "react";
import { request, InkDropApiError } from "../api";
import { useRowActions } from "../rowActions";
import {
  RELIABILITY_STAGE_ORDER,
  type ReliabilityBucketKey,
  type ReliabilityItem,
  type ReliabilityViewPayload,
} from "./reliabilityTypes";

const PAGE_SIZE = 40;

const BUCKET_TONE: Record<ReliabilityBucketKey, string> = {
  manual_review_needed: "bad",
  import_recheck_loop: "bad",
  known_bad_blocked: "bad",
  budget_starved: "warn",
  actively_processing: "good",
  no_source_found_yet: "warn",
  other: "",
};

function buildEndpoint(offset: number, bucketFilter: string): string {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  if (bucketFilter) params.set("source_filter", bucketFilter);
  return `/api/inkdrop-state/reliability?${params.toString()}`;
}

function itemTitle(item: ReliabilityItem): string {
  const issue = item.issue_number ? ` #${item.issue_number}` : "";
  return `${item.series || "Unknown series"}${issue}`;
}

function relativeAge(stampSeconds?: number): string {
  if (!stampSeconds) return "";
  const seconds = Math.max(0, Date.now() / 1000 - stampSeconds);
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function pageNumbers(current: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set<number>([1, 2, current - 1, current, current + 1, pageCount - 1, pageCount]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const page of sorted) {
    if (prev && page - prev > 1) out.push("gap");
    out.push(page);
    prev = page;
  }
  return out;
}

function StageTracker({ item }: { item: ReliabilityItem }) {
  const currentIndex = RELIABILITY_STAGE_ORDER.indexOf(item.stage);
  return (
    <ol className="reliability-stage-tracker" aria-label={`Pipeline stage: ${item.stage_label}`}>
      {RELIABILITY_STAGE_ORDER.map((stage, index) => {
        const status = index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
        return (
          <li key={stage} className={`reliability-stage-step ${status}`}>
            <span className="reliability-stage-dot" aria-hidden="true" />
            <span className="reliability-stage-label">
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type ItemCardActions = {
  pendingIds: ReadonlySet<string>;
  doneIds: ReadonlyMap<string, string>;
  runRetryNewSource: (item: ReliabilityItem) => void;
  runReopenImport: (item: ReliabilityItem) => void;
  blockCandidate: (item: ReliabilityItem) => void;
};

// Mirrors Queue.tsx's group-based gating (group.key === "attention" / "importing")
// translated to this view's bucket/queue_state fields -- manual_review_needed is
// defined identically to Queue's "attention" group (queue_state in needs_you/
// failed/blocked), so the same actions that make sense there make sense here.
// Unlike ManualReview.tsx (whose rows are pre-filtered to problem rows already),
// this view lists every Wanted/in-progress item, so buttons stay gated rather
// than showing unconditionally on ~2,000 normal-progress cards.
function ItemCard({ item, actions }: { item: ReliabilityItem; actions: ItemCardActions }) {
  const tone = BUCKET_TONE[item.bucket] || "";
  const canRecover = Boolean(item.queue_id);
  const canRetryNewSource = canRecover && item.bucket === "manual_review_needed";
  const canReopenImport = canRecover && (item.queue_state === "importing" || item.bucket === "manual_review_needed");
  const canBlock = canRecover && Boolean(item.last_attempt_id);
  const pending = actions.pendingIds.has(item.wanted_id);
  const done = actions.doneIds.get(item.wanted_id);
  return (
    <article className={`reliability-item-card tone-${tone || "neutral"}`} data-arr-row-id={item.wanted_id}>
      <header className="reliability-item-header">
        <div className="reliability-item-title-block">
          <strong className="reliability-item-title">{itemTitle(item)}</strong>
          {item.issue_title && <span className="mini">{item.issue_title}</span>}
        </div>
        <span className={`core-state reliability-bucket-badge ${tone}`}>{item.bucket_label}</span>
      </header>
      <StageTracker item={item} />
      <p className="reliability-item-reason">{item.reason}</p>
      <div className="reliability-item-meta">
        {item.queue_state && <span>queue: {item.queue_state}</span>}
        {typeof item.attempt_count === "number" && <span>{item.attempt_count} attempts</span>}
        {item.queue_updated_at ? <span>updated {relativeAge(item.queue_updated_at)}</span> : null}
      </div>
      {(canRetryNewSource || canReopenImport || canBlock) && (
        <div className="reliability-item-actions">
          {canRetryNewSource && (
            <button
              type="button"
              disabled={pending || Boolean(done)}
              onClick={() => actions.runRetryNewSource(item)}
              title="Retry, skipping whichever source(s) most recently failed for this item"
            >
              {pending ? "Working…" : done || "Try another source"}
            </button>
          )}
          {canReopenImport && (
            <button
              type="button"
              disabled={pending || Boolean(done)}
              onClick={() => actions.runReopenImport(item)}
              title="Re-check this import; only changes anything if it's genuinely stuck"
            >
              {pending ? "Working…" : done || "Reopen import"}
            </button>
          )}
          {canBlock && (
            <button
              type="button"
              className="reliability-item-block-btn"
              disabled={pending || Boolean(done)}
              onClick={() => actions.blockCandidate(item)}
              title="Permanently reject this release so InkDrop stops offering it for this issue"
            >
              {pending ? "Working…" : done || "Block this release"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function ReliabilityView({ payload }: { payload: ReliabilityViewPayload }) {
  const [items, setItems] = useState<ReliabilityItem[]>(payload.rows || []);
  const [offset, setOffset] = useState(payload.offset || 0);
  const [totalCount, setTotalCount] = useState(payload.total_count || 0);
  const [bucketFilter, setBucketFilter] = useState(payload.bucket_filter || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = payload.summary;
  const bucketFilterRef = useRef(bucketFilter);
  bucketFilterRef.current = bucketFilter;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const { pendingIds, doneIds, actionError, clearActionError, runRowAction } = useRowActions(() =>
    loadPage(offsetRef.current),
  );

  // A fresh payload arrives whenever the shell re-fetches page one on our
  // behalf (section re-entry, nav re-click). If the user had a bucket filter
  // active, the shell's unfiltered page one would silently discard it --
  // same pattern Blocklist.tsx uses for its own compound filter.
  useEffect(() => {
    if (!bucketFilterRef.current) {
      setItems(payload.rows || []);
      setOffset(payload.offset || 0);
      setTotalCount(payload.total_count || 0);
      setError(null);
    } else {
      void loadPage(0, bucketFilterRef.current);
    }
    clearActionError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  async function loadPage(nextOffset: number, filter?: string) {
    const activeFilter = filter ?? bucketFilterRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await request<{ ok: boolean; view: ReliabilityViewPayload }>(buildEndpoint(nextOffset, activeFilter));
      const view = data.view;
      setItems(view.rows || []);
      setOffset(view.offset ?? nextOffset);
      setTotalCount(view.total_count || 0);
    } catch (cause) {
      setError(cause instanceof InkDropApiError ? cause.message : "Could not load the Reliability view.");
    } finally {
      setLoading(false);
    }
  }

  function selectBucket(bucket: string) {
    const next = bucket === bucketFilter ? "" : bucket;
    setBucketFilter(next);
    void loadPage(0, next);
  }

  // Same three endpoints/semantics as Queue.tsx's/ManualReview.tsx's recovery
  // actions (PR #504) -- tracked by wanted_id since that's this view's stable
  // per-card key, with queue_id as the actual mutation target.
  function runRetryNewSource(item: ReliabilityItem) {
    const queueId = item.queue_id || "";
    void runRowAction(item.wanted_id, itemTitle(item), "Queued", async () => {
      const data = await request<{ ok: boolean; result?: { reason?: string } }>("/api/inkdrop-state/queue/retry-new-source", {
        method: "POST",
        body: { id: queueId },
      });
      if (!data.ok) {
        const reason = data.result?.reason;
        throw new InkDropApiError(
          reason === "no_alternate_source_available"
            ? "No alternate source is configured for this item -- every source already failed."
            : "Could not retry with another source.",
          { status: 200, code: "reliability_retry_new_source_failed" },
        );
      }
    });
  }

  function runReopenImport(item: ReliabilityItem) {
    const queueId = item.queue_id || "";
    void runRowAction(item.wanted_id, itemTitle(item), "Reopened", async () => {
      const data = await request<{ ok: boolean; result?: { reason?: string } }>("/api/inkdrop-state/queue/reopen-import", {
        method: "POST",
        body: { id: queueId },
      });
      if (!data.ok) throw new InkDropApiError("Could not reopen this import.", { status: 200, code: "reliability_reopen_import_failed" });
    });
  }

  function blockCandidate(item: ReliabilityItem) {
    const queueId = item.queue_id || "";
    if (!window.confirm(`Permanently block this release for ${itemTitle(item)}? InkDrop will never offer it again for this issue.`)) return;
    void runRowAction(item.wanted_id, itemTitle(item), "Blocked", async () => {
      const data = await request<{ ok: boolean; result?: { reason?: string } }>("/api/inkdrop-state/source-memory/block", {
        method: "POST",
        body: { id: queueId, source_attempt_id: item.last_attempt_id, retry: true },
      });
      if (!data.ok) {
        const reason = data.result?.reason;
        throw new InkDropApiError(
          reason === "no_candidate_to_block" ? "No recent candidate is on record for this row to block." : "Could not block this release.",
          { status: 200, code: "reliability_block_candidate_failed" },
        );
      }
    });
  }

  const itemCardActions: ItemCardActions = { pendingIds, doneIds, runRetryNewSource, runReopenImport, blockCandidate };

  const pageStart = totalCount === 0 ? 0 : offset + 1;
  const pageEnd = offset + items.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="inkdrop-react-reliability">
      {(error || actionError) && (
        <div className="inkdrop-react-error-banner" role="alert">
          {error || actionError}
        </div>
      )}
      <div className="reliability-info-banner">
        Every Wanted/in-progress item's real path through the pipeline, live-computed from the same
        source_attempts/queue_items data the Attempts panel and Wanted-backlog audits use -- nothing here is
        re-derived by hand.
      </div>
      <div className="reliability-rollup-row">
        {(summary?.buckets || []).map((bucket) => (
          <button
            type="button"
            key={bucket.key}
            className={`reliability-rollup-card tone-${BUCKET_TONE[bucket.key] || "neutral"} ${bucketFilter === bucket.key ? "active" : ""}`}
            onClick={() => selectBucket(bucket.key)}
            disabled={loading}
            aria-pressed={bucketFilter === bucket.key}
          >
            <span className="reliability-rollup-count">{bucket.count}</span>
            <span className="reliability-rollup-label">{bucket.label}</span>
          </button>
        ))}
      </div>
      <div className="reliability-item-list">
        {items.map((item) => (
          <ItemCard key={item.wanted_id} item={item} actions={itemCardActions} />
        ))}
        {items.length === 0 && !loading && (
          <div className="reliability-empty-state">
            {bucketFilter ? "No items in this bucket right now." : "No Wanted/in-progress items to show."}
          </div>
        )}
      </div>
      <div className="inkdrop-react-pager reliability-pager">
        <span>{totalCount > 0 ? `Showing ${pageStart}-${pageEnd} of ${totalCount} items` : "0 items"}</span>
        <div className="reliability-pager-pages">
          <button
            type="button"
            disabled={loading || currentPage <= 1}
            onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
            aria-label="Previous page"
          >
            &lsaquo;
          </button>
          {pageNumbers(currentPage, pageCount).map((page, index) =>
            page === "gap" ? (
              <span key={`gap-${index}`} className="reliability-pager-gap">
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                className={page === currentPage ? "active" : ""}
                disabled={loading || page === currentPage}
                onClick={() => void loadPage((page - 1) * PAGE_SIZE)}
              >
                {page}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={loading || currentPage >= pageCount}
            onClick={() => void loadPage(offset + PAGE_SIZE)}
            aria-label="Next page"
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </div>
  );
}
