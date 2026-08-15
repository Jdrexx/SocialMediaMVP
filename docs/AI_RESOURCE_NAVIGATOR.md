# MySazz Resource Navigator

## Product boundary

The Resource Navigator should help an adult locate relevant services; it must not diagnose, prescribe, decide eligibility, or claim that a provider is available. Every result must come from a stored source record and show its source, last verification date, phone/site details, and a reminder to confirm current services directly.

Use official APIs and downloadable datasets as the primary ingestion path. Do not build the product around unrestricted page scraping: directory terms, robots rules, formats, and availability change, and scraped health information is difficult to verify. A scraper connector should be allowed only for an approved source whose terms permit it.

## Recommended data sources

1. **SAMHSA FindTreatment.gov API.** Apply for API access rather than reverse-engineering the public site. FindTreatment.gov covers mental-health and substance-use treatment facilities and maintains state contacts for updates. [API access request](https://findtreatment.gov/api-request-form) · [About the directory](https://findtreatment.gov/about)
2. **211 National Data Platform.** Use its Search/Query APIs for community health and human services after confirming access and reuse terms with 211. [Developer portal](https://apiportal.211.org/) · [Getting started](https://apiportal.211.org/get-started-overview)
3. **HRSA Health Center data.** Import the official service-delivery CSV on a schedule. HRSA publishes its refresh cycle and downloadable site data. [Health Center data](https://data.hrsa.gov/topics/health-centers) · [Downloads](https://data.hrsa.gov/data/download?titleFilter=Health+Center)
4. **Curated crisis resources.** Keep crisis contacts in a small, human-reviewed table, independent of the AI and normal ingestion pipeline. The U.S. 988 Lifeline supports call, text, and chat. [988 guidance](https://988lifeline.org/get-help/what-to-expect/)
5. **Approved local sources.** State/county agencies and nonprofit directories can be added through source-specific connectors only after checking license, robots policy, update ownership, and a contact for corrections.

## Architecture

```text
Approved API / CSV / permitted page
                 |
          source connector
                 |
     validate + normalize + dedupe
                 |
   versioned resource catalog + provenance
                 |
 location/filter retrieval (deterministic SQL)
                 |
 AI intent classification and reranking
                 |
 source-backed cards + verification warning
```

The AI is a query interpreter and reranker, not a source of facts. It converts plain-language needs such as “grief group that meets evenings and takes Medicaid” into a controlled taxonomy, retrieves candidate records, and explains why each stored record may match. It may only cite fields returned by retrieval. If no reliable match exists, it says so and offers the source directories directly.

## Data model

Add these tables when implementation starts:

- `resource_sources`: name, canonical URL, connector type, license/terms note, refresh schedule, enabled state, last success, last error.
- `resource_organizations`: normalized organization identity and contact details.
- `resource_locations`: organization, address, approximate coordinates, service area, accessibility, remote/in-person flags.
- `resource_services`: controlled categories, populations served, languages, hours, cost/insurance, eligibility, contact instructions.
- `resource_evidence`: source URL or source record ID, retrieved time, content hash, raw snapshot reference, parsed fields, parser version.
- `resource_verifications`: automated checks, human reviewer, status, checked time, next check, correction notes.
- `resource_search_audit`: non-identifying request class, broad geography, returned record IDs, model/prompt version, and outcome feedback. Do not store raw sensitive prompts by default.

Never place raw scraped HTML in a user-facing response. Keep it in restricted object storage only when the source permits retention, and render sanitized normalized fields.

## Location and privacy

- Ask for a ZIP/postal code or city explicitly for each search; do not silently use device location.
- Convert the location to an approximate search point in the application layer and discard the raw one-time query unless the member chooses to save it.
- A profile ZIP remains private and must never appear in another member's profile, logs, analytics events, or an LLM prompt.
- Retrieve by distance in the database first. Send the model only a broad area, controlled need categories, preferences, and candidate record IDs/fields.
- Start with the United States and territories because the initial sources and crisis behavior are U.S.-specific. Label the coverage boundary in the UI.

## Safety behavior

Run a deterministic safety check before AI search. When a query indicates immediate danger or self-harm, show a prominent option to call/text 988 and emergency guidance while still respecting the member's agency. Do not use a generated answer as the crisis response and do not present MySazz as an emergency service.

The normal results page should always include:

- source and “last checked” date;
- distance as an estimate, not precise tracking;
- call/website actions and provider-confirmation reminder;
- report-incorrect-information action;
- why the item matched, grounded only in stored fields;
- a direct link to the authoritative directory when confidence or freshness is low.

## Connector security

- Use an allowlist of source hosts; never let a user submit a URL for the crawler.
- Block private/link-local IP ranges and redirects to unapproved hosts to prevent SSRF.
- Set strict response-size, content-type, redirect, concurrency, and timeout limits.
- Identify the crawler, honor robots directives where applicable, rate-limit per source, and keep credentials in server-side secrets.
- Treat imported text as hostile data. Strip scripts/markup and never place it in system/developer prompts.
- Make jobs idempotent, retain the previous good version on failure, and alert when freshness thresholds are missed.

## API shape

```text
POST /api/resources/search
  { location, radius_miles, need, preferences }

GET  /api/resources/:id
POST /api/resources/:id/feedback
GET  /api/admin/resource-sources
POST /api/admin/resource-sources/:id/sync
GET  /api/admin/resource-review?status=needs_review
```

Return a structured response with `results`, `interpreted_filters`, `coverage`, `source_status`, and `safety_actions`. Do not return unconstrained model prose as the authoritative result.

## Delivery sequence

1. Build the catalog schema, HRSA importer, deterministic radius/filter search, provenance cards, correction workflow, and curated crisis table—without AI.
2. Add the SAMHSA and 211 API connectors after access and reuse terms are approved.
3. Add AI intent classification with a strict JSON schema and a closed service taxonomy. Measure it against a human-labeled query set.
4. Add source-grounded reranking/explanations and reject any output referencing a record or attribute outside retrieval.
5. Add approved local connectors and a reviewer queue; do not enable a new source directly in production.

Launch gates should include zero fabricated providers in the evaluation set, clear source attribution on every result, freshness alerts, correction turnaround targets, accessibility testing, and human-reviewed crisis-flow tests.
