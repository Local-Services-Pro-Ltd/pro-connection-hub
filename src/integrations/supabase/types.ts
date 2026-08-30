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
            referencedRelation: "pros"
            referencedColumns: ["id"]
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
            referencedRelation: "pros"
            referencedColumns: ["id"]
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
          metadata: Json
          name: string | null
          note: string | null
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
          metadata?: Json
          name?: string | null
          note?: string | null
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
          metadata?: Json
          name?: string | null
          note?: string | null
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
      confirm_waiting_list: { Args: { p_token: string }; Returns: Json }
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
