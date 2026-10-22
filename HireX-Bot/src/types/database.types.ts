export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apprenticeship_sprints: {
        Row: {
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          issue_url: string
          localization_map_md: string | null
          merge_status: string
          pr_url: string | null
          pre_pr_test_passed: boolean
          repo_name: string
          scoped_hours: number | null
          tier: string
        }
        Insert: {
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          issue_url: string
          localization_map_md?: string | null
          merge_status?: string
          pr_url?: string | null
          pre_pr_test_passed?: boolean
          repo_name: string
          scoped_hours?: number | null
          tier: string
        }
        Update: {
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          issue_url?: string
          localization_map_md?: string | null
          merge_status?: string
          pr_url?: string | null
          pre_pr_test_passed?: boolean
          repo_name?: string
          scoped_hours?: number | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "apprenticeship_sprints_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          autonomy_level: number
          baseline_code_probe_score: number | null
          college_name: string | null
          college_tier: string | null
          created_at: string
          degree_stream: string | null
          dpdp_consent_ledger: Json
          email: string
          full_name: string
          graduation_year: number | null
          id: string
          oauth_token_vault: Json
          onboarding_signals: Json
          parsed_resume_md: string | null
          passport_published: boolean
          passport_published_at: string | null
          passport_slug: string | null
          passport_snapshot: Json | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          autonomy_level?: number
          baseline_code_probe_score?: number | null
          college_name?: string | null
          college_tier?: string | null
          created_at?: string
          degree_stream?: string | null
          dpdp_consent_ledger?: Json
          email: string
          full_name: string
          graduation_year?: number | null
          id: string
          oauth_token_vault?: Json
          onboarding_signals?: Json
          parsed_resume_md?: string | null
          passport_published?: boolean
          passport_published_at?: string | null
          passport_slug?: string | null
          passport_snapshot?: Json | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          autonomy_level?: number
          baseline_code_probe_score?: number | null
          college_name?: string | null
          college_tier?: string | null
          created_at?: string
          degree_stream?: string | null
          dpdp_consent_ledger?: Json
          email?: string
          full_name?: string
          graduation_year?: number | null
          id?: string
          oauth_token_vault?: Json
          onboarding_signals?: Json
          parsed_resume_md?: string | null
          passport_published?: boolean
          passport_published_at?: string | null
          passport_slug?: string | null
          passport_snapshot?: Json | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      candidate_skill_history: {
        Row: {
          candidate_id: string
          id: string
          is_first_attempt_unassisted: boolean
          is_recurring_weakness: boolean
          next_recommended_action: string
          normalized_score: number
          recorded_at: string
          response_id: string | null
          rolling_confidence: number
          round_type: string
          score_five_scale: number
          session_id: string
          topic_or_criterion: string
        }
        Insert: {
          candidate_id: string
          id?: string
          is_first_attempt_unassisted: boolean
          is_recurring_weakness?: boolean
          next_recommended_action: string
          normalized_score: number
          recorded_at?: string
          response_id?: string | null
          rolling_confidence?: number
          round_type: string
          score_five_scale: number
          session_id: string
          topic_or_criterion: string
        }
        Update: {
          candidate_id?: string
          id?: string
          is_first_attempt_unassisted?: boolean
          is_recurring_weakness?: boolean
          next_recommended_action?: string
          normalized_score?: number
          recorded_at?: string
          response_id?: string | null
          rolling_confidence?: number
          round_type?: string
          score_five_scale?: number
          session_id?: string
          topic_or_criterion?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skill_history_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_skill_history_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "session_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_skill_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_pipeline_events: {
        Row: {
          candidate_id: string
          company_name: string
          created_at: string
          decision_state: string
          employer_outcome: string
          fit_scores_5d: Json
          id: string
          job_source: string
          job_url: string
          location: string | null
          micro_deliverable_url: string | null
          role_title: string
          skill_passport_url: string | null
          tailored_resume_pdf_url: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_name: string
          created_at?: string
          decision_state: string
          employer_outcome?: string
          fit_scores_5d: Json
          id?: string
          job_source: string
          job_url: string
          location?: string | null
          micro_deliverable_url?: string | null
          role_title: string
          skill_passport_url?: string | null
          tailored_resume_pdf_url?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_name?: string
          created_at?: string
          decision_state?: string
          employer_outcome?: string
          fit_scores_5d?: Json
          id?: string
          job_source?: string
          job_url?: string
          location?: string | null
          micro_deliverable_url?: string | null
          role_title?: string
          skill_passport_url?: string | null
          tailored_resume_pdf_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_pipeline_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_blueprints: {
        Row: {
          blueprint_version: string
          candidate_id: string | null
          candidate_level: string
          company_name: string
          confidence_tier: string
          created_at: string
          duration_minutes: number
          evaluation_criteria_weights: Json
          id: string
          job_role: string
          question_distribution: Json
          round_type: string
          source_urls: Json
          visibility: string
        }
        Insert: {
          blueprint_version?: string
          candidate_id?: string | null
          candidate_level: string
          company_name: string
          confidence_tier: string
          created_at?: string
          duration_minutes: number
          evaluation_criteria_weights: Json
          id?: string
          job_role: string
          question_distribution: Json
          round_type: string
          source_urls?: Json
          visibility?: string
        }
        Update: {
          blueprint_version?: string
          candidate_id?: string | null
          candidate_level?: string
          company_name?: string
          confidence_tier?: string
          created_at?: string
          duration_minutes?: number
          evaluation_criteria_weights?: Json
          id?: string
          job_role?: string
          question_distribution?: Json
          round_type?: string
          source_urls?: Json
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_blueprints_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_artifacts: {
        Row: {
          ast_summary_md: string | null
          audited_at: string
          candidate_id: string
          ci_passing: boolean | null
          commit_sha: string | null
          credibility_score: number
          dimension_scores: Json
          id: string
          live_url_status: number | null
          repo_url: string
          socratic_defense_session_id: string | null
          test_coverage_pct: number | null
          upgrade_sprint_tickets: Json | null
        }
        Insert: {
          ast_summary_md?: string | null
          audited_at?: string
          candidate_id: string
          ci_passing?: boolean | null
          commit_sha?: string | null
          credibility_score: number
          dimension_scores: Json
          id?: string
          live_url_status?: number | null
          repo_url: string
          socratic_defense_session_id?: string | null
          test_coverage_pct?: number | null
          upgrade_sprint_tickets?: Json | null
        }
        Update: {
          ast_summary_md?: string | null
          audited_at?: string
          candidate_id?: string
          ci_passing?: boolean | null
          commit_sha?: string | null
          credibility_score?: number
          dimension_scores?: Json
          id?: string
          live_url_status?: number | null
          repo_url?: string
          socratic_defense_session_id?: string | null
          test_coverage_pct?: number | null
          upgrade_sprint_tickets?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_artifacts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_artifacts_defense_session_fkey"
            columns: ["socratic_defense_session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          baseline_delta: number
          blueprint_id: string
          blueprint_version: string
          calibration_mode: string
          candidate_id: string
          company_name: string
          created_at: string
          difficulty_vector: Json
          id: string
          job_role: string
          merkle_root_hash: string | null
          replay_jsonl_url: string | null
          round_type: string
          rubric_version_id: string
          session_number: number
          trustmodel_cert_url: string | null
          weighted_score: number
        }
        Insert: {
          baseline_delta?: number
          blueprint_id: string
          blueprint_version?: string
          calibration_mode: string
          candidate_id: string
          company_name: string
          created_at?: string
          difficulty_vector: Json
          id?: string
          job_role: string
          merkle_root_hash?: string | null
          replay_jsonl_url?: string | null
          round_type: string
          rubric_version_id: string
          session_number: number
          trustmodel_cert_url?: string | null
          weighted_score: number
        }
        Update: {
          baseline_delta?: number
          blueprint_id?: string
          blueprint_version?: string
          calibration_mode?: string
          candidate_id?: string
          company_name?: string
          created_at?: string
          difficulty_vector?: Json
          id?: string
          job_role?: string
          merkle_root_hash?: string | null
          replay_jsonl_url?: string | null
          round_type?: string
          rubric_version_id?: string
          session_number?: number
          trustmodel_cert_url?: string | null
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "interview_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_responses: {
        Row: {
          candidate_code_or_text: string
          created_at: string
          criterion_scores: Json
          duration_seconds: number
          evidence_feedback_md: string
          hints_used_count: number
          id: string
          independent_first_attempt: boolean
          language_used: string
          question_index: number
          question_prompt: string
          session_id: string
          topic_tags: string[]
        }
        Insert: {
          candidate_code_or_text: string
          created_at?: string
          criterion_scores: Json
          duration_seconds: number
          evidence_feedback_md: string
          hints_used_count?: number
          id?: string
          independent_first_attempt?: boolean
          language_used?: string
          question_index: number
          question_prompt: string
          session_id: string
          topic_tags: string[]
        }
        Update: {
          candidate_code_or_text?: string
          created_at?: string
          criterion_scores?: Json
          duration_seconds?: number
          evidence_feedback_md?: string
          hints_used_count?: number
          id?: string
          independent_first_attempt?: boolean
          language_used?: string
          question_index?: number
          question_prompt?: string
          session_id?: string
          topic_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "session_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_portfolio_artifact: {
        Args: {
          p_ast_summary_md?: string
          p_candidate_id: string
          p_ci_passing?: boolean
          p_commit_sha?: string
          p_credibility_score: number
          p_dimension_scores: Json
          p_live_url_status?: number
          p_repo_url: string
          p_test_coverage_pct?: number
          p_upgrade_sprint_tickets?: Json
        }
        Returns: string
      }
      append_skill_history: {
        Args: {
          p_candidate_id: string
          p_is_first_attempt_unassisted: boolean
          p_is_recurring_weakness: boolean
          p_next_recommended_action: string
          p_normalized_score: number
          p_response_id: string
          p_rolling_confidence: number
          p_round_type: string
          p_score_five_scale: number
          p_session_id: string
          p_skill_id: string
          p_topic_or_criterion: string
        }
        Returns: string
      }
      erase_candidate: { Args: { p_candidate_id: string }; Returns: Json }
      get_public_passport: { Args: { p_slug: string }; Returns: Json }
      hirex_compact_jsonb_array: { Args: { p_items: Json[] }; Returns: Json }
      hirex_owns_session: { Args: { p_session_id: string }; Returns: boolean }
      insert_blueprint_version: {
        Args: {
          p_blueprint_id: string
          p_blueprint_version: string
          p_candidate_id?: string
          p_candidate_level: string
          p_company_name: string
          p_confidence_tier: string
          p_duration_minutes: number
          p_evaluation_criteria_weights: Json
          p_job_role: string
          p_question_distribution: Json
          p_round_type: string
          p_source_urls?: Json
        }
        Returns: string
      }
      mint_session_certificate: {
        Args: {
          p_merkle_root_hash: string
          p_session_id: string
          p_trustmodel_cert_url: string
        }
        Returns: undefined
      }
      publish_passport: { Args: { p_slug: string }; Returns: Json }
      record_practice_session: {
        Args: {
          p_baseline_delta: number
          p_blueprint_id: string
          p_calibration_mode: string
          p_candidate_id: string
          p_company_name: string
          p_difficulty_vector: Json
          p_job_role: string
          p_replay_jsonl_url?: string
          p_responses: Json
          p_round_type: string
          p_rubric_version_id: string
          p_session_number: number
          p_weighted_score: number
        }
        Returns: string
      }
      tpo_cohort: {
        Args: never
        Returns: {
          baseline_score: number
          candidate_ref: string
          college_name: string
          full_name: string
          graduation_year: number
          latest_score: number
          merged_prs: number
          session_count: number
        }[]
      }
      unpublish_passport: { Args: never; Returns: undefined }
      upsert_apprenticeship_sprint: {
        Args: {
          p_candidate_id: string
          p_completed_at?: string
          p_issue_url: string
          p_localization_map_md?: string
          p_merge_status?: string
          p_pr_url?: string
          p_pre_pr_test_passed?: boolean
          p_repo_name: string
          p_scoped_hours?: number
          p_sprint_id: string
          p_tier: string
        }
        Returns: string
      }
      upsert_candidate_profile: {
        Args: {
          p_baseline_code_probe_score?: number
          p_candidate_id: string
          p_college_name?: string
          p_college_tier?: string
          p_degree_stream?: string
          p_dpdp_consent_ledger?: Json
          p_email: string
          p_full_name: string
          p_graduation_year?: number
          p_onboarding_signals?: Json
          p_parsed_resume_md?: string
          p_preferred_language?: string
        }
        Returns: undefined
      }
      upsert_pipeline_event: {
        Args: {
          p_candidate_id: string
          p_company_name: string
          p_decision_state: string
          p_employer_outcome?: string
          p_fit_scores_5d: Json
          p_job_source: string
          p_job_url: string
          p_location: string
          p_role_title: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {},
  },
} as const
