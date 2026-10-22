-- Deterministic, privacy-safe verification fixtures. No real candidate data.
-- Applied only by the local harness and by explicit seed runs; tests rely on these UUIDs.

INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-4111-8111-111111111111', 'asha@example.test'),
    ('22222222-2222-4222-8222-222222222222', 'ravi@example.test'),
    ('33333333-3333-4333-8333-333333333333', 'meera@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.candidate_profiles (
    id, full_name, email, college_name, college_tier, degree_stream, graduation_year,
    onboarding_signals, autonomy_level, dpdp_consent_ledger, preferred_language,
    baseline_code_probe_score
) VALUES
    (
        '11111111-1111-4111-8111-111111111111',
        'Asha Kannan',
        'asha@example.test',
        'Government College of Engineering, Salem',
        'Tier_3',
        'B.E. Computer Science',
        2026,
        '{"primary_skills":["python","sql"],"weekly_hours":12}'::jsonb,
        2,
        '{
            "scopes": {
                "public_passport_hosting": {"status": "granted", "granted_at": "2026-10-01T00:00:00Z", "version": "v1"},
                "institution_cohort": {"status": "granted", "granted_at": "2026-10-01T00:00:00Z", "version": "v1"},
                "resume_parsing": {"status": "granted", "granted_at": "2026-10-01T00:00:00Z", "version": "v1"}
            }
        }'::jsonb,
        'ta',
        62.5
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'Ravi Prakash',
        'ravi@example.test',
        'Anna University',
        'Tier_1',
        'B.Tech Information Technology',
        2027,
        '{"primary_skills":["javascript"]}'::jsonb,
        1,
        '{"scopes": {}}'::jsonb,
        'en',
        48.0
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        'Meera Selvam',
        'meera@example.test',
        'Government College of Engineering, Salem',
        'Tier_3',
        'B.Sc. Mathematics',
        2026,
        '{}'::jsonb,
        3,
        '{
            "scopes": {
                "public_passport_hosting": {"status": "granted", "granted_at": "2026-10-02T00:00:00Z", "version": "v1"},
                "institution_cohort": {"status": "granted", "granted_at": "2026-10-02T00:00:00Z", "version": "v1"}
            }
        }'::jsonb,
        'en',
        NULL
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.interview_blueprints (
    id, candidate_id, company_name, job_role, candidate_level, round_type, blueprint_version,
    evaluation_criteria_weights, question_distribution, duration_minutes, confidence_tier,
    source_urls, visibility
) VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        NULL,
        'Acme Corp',
        'Backend Engineer',
        'New_Grad_Fresher',
        'Coding',
        'v1.0',
        '{"problem_solving":0.4,"code_quality":0.3,"testing":0.3}'::jsonb,
        '{"dsa":0.5,"api_design":0.5}'::jsonb,
        45,
        'High-Confidence Inferred',
        '["https://example.test/acme/jobs/backend-engineer"]'::jsonb,
        'shared'
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        NULL,
        'Acme Corp',
        'Backend Engineer',
        'New_Grad_Fresher',
        'Recruiter_Screen',
        'v1.0',
        '{"communication":0.5,"motivation":0.5}'::jsonb,
        '{"behavioural":1.0}'::jsonb,
        30,
        'High-Confidence Inferred',
        '[]'::jsonb,
        'shared'
    ),
    (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '11111111-1111-4111-8111-111111111111',
        'Vertex Labs',
        'SDE Intern',
        'Intern',
        'Coding',
        'v1.0',
        '{"problem_solving":0.5,"code_quality":0.5}'::jsonb,
        '{"dsa":1.0}'::jsonb,
        40,
        'Verified — Vacancy Specification',
        '[]'::jsonb,
        'candidate'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.practice_sessions (
    id, candidate_id, blueprint_id, session_number, company_name, job_role, round_type,
    calibration_mode, difficulty_vector, rubric_version_id, weighted_score, baseline_delta,
    merkle_root_hash, trustmodel_cert_url, created_at
) VALUES
    (
        'd1111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        1, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.4}'::jsonb, 'rubric-v1', 55.0, 0.0, NULL, NULL,
        '2026-10-05T10:00:00Z'
    ),
    (
        'd2222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.5}'::jsonb, 'rubric-v1', 68.0, 13.0, NULL, NULL,
        '2026-10-07T10:00:00Z'
    ),
    (
        'd3333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        1, 'Acme Corp', 'Backend Engineer', 'Recruiter_Screen', 'Mode_B',
        '{"difficulty":0.3}'::jsonb, 'rubric-v1', 72.0, 10.0, NULL, NULL,
        '2026-10-09T10:00:00Z'
    ),
    (
        'd4444444-4444-4444-8444-444444444444',
        '11111111-1111-4111-8111-111111111111',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        3, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_C',
        '{"difficulty":0.6}'::jsonb, 'rubric-v2', 81.0, 13.0,
        'sha256:5f8d3c1e9b7a4d2c6e0f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d',
        'https://trustmodel.example.test/cert/s4', '2026-10-12T10:00:00Z'
    ),
    (
        'd5555555-5555-4555-8555-555555555555',
        '22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        1, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.4}'::jsonb, 'rubric-v1', 61.0, 0.0, NULL, NULL,
        '2026-10-06T10:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.session_responses (
    id, session_id, question_index, topic_tags, question_prompt, candidate_code_or_text,
    language_used, hints_used_count, independent_first_attempt, duration_seconds,
    criterion_scores, evidence_feedback_md, created_at
) VALUES
    (
        'e1111111-1111-4111-8111-111111111111',
        'd1111111-1111-4111-8111-111111111111', 0,
        ARRAY['arrays', 'hash_maps'],
        'Return indices of two numbers that add to a target.',
        'def two_sum(nums, target): ...',
        'python', 2, FALSE, 900,
        '{"problem_solving":3.0,"code_quality":3.0,"testing":2.0}'::jsonb,
        'Correct approach; helper was needed for the hash-map invariant.',
        '2026-10-05T10:15:00Z'
    ),
    (
        'e2222222-2222-4222-8222-222222222222',
        'd1111111-1111-4111-8111-111111111111', 1,
        ARRAY['sql'],
        'Write a query returning the second highest salary.',
        'SELECT MAX(salary) FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);',
        'sql', 0, TRUE, 420,
        '{"problem_solving":4.0,"code_quality":4.0,"testing":3.0}'::jsonb,
        'Correct NULL-safe reasoning stated explicitly.',
        '2026-10-05T10:25:00Z'
    ),
    (
        'e3333333-3333-4333-8333-333333333333',
        'd4444444-4444-4444-8444-444444444444', 0,
        ARRAY['api_design', 'idempotency'],
        'Design an idempotent payment retry endpoint.',
        'POST /payments/{id}/retry with Idempotency-Key header...',
        'en', 0, TRUE, 1200,
        '{"problem_solving":4.5,"code_quality":4.0,"testing":4.0}'::jsonb,
        'Strong idempotency reasoning, including duplicate suppression.',
        '2026-10-12T10:20:00Z'
    ),
    (
        'e4444444-4444-4444-8444-444444444444',
        'd4444444-4444-4444-8444-444444444444', 1,
        ARRAY['testing', 'edge_cases'],
        'Which cases would you add to the payment retry test suite?',
        'Duplicate key, expired key, partial failure, concurrent retry...',
        'en', 0, TRUE, 600,
        '{"problem_solving":4.0,"code_quality":4.0,"testing":5.0}'::jsonb,
        'Comprehensive edge-case enumeration.',
        '2026-10-12T10:30:00Z'
    ),
    (
        'e5555555-5555-4555-8555-555555555555',
        'd5555555-5555-4555-8555-555555555555', 0,
        ARRAY['arrays'],
        'Return indices of two numbers that add to a target.',
        'const twoSum = (nums, target) => { ... }',
        'javascript', 1, TRUE, 700,
        '{"problem_solving":3.5,"code_quality":3.0,"testing":2.5}'::jsonb,
        'Works but quadratic; asked for the optimal approach.',
        '2026-10-06T10:20:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.candidate_skill_history (
    id, candidate_id, session_id, topic_or_criterion, round_type, score_five_scale,
    normalized_score, is_first_attempt_unassisted, rolling_confidence,
    is_recurring_weakness, next_recommended_action, recorded_at
) VALUES
    (
        'f1111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'd1111111-1111-4111-8111-111111111111',
        'hash_maps', 'Coding', 3.0, 60.0, FALSE, 0.5, TRUE,
        'Practise two-sum variants without hints, then re-attempt Mode B.',
        '2026-10-05T10:30:00Z'
    ),
    (
        'f2222222-2222-4222-8222-222222222222',
        '11111111-1111-4111-8111-111111111111',
        'd1111111-1111-4111-8111-111111111111',
        'sql', 'Coding', 4.0, 80.0, TRUE, 0.6, FALSE,
        'Attempt window-function variants to consolidate.',
        '2026-10-05T10:30:00Z'
    ),
    (
        'f3333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        'd4444444-4444-4444-8444-444444444444',
        'idempotency', 'Coding', 4.5, 90.0, TRUE, 0.8, FALSE,
        'Move to a distributed-locking scenario next.',
        '2026-10-12T10:40:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.portfolio_artifacts (
    id, candidate_id, repo_url, commit_sha, ast_summary_md, credibility_score,
    dimension_scores, test_coverage_pct, ci_passing, live_url_status,
    upgrade_sprint_tickets, socratic_defense_session_id, audited_at
) VALUES
    (
        'a1111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'https://github.com/asha-kannan/expense-api',
        'abc1234',
        'FastAPI service with pytest suite; no CI workflow.',
        78,
        '{"originality":70,"complexity":80,"code_quality":75,"tests":85,"deployability":65}'::jsonb,
        72.5, FALSE, NULL,
        '[{"ticket":"add-ci","hours":3}]'::jsonb,
        'd4444444-4444-4444-8444-444444444444',
        '2026-10-13T09:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.apprenticeship_sprints (
    id, candidate_id, tier, issue_url, repo_name, scoped_hours, localization_map_md,
    pre_pr_test_passed, pr_url, merge_status, completed_at, created_at
) VALUES
    (
        'b1111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'Tier_B_OSS',
        'https://github.com/example-org/example-repo/issues/42',
        'example-org/example-repo',
        8,
        'Localised to docs/contributing.md and tests/test_cli.py.',
        TRUE,
        'https://github.com/example-org/example-repo/pull/77',
        'merged',
        '2026-10-14T12:00:00Z',
        '2026-10-10T12:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employment_pipeline_events (
    id, candidate_id, job_source, company_name, role_title, location, job_url,
    fit_scores_5d, decision_state, tailored_resume_pdf_url, micro_deliverable_url,
    skill_passport_url, employer_outcome, created_at, updated_at
) VALUES
    (
        'c1111111-1111-4111-8111-111111111111',
        '11111111-1111-4111-8111-111111111111',
        'greenhouse', 'Acme Corp', 'Backend Engineer', 'Bengaluru', 'https://example.test/acme/jobs/backend-engineer',
        '{"skill_match":82,"growth":75,"compensation":60,"culture":70,"accessibility":80}'::jsonb,
        'State_3', NULL, NULL, NULL, 'applied',
        '2026-10-15T09:00:00Z', '2026-10-16T09:00:00Z'
    ),
    (
        'c2222222-2222-4222-8222-222222222222',
        '22222222-2222-4222-8222-222222222222',
        'naukri', 'Beta Systems', 'Frontend Developer', NULL, 'https://example.test/beta/jobs/fe-dev',
        '{"skill_match":70,"growth":65,"compensation":55,"culture":60,"accessibility":50}'::jsonb,
        'State_2', NULL, NULL, NULL, 'discovered',
        '2026-10-15T09:00:00Z', '2026-10-15T09:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Judge demo candidate (Build Plan 2.4): a complete, evidence-bearing journey.
-- Deterministic fixture, not a real person. Scores are stored per session so the
-- improvement curve 58 -> 67 -> 69 -> 76 is auditable rather than asserted.
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (id, email) VALUES
    ('44444444-4444-4444-8444-444444444444', 'arjun@example.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.candidate_profiles (
    id, full_name, email, college_name, college_tier, degree_stream, graduation_year,
    parsed_resume_md, onboarding_signals, autonomy_level, dpdp_consent_ledger,
    preferred_language, baseline_code_probe_score
) VALUES (
    '44444444-4444-4444-8444-444444444444',
    'Arjun Krishnamurthy',
    'arjun@example.test',
    'Government College of Engineering, Salem',
    'Tier_3',
    'B.E. Computer Science',
    2026,
    '# Arjun Krishnamurthy

Final-year CSE student. Built a FastAPI expense tracker and a CLI log analyser.',
    '{"primary_skills":["python","sql","git"],"weekly_hours":14,"has_laptop":true}'::jsonb,
    2,
    '{
        "scopes": {
            "public_passport_hosting": {"status": "granted", "granted_at": "2026-10-03T00:00:00Z", "version": "v1"},
            "institution_cohort": {"status": "granted", "granted_at": "2026-10-03T00:00:00Z", "version": "v1"},
            "resume_parsing": {"status": "granted", "granted_at": "2026-10-03T00:00:00Z", "version": "v1"},
            "github_repository_audit": {"status": "granted", "granted_at": "2026-10-03T00:00:00Z", "version": "v1"}
        }
    }'::jsonb,
    'en',
    54.0
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.practice_sessions (
    id, candidate_id, blueprint_id, session_number, company_name, job_role, round_type,
    calibration_mode, difficulty_vector, rubric_version_id, weighted_score, baseline_delta,
    replay_jsonl_url, merkle_root_hash, trustmodel_cert_url, created_at
) VALUES
    (
        'd6666666-6666-4666-8666-666666666661',
        '44444444-4444-4444-8444-444444444444',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        1, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.4}'::jsonb, 'rubric-v1', 58.0, 0.0,
        NULL, NULL, NULL, '2026-10-06T10:00:00Z'
    ),
    (
        'd6666666-6666-4666-8666-666666666662',
        '44444444-4444-4444-8444-444444444444',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        2, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.5}'::jsonb, 'rubric-v1', 67.0, 9.0,
        NULL, NULL, NULL, '2026-10-08T10:00:00Z'
    ),
    (
        'd6666666-6666-4666-8666-666666666663',
        '44444444-4444-4444-8444-444444444444',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        3, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_B',
        '{"difficulty":0.6}'::jsonb, 'rubric-v2', 69.0, 11.0,
        NULL, NULL, NULL, '2026-10-10T10:00:00Z'
    ),
    (
        'd6666666-6666-4666-8666-666666666664',
        '44444444-4444-4444-8444-444444444444',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        4, 'Acme Corp', 'Backend Engineer', 'Coding', 'Mode_C',
        '{"difficulty":0.7}'::jsonb, 'rubric-v2', 76.0, 18.0,
        'https://replay.example.test/arjun/s4.jsonl',
        'sha256:8c1f0a2d4b6e8f0a2c4e6f8a0b2d4f6a8c0e2f4a6b8d0c2e4f6a8b0d2c4e6f8a',
        'https://trustmodel.example.test/cert/arjun-s4', '2026-10-13T10:00:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.session_responses (
    id, session_id, question_index, topic_tags, question_prompt, candidate_code_or_text,
    language_used, hints_used_count, independent_first_attempt, duration_seconds,
    criterion_scores, evidence_feedback_md, created_at
) VALUES
    (
        'e6666666-6666-4666-8666-666666666661',
        'd6666666-6666-4666-8666-666666666661', 0,
        ARRAY['arrays', 'hash_maps'],
        'Return indices of two numbers that add to a target.',
        'def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]',
        'python', 1, FALSE, 780,
        '{"problem_solving":2.5,"code_quality":3.0,"testing":2.0}'::jsonb,
        'Correct but quadratic; needed a hint to reach the hash-map solution.',
        '2026-10-06T10:13:00Z'
    ),
    (
        'e6666666-6666-4666-8666-666666666662',
        'd6666666-6666-4666-8666-666666666662', 0,
        ARRAY['arrays', 'hash_maps'],
        'Return indices of two numbers that add to a target.',
        'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i',
        'python', 0, TRUE, 520,
        '{"problem_solving":3.5,"code_quality":3.5,"testing":3.0}'::jsonb,
        'Independent optimal solution with correct single-pass invariant.',
        '2026-10-08T10:09:00Z'
    ),
    (
        'e6666666-6666-4666-8666-666666666663',
        'd6666666-6666-4666-8666-666666666663', 0,
        ARRAY['sql', 'window_functions'],
        'Return each department''s second-highest salary.',
        'SELECT department_id, salary FROM (\n  SELECT department_id, salary, DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS r\n  FROM employees\n) ranked WHERE r = 2;',
        'sql', 0, TRUE, 610,
        '{"problem_solving":3.5,"code_quality":4.0,"testing":3.5}'::jsonb,
        'Correct window-function approach, including ties via DENSE_RANK.',
        '2026-10-10T10:10:00Z'
    ),
    (
        'e6666666-6666-4666-8666-666666666664',
        'd6666666-6666-4666-8666-666666666664', 0,
        ARRAY['api_design', 'idempotency'],
        'Design an idempotent payment retry endpoint.',
        'POST /payments/{id}/retry with Idempotency-Key; store key + response hash; return stored response on replay; reject conflicting payloads with 409.',
        'en', 0, TRUE, 980,
        '{"problem_solving":4.0,"code_quality":4.0,"testing":4.0}'::jsonb,
        'Explained duplicate suppression, payload conflict handling and retry safety.',
        '2026-10-13T10:16:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.candidate_skill_history (
    id, candidate_id, session_id, response_id, topic_or_criterion, round_type,
    score_five_scale, normalized_score, is_first_attempt_unassisted, rolling_confidence,
    is_recurring_weakness, next_recommended_action, recorded_at
) VALUES
    (
        'f6666666-6666-4666-8666-666666666661',
        '44444444-4444-4444-8444-444444444444',
        'd6666666-6666-4666-8666-666666666661',
        'e6666666-6666-4666-8666-666666666661',
        'hash_maps', 'Coding', 2.5, 50.0, FALSE, 0.4, TRUE,
        'Re-attempt two-sum variants without hints before the next mock.',
        '2026-10-06T10:20:00Z'
    ),
    (
        'f6666666-6666-4666-8666-666666666662',
        '44444444-4444-4444-8444-444444444444',
        'd6666666-6666-4666-8666-666666666662',
        'e6666666-6666-4666-8666-666666666662',
        'hash_maps', 'Coding', 3.5, 70.0, TRUE, 0.6, FALSE,
        'Move to a sliding-window problem set to generalise the pattern.',
        '2026-10-08T10:15:00Z'
    ),
    (
        'f6666666-6666-4666-8666-666666666663',
        '44444444-4444-4444-8444-444444444444',
        'd6666666-6666-4666-8666-666666666663',
        'e6666666-6666-4666-8666-666666666663',
        'window_functions', 'Coding', 3.5, 70.0, TRUE, 0.65, FALSE,
        'Practise ranking with ties and NULL salaries.',
        '2026-10-10T10:16:00Z'
    ),
    (
        'f6666666-6666-4666-8666-666666666664',
        '44444444-4444-4444-8444-444444444444',
        'd6666666-6666-4666-8666-666666666664',
        'e6666666-6666-4666-8666-666666666664',
        'idempotency', 'Coding', 4.0, 80.0, TRUE, 0.75, FALSE,
        'Extend to concurrent retries and partial failure recovery.',
        '2026-10-13T10:22:00Z'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.portfolio_artifacts (
    id, candidate_id, repo_url, commit_sha, ast_summary_md, credibility_score,
    dimension_scores, test_coverage_pct, ci_passing, live_url_status,
    upgrade_sprint_tickets, socratic_defense_session_id, audited_at
) VALUES (
    'a2222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'https://github.com/arjun-k/expense-api',
    '9f2c1ab',
    'FastAPI service with a pytest suite, GitHub Actions CI and a documented schema.',
    82,
    '{"originality":75,"complexity":80,"code_quality":85,"tests":85,"deployability":80}'::jsonb,
    78.0, TRUE, 200,
    '[]'::jsonb,
    'd6666666-6666-4666-8666-666666666664',
    '2026-10-14T09:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.apprenticeship_sprints (
    id, candidate_id, tier, issue_url, repo_name, scoped_hours, localization_map_md,
    pre_pr_test_passed, pr_url, merge_status, completed_at, created_at
) VALUES (
    'b2222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'Tier_B_OSS',
    'https://github.com/example-org/example-repo/issues/43',
    'example-org/example-repo',
    8,
    'Localised to src/parser.py and tests/test_parser.py.',
    TRUE,
    'https://github.com/example-org/example-repo/pull/78',
    'merged',
    '2026-10-15T12:00:00Z',
    '2026-10-11T12:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employment_pipeline_events (
    id, candidate_id, job_source, company_name, role_title, location, job_url,
    fit_scores_5d, decision_state, tailored_resume_pdf_url, micro_deliverable_url,
    skill_passport_url, employer_outcome, created_at, updated_at
) VALUES (
    'c3333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    'greenhouse', 'Acme Corp', 'Backend Engineer', 'Bengaluru',
    'https://example.test/acme/jobs/backend-engineer',
    '{"skill_match":78,"growth":80,"compensation":60,"culture":70,"accessibility":75}'::jsonb,
    'State_3', NULL, NULL, NULL, 'applied',
    '2026-10-16T09:00:00Z', '2026-10-17T09:00:00Z'
)
ON CONFLICT (id) DO NOTHING;
