# Relay activity observations

Relay settings → Relay activity shows all relays with observations in one table,
without separating configured and automatically discovered relays. The table sorts
by total connection attempts across the retained dates, descending. The compact table exposes the latest active day
(connection counts, failure rate, timings and issue counts) without hovering. Metric
columns support ascending/descending sorting, with missing observations last in
either direction. Sorting happens before pagination. Clicking or pressing Enter
on a relay row opens its full activity details. The relay column stays visible
while scrolling horizontally. Each relay has a dedicated activity detail
page at `/relays/:url/activity`. It reads local observations without fetching the
relay feed or NIP-11 metadata. The shared relay information controls provide an
activity button alongside share, copy and save. Relay feed pages do not display
observation panels. All new UI text is available in the 19 supported languages.
No new alerts are generated.

## Daily aggregation

All actual relay connections used by the client are observed, including outbox
relays and automatic reconnects. Each normalized URL retains its seven most recent
local-calendar dates with activity; dates need not be consecutive. Activity on a
socket kept open across midnight is retained even if that day has no new connection.

- Completed connection attempts count once. Failed handshakes include connection
  timeouts. Policy-blocked, offline and intentionally aborted attempts are excluded;
  a later socket disconnect does not retroactively fail a successful connection.
- Read and write refusals are grouped by their final relay-provided reason, per day.
  There are no per-refusal timestamps, event payloads, filters or account keys.
- AUTH-required responses followed by successful authentication and retry are not
  refusals. Unavailable/failed authentication is not included in the statistics. A refusal
  after completed authentication counts as the final read/write refusal.
- Read timeouts distinguish waiting for first data/EOSE from waiting for EOSE after
  receiving data. Empty EOSE is a successful empty query. Waiting for live events
  after EOSE is not a timeout. A write timeout means no acceptance confirmation was
  received, not proof that the relay did not store the event.
- The existing absolute initial-read deadline remains intact. Only requests already
  sent to a relay can count as read timeouts; connection waiting alone cannot.
  Cancellation and known-offline periods are excluded. Substantially delayed timeout
  callbacks following suspension are also excluded.

## Timings and colors

Connection timing runs from WebSocket connect to open. Write timing runs from the
first EVENT send through its accepted OK. Read timing runs from the first REQ send
to the first verified matching event, before application deduplication. AUTH retries
and their waiting time are included in logical read/write timing. Empty queries do
not produce first-event samples. Responses after a recorded initial-read timeout
are not counted as successful initial-read timing samples.

Timings use bounded histograms (10 ms buckets below 1 s, 100 ms below 10 s, 1 s up
to 120 s). All successful samples contribute to an approximate median; values above
120 s are capped. The UI shows the approximation mark and sample count.

Each day is green for no connection failures, yellow for a failure ratio up to
10%, orange up to 50%, and red above 50%. A day with read/write activity but no
connection attempts is gray. Hover, keyboard focus or touch reveals counts and
that day's timings. Below the connection chart, each retained activity date is listed newest first
with its own statistics. Rejection and timeout counts expand into aggregated causes.

## Storage and desktop support

IndexedDB `jumble` version 24 adds `relayObservations`, keyed by normalized URL,
with daily aggregates nested in each record. A renderer service maintains live
aggregates and flushes daily deltas every second and on page hide. Writes merge
inside a transaction so simultaneous tabs cannot overwrite each other's counts.

Configured relay records are protected from the outbox retention limit. Other
records expire after 90 days without activity and are limited to 500 URLs, with
oldest activity evicted first. Arbitrary reason strings are limited to 300 characters
and 50 distinct reasons per daily category, with excess grouped as “Other reasons”.

The shared pool accepts an observer callback and has no storage/browser-service
dependency. Electron transports connection and operation signals from main to
renderer through `relay:observation`; signing, AUTH retry coordination and IndexedDB
persistence remain in the renderer. No new periodic probing is performed.
