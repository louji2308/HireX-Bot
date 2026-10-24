# Opportunity snapshot provenance

Captured: **2026-10-24**  
Method: manual capture from public ATS job-board APIs, followed by a compact normalized record and a bounded excerpt.  
Live ingestion: **no**. Refresh: **none**. Cron: **none**.

| Company | Role | Source | Source job ID | Source updated / published |
|---|---|---|---|---|
| HackerRank | Software Development Engineer Intern | Greenhouse public board API | `8229735` | Updated 2026-10-15 |
| HackerRank | Customer Experience Engineer, L1 | Greenhouse public board API | `8127535` | Updated 2026-10-09 |
| HackerRank | Forward Deployed Engineer | Greenhouse public board API | `7461142` | Updated 2026-10-14 |
| HackerRank | Software Development Engineer in Test II | Greenhouse public board API | `8155938` | Updated 2026-10-20 |
| Sarvam | Frontend Engineer, Chanakya | Ashby public posting API | `10a352d0-a65b-4599-8998-e09deef34349` | Published 2026-04-17 |
| Sarvam | Software Development Engineer - Tejas | Ashby public posting API | `db89b576-2456-4cc4-ab0b-c45f8c6c27f0` | Published 2026-10-23 |
| Sarvam | Software Engineer - Model API Platform | Ashby public posting API | `0371342b-5cb8-487b-9310-4d0eb5b37f47` | Published 2026-10-13 |

## Limits

- The records are **snapshots**, not live vacancies. A role may have closed or changed after capture.
- `description_excerpt` and `quality_excerpt` are bounded excerpts, not full job descriptions.
- Missing closing dates are recorded as `null`; they are not treated as scam signals.
- Compensation is `unknown` where the public listing did not state a verified range.
- Skill requirements are normalized from the captured text. They are a triage aid, not a semantic parse of every qualification.
- Role fit uses declared-skill overlap. It is not evidence of ability and is not an employer assessment.
- Opportunity-quality scanning covers only the captured excerpt. A pass means “no fee/deposit phrase found in this excerpt,” not “verified safe.”
- No recruiter contact details, candidate data, or private portal content is stored.
- Source URLs are public listing URLs and may change.
