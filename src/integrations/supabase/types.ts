export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          pro_id: string | null
          published_at: string | null
          question_id: string
          status: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          pro_id?: string | null
          published_at?: string | null
          question_id: string
          status?: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          pro_id?: string | null
          published_at?: string | null
          question_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "answers_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_access_events: {
        Row: {
          bucket: string
          created_at: string
          detail: string | null
          endpoint: string
          id: string
          ip_hash: string | null
          method: string
          outcome: string
          status: number
          user_agent: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          detail?: string | null
          endpoint: string
          id?: string
          ip_hash?: string | null
          method: string
          outcome: string
          status: number
          user_agent?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          detail?: string | null
          endpoint?: string
          id?: string
          ip_hash?: string | null
          method?: string
          outcome?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: []
      }
      areas: {
        Row: {
          name: string
          note: string
          slug: string
          sort_order: number
          status: string
        }
        Insert: {
          name: string
          note?: string
          slug: string
          sort_order?: number
          status?: string
        }
        Update: {
          name?: string
          note?: string
          slug?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          duration_mins: number
          id: string
          job_id: string | null
          notes: string
          postcode: string | null
          pro_id: string
          reference: string
          slot_start: string
          status: string
          user_id: string | null
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          duration_mins?: number
          id?: string
          job_id?: string | null
          notes?: string
          postcode?: string | null
          pro_id: string
          reference?: string
          slot_start: string
          status?: string
          user_id?: string | null
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          duration_mins?: number
          id?: string
          job_id?: string | null
          notes?: string
          postcode?: string | null
          pro_id?: string
          reference?: string
          slot_start?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "bookings_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      form_block_events: {
        Row: {
          created_at: string
          form: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          form: string
          id?: string
          reason: string
        }
        Update: {
          created_at?: string
          form?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      form_rate_limit: {
        Row: {
          bucket: string
          hits: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          pro_id: string
          rank: number
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          pro_id: string
          rank: number
          score: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          pro_id?: string
          rank?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "job_matches_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          budget_band: string
          contact_email: string
          contact_name: string
          created_at: string
          description: string
          id: string
          postcode: string
          reference: string
          status: Database["public"]["Enums"]["job_status"]
          timing: string
          title: string
          trade_slug: string
          user_id: string | null
        }
        Insert: {
          budget_band?: string
          contact_email: string
          contact_name: string
          created_at?: string
          description: string
          id?: string
          postcode: string
          reference?: string
          status?: Database["public"]["Enums"]["job_status"]
          timing?: string
          title: string
          trade_slug: string
          user_id?: string | null
        }
        Update: {
          budget_band?: string
          contact_email?: string
          contact_name?: string
          created_at?: string
          description?: string
          id?: string
          postcode?: string
          reference?: string
          status?: Database["public"]["Enums"]["job_status"]
          timing?: string
          title?: string
          trade_slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      plan_visibility: {
        Row: {
          display_name: string
          display_order: number
          hidden_reason: string | null
          is_public: boolean
          plan_slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          display_name: string
          display_order?: number
          hidden_reason?: string | null
          is_public?: boolean
          plan_slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          display_name?: string
          display_order?: number
          hidden_reason?: string | null
          is_public?: boolean
          plan_slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      plan_visibility_audit: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          display_name: string
          hidden_reason: string | null
          id: string
          is_public: boolean
          plan_slug: string
          was_public: boolean | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          display_name?: string
          hidden_reason?: string | null
          id?: string
          is_public: boolean
          plan_slug: string
          was_public?: boolean | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          display_name?: string
          hidden_reason?: string | null
          id?: string
          is_public?: boolean
          plan_slug?: string
          was_public?: boolean | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          featured: boolean
          features: string[]
          line: string
          name: string
          per: string
          price: string
          slug: string
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          featured?: boolean
          features?: string[]
          line?: string
          name: string
          per?: string
          price: string
          slug: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          featured?: boolean
          features?: string[]
          line?: string
          name?: string
          per?: string
          price?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      pro_application_audit: {
        Row: {
          action: string
          application_id: string
          changed_by: string | null
          changed_by_email: string | null
          company: string
          created_at: string
          from_status: string | null
          id: string
          reference: string | null
          reviewer_note: string | null
          to_status: string
        }
        Insert: {
          action: string
          application_id: string
          changed_by?: string | null
          changed_by_email?: string | null
          company: string
          created_at?: string
          from_status?: string | null
          id?: string
          reference?: string | null
          reviewer_note?: string | null
          to_status: string
        }
        Update: {
          action?: string
          application_id?: string
          changed_by?: string | null
          changed_by_email?: string | null
          company?: string
          created_at?: string
          from_status?: string | null
          id?: string
          reference?: string | null
          reviewer_note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_application_audit_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pro_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_application_documents: {
        Row: {
          application_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          kind: string
          mime_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          size_bytes: number
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          kind: string
          mime_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          size_bytes: number
          status?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          kind?: string
          mime_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          size_bytes?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pro_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_applications: {
        Row: {
          about: string
          accreditations: string | null
          applicant_message: string | null
          changes_requested_at: string | null
          companies_house: string | null
          company: string
          contact_name: string
          created_at: string
          due_at: string | null
          email: string
          escalated_at: string | null
          escalation_note: string | null
          first_reviewed_at: string | null
          id: string
          insurance_expiry: string | null
          insurance_provider: string | null
          phone: string | null
          postcode: string
          priority: string
          reference: string | null
          requested_fields: string[]
          resubmitted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_note: string | null
          status: string
          tracking_token: string | null
          trade_slug: string | null
          updated_at: string
          verification: Json
          verified_at: string | null
          website: string | null
          years: number
        }
        Insert: {
          about?: string
          accreditations?: string | null
          applicant_message?: string | null
          changes_requested_at?: string | null
          companies_house?: string | null
          company: string
          contact_name: string
          created_at?: string
          due_at?: string | null
          email: string
          escalated_at?: string | null
          escalation_note?: string | null
          first_reviewed_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          phone?: string | null
          postcode: string
          priority?: string
          reference?: string | null
          requested_fields?: string[]
          resubmitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          tracking_token?: string | null
          trade_slug?: string | null
          updated_at?: string
          verification?: Json
          verified_at?: string | null
          website?: string | null
          years?: number
        }
        Update: {
          about?: string
          accreditations?: string | null
          applicant_message?: string | null
          changes_requested_at?: string | null
          companies_house?: string | null
          company?: string
          contact_name?: string
          created_at?: string
          due_at?: string | null
          email?: string
          escalated_at?: string | null
          escalation_note?: string | null
          first_reviewed_at?: string | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          phone?: string | null
          postcode?: string
          priority?: string
          reference?: string | null
          requested_fields?: string[]
          resubmitted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_note?: string | null
          status?: string
          tracking_token?: string | null
          trade_slug?: string | null
          updated_at?: string
          verification?: Json
          verified_at?: string | null
          website?: string | null
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "pro_applications_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      pro_availability: {
        Row: {
          active: boolean
          created_at: string
          end_minute: number
          id: string
          pro_id: string
          slot_minutes: number
          start_minute: number
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_minute: number
          id?: string
          pro_id: string
          slot_minutes?: number
          start_minute: number
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_minute?: number
          id?: string
          pro_id?: string
          slot_minutes?: number
          start_minute?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "pro_availability_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "pro_availability_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_credentials: {
        Row: {
          created_at: string
          expires_on: string | null
          id: string
          kind: string
          label: string
          pro_id: string
          reference: string | null
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_on?: string | null
          id?: string
          kind?: string
          label: string
          pro_id: string
          reference?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_on?: string | null
          id?: string
          kind?: string
          label?: string
          pro_id?: string
          reference?: string | null
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_credentials_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "pro_credentials_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_feature_audit: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          is_featured: boolean
          pro_id: string
          pro_name: string
          published: boolean
          verified_credentials: number
          was_featured: boolean | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          is_featured: boolean
          pro_id: string
          pro_name?: string
          published?: boolean
          verified_credentials?: number
          was_featured?: boolean | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          pro_id?: string
          pro_name?: string
          published?: boolean
          verified_credentials?: number
          was_featured?: boolean | null
        }
        Relationships: []
      }
      pro_projects: {
        Row: {
          after_url: string | null
          before_url: string | null
          completed_on: string | null
          created_at: string
          id: string
          pro_id: string
          published: boolean
          sort_order: number
          summary: string
          title: string
          trade_slug: string
        }
        Insert: {
          after_url?: string | null
          before_url?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          pro_id: string
          published?: boolean
          sort_order?: number
          summary?: string
          title: string
          trade_slug: string
        }
        Update: {
          after_url?: string | null
          before_url?: string | null
          completed_on?: string | null
          created_at?: string
          id?: string
          pro_id?: string
          published?: boolean
          sort_order?: number
          summary?: string
          title?: string
          trade_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_projects_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "pro_projects_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_projects_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pros: {
        Row: {
          area: string
          area_slug: string | null
          availability: Database["public"]["Enums"]["availability"]
          bio: string
          company: string
          created_at: string
          day_rate: number | null
          featured: boolean
          id: string
          min_job_budget: number
          name: string
          photo: number
          postcode: string | null
          published: boolean
          rating: number
          response_mins: number
          review_count: number
          services: string[]
          trade_slug: string
          updated_at: string
          user_id: string | null
          years: number
        }
        Insert: {
          area: string
          area_slug?: string | null
          availability?: Database["public"]["Enums"]["availability"]
          bio?: string
          company: string
          created_at?: string
          day_rate?: number | null
          featured?: boolean
          id: string
          min_job_budget?: number
          name: string
          photo?: number
          postcode?: string | null
          published?: boolean
          rating?: number
          response_mins?: number
          review_count?: number
          services?: string[]
          trade_slug: string
          updated_at?: string
          user_id?: string | null
          years?: number
        }
        Update: {
          area?: string
          area_slug?: string | null
          availability?: Database["public"]["Enums"]["availability"]
          bio?: string
          company?: string
          created_at?: string
          day_rate?: number | null
          featured?: boolean
          id?: string
          min_job_budget?: number
          name?: string
          photo?: number
          postcode?: string | null
          published?: boolean
          rating?: number
          response_mins?: number
          review_count?: number
          services?: string[]
          trade_slug?: string
          updated_at?: string
          user_id?: string | null
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "pros_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      questions: {
        Row: {
          area: string | null
          asker_name: string
          body: string
          created_at: string
          id: string
          published_at: string | null
          status: string
          title: string
          trade_slug: string | null
        }
        Insert: {
          area?: string | null
          asker_name?: string
          body: string
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          title: string
          trade_slug?: string | null
        }
        Update: {
          area?: string | null
          asker_name?: string
          body?: string
          created_at?: string
          id?: string
          published_at?: string | null
          status?: string
          title?: string
          trade_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string | null
          author_name: string
          author_place: string | null
          body: string
          created_at: string
          id: string
          job_type: string | null
          pro_id: string
          rating: number
          status: Database["public"]["Enums"]["review_status"]
          title: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          author_place?: string | null
          body: string
          created_at?: string
          id?: string
          job_type?: string | null
          pro_id: string
          rating: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          author_place?: string | null
          body?: string
          created_at?: string
          id?: string
          job_type?: string | null
          pro_id?: string
          rating?: number
          status?: Database["public"]["Enums"]["review_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "reviews_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      security_scan_runs: {
        Row: {
          alerted: boolean
          created_at: string
          failed: number
          id: string
          results: Json
          source: string
          total: number
        }
        Insert: {
          alerted?: boolean
          created_at?: string
          failed?: number
          id?: string
          results?: Json
          source?: string
          total?: number
        }
        Update: {
          alerted?: boolean
          created_at?: string
          failed?: number
          id?: string
          results?: Json
          source?: string
          total?: number
        }
        Relationships: []
      }
      security_scan_secret: {
        Row: {
          created_at: string
          id: boolean
          token: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          token?: string
        }
        Relationships: []
      }
      trade_hero_images: {
        Row: {
          alt_text: string | null
          focal: string
          focal_mobile: string
          image_url: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text?: string | null
          focal?: string
          focal_mobile?: string
          image_url?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string | null
          focal?: string
          focal_mobile?: string
          image_url?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_hero_images_slug_fkey"
            columns: ["slug"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      trades: {
        Row: {
          blurb: string
          name: string
          slug: string
          sort_order: number
          typical_cost: string
        }
        Insert: {
          blurb: string
          name: string
          slug: string
          sort_order?: number
          typical_cost: string
        }
        Update: {
          blurb?: string
          name?: string
          slug?: string
          sort_order?: number
          typical_cost?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          last_position_notified: number | null
          launch_notified_at: string | null
          metadata: Json
          name: string | null
          note: string | null
          notify_launch: boolean
          notify_updates: boolean
          phone: string | null
          postcode: string
          postcode_area: string | null
          role: string
          source: string
          trade: string | null
        }
        Insert: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          last_position_notified?: number | null
          launch_notified_at?: string | null
          metadata?: Json
          name?: string | null
          note?: string | null
          notify_launch?: boolean
          notify_updates?: boolean
          phone?: string | null
          postcode: string
          postcode_area?: string | null
          role: string
          source?: string
          trade?: string | null
        }
        Update: {
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          last_position_notified?: number | null
          launch_notified_at?: string | null
          metadata?: Json
          name?: string | null
          note?: string | null
          notify_launch?: boolean
          notify_updates?: boolean
          phone?: string | null
          postcode?: string
          postcode_area?: string | null
          role?: string
          source?: string
          trade?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      pro_trust: {
        Row: {
          pro_id: string | null
          score: number | null
          total_credentials: number | null
          trade_slug: string | null
          verified_credentials: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pros_trade_slug_fkey"
            columns: ["trade_slug"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["slug"]
          },
        ]
      }
      reviews_public: {
        Row: {
          author_name: string | null
          body: string | null
          created_at: string | null
          id: string | null
          job_type: string | null
          pro_id: string | null
          rating: number | null
          status: Database["public"]["Enums"]["review_status"] | null
          title: string | null
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          job_type?: string | null
          pro_id?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title?: string | null
        }
        Update: {
          author_name?: string | null
          body?: string | null
          created_at?: string | null
          id?: string | null
          job_type?: string | null
          pro_id?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pro_trust"
            referencedColumns: ["pro_id"]
          },
          {
            foreignKeyName: "reviews_pro_id_fkey"
            columns: ["pro_id"]
            isOneToOne: false
            referencedRelation: "pros"
            referencedColumns: ["id"]
          },
        ]
      }
      waiting_list_counts_by_area: {
        Row: {
          first_signup_at: string | null
          latest_signup_at: string | null
          postcode_area: string | null
          role: string | null
          signups: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_to_waiting_list: {
        Args: {
          p_email: string
          p_name?: string
          p_note?: string
          p_phone?: string
          p_postcode: string
          p_role: string
          p_source?: string
          p_trade?: string
        }
        Returns: Json
      }
      answer_question: {
        Args: { p_body: string; p_question_id: string; p_user_id: string }
        Returns: string
      }
      ask_question: {
        Args: {
          p_area?: string
          p_asker_name?: string
          p_body: string
          p_title: string
          p_trade_slug?: string
        }
        Returns: string
      }
      confirm_waiting_list: { Args: { p_token: string }; Returns: Json }
      featured_pro_regression: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          passed: boolean
        }[]
      }
      form_block_daily: {
        Args: { p_days?: number }
        Returns: {
          day: string
          form: string
          hits: number
          reason: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      log_form_block: {
        Args: { p_form: string; p_reason: string }
        Returns: undefined
      }
      mark_waiting_list_email_sent: {
        Args: { p_id: string }
        Returns: undefined
      }
      match_pros: {
        Args: {
          p_budget?: string
          p_job_id?: string
          p_limit?: number
          p_postcode?: string
          p_trade: string
        }
        Returns: {
          area: string
          availability: Database["public"]["Enums"]["availability"]
          company: string
          day_rate: number
          match_score: number
          name: string
          photo: number
          pro_id: string
          rating: number
          reason: string
          response_mins: number
          review_count: number
          trade_slug: string
          trust_score: number
          years: number
        }[]
      }
      pro_application_id_for_token: {
        Args: { p_token: string }
        Returns: string
      }
      pro_application_resubmit: {
        Args: { p_message?: string; p_token: string; p_updates: Json }
        Returns: Json
      }
      pro_application_sla: { Args: never; Returns: Json }
      pro_application_status: { Args: { p_token: string }; Returns: Json }
      pro_booked_slots: {
        Args: { p_pro_id: string }
        Returns: {
          slot_start: string
        }[]
      }
      prune_api_access_events: { Args: never; Returns: undefined }
      public_questions: {
        Args: { p_limit?: number; p_trade?: string }
        Returns: {
          answer_count: number
          area: string
          asker_name: string
          body: string
          id: string
          published_at: string
          title: string
          trade_slug: string
        }[]
      }
      request_booking: {
        Args: {
          p_contact_email: string
          p_contact_name: string
          p_contact_phone?: string
          p_notes?: string
          p_postcode?: string
          p_pro_id: string
          p_slot_start: string
        }
        Returns: Json
      }
      security_access_matrix: {
        Args: never
        Returns: {
          audience: string
          command: string
          expression: string
          object_kind: string
          object_name: string
          policy_name: string
          rls_enabled: boolean
          roles: string
        }[]
      }
      security_caller_is_admin: { Args: never; Returns: boolean }
      security_posture_check: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          passed: boolean
        }[]
      }
      security_privilege_probe: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          passed: boolean
        }[]
      }
      security_rbac_probe: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          passed: boolean
        }[]
      }
      security_regression_run: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          passed: boolean
          suite: string
        }[]
      }
      security_scan_token_matches: {
        Args: { p_token: string }
        Returns: boolean
      }
      submit_pro_application: {
        Args: {
          p_about?: string
          p_accreditations?: string
          p_companies_house?: string
          p_company: string
          p_contact_name: string
          p_email: string
          p_insurance_expiry?: string
          p_insurance_provider?: string
          p_phone?: string
          p_postcode: string
          p_trade_slug?: string
          p_website?: string
          p_years?: number
        }
        Returns: string
      }
      waiting_list_admin_summary: {
        Args: never
        Returns: {
          confirmed: number
          homeowners: number
          last_signup: string
          postcode_area: string
          total: number
          traders: number
          trades: string
        }[]
      }
      waiting_list_area_recipients: {
        Args: { p_area: string }
        Returns: {
          email: string
          id: string
          last_position_notified: number
          launch_notified_at: string
          name: string
          notify_launch: boolean
          postcode: string
          queue_position: number
          role: string
          trade: string
        }[]
      }
      waiting_list_area_total: { Args: { p_area: string }; Returns: number }
      waiting_list_demand: {
        Args: never
        Returns: {
          first_signup: string
          homeowners: number
          postcode_area: string
          total: number
          traders: number
        }[]
      }
      waiting_list_details: { Args: { p_token: string }; Returns: Json }
      waiting_list_mark_launch_notified: {
        Args: { p_id: string }
        Returns: undefined
      }
      waiting_list_mark_position_notified: {
        Args: { p_id: string; p_position: number }
        Returns: undefined
      }
      waiting_list_set_prefs: {
        Args: {
          p_notify_launch: boolean
          p_notify_updates: boolean
          p_token: string
        }
        Returns: Json
      }
      waiting_list_trend: {
        Args: { p_weeks?: number }
        Returns: {
          cumulative: number
          postcode_area: string
          signups: number
          week: string
        }[]
      }
      waiting_list_update_details: {
        Args: { p_postcode: string; p_token: string; p_trade: string }
        Returns: Json
      }
    }
    Enums: {
      account_type: "customer" | "tradesman"
      app_role: "admin" | "moderator" | "user"
      availability: "immediate" | "within_week" | "within_month" | "booked"
      job_status: "open" | "matched" | "closed"
      review_status: "published" | "pending" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["customer", "tradesman"],
      app_role: ["admin", "moderator", "user"],
      availability: ["immediate", "within_week", "within_month", "booked"],
      job_status: ["open", "matched", "closed"],
      review_status: ["published", "pending", "rejected"],
    },
  },
} as const
