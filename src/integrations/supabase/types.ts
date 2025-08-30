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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      chat_logs: {
        Row: {
          content: string
          created_at: string
          id: string
          latency_ms: number | null
          message_id: string | null
          model: string | null
          prompt_len: number | null
          response_len: number | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          model?: string | null
          prompt_len?: number | null
          response_len?: number | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_id?: string | null
          model?: string | null
          prompt_len?: number | null
          response_len?: number | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dish_alias: {
        Row: {
          alias: string
          dish_id: string
          id: string
          locale: string | null
        }
        Insert: {
          alias: string
          dish_id: string
          id?: string
          locale?: string | null
        }
        Update: {
          alias?: string
          dish_id?: string
          id?: string
          locale?: string | null
        }
        Relationships: []
      }
      dish_canon: {
        Row: {
          category: string | null
          constraints: Json | null
          id: string
          methods: string[] | null
          name_en: string
          name_hi: string | null
          region: string | null
          synonyms: string[] | null
          typical_portion: string | null
          units: string | null
        }
        Insert: {
          category?: string | null
          constraints?: Json | null
          id?: string
          methods?: string[] | null
          name_en: string
          name_hi?: string | null
          region?: string | null
          synonyms?: string[] | null
          typical_portion?: string | null
          units?: string | null
        }
        Update: {
          category?: string | null
          constraints?: Json | null
          id?: string
          methods?: string[] | null
          name_en?: string
          name_hi?: string | null
          region?: string | null
          synonyms?: string[] | null
          typical_portion?: string | null
          units?: string | null
        }
        Relationships: []
      }
      dish_catalog: {
        Row: {
          carbs_g: number | null
          catalog_key: string
          created_at: string | null
          cuisine: string | null
          default_serving: string | null
          fat_g: number | null
          id: string
          kcal: number | null
          name: string
          protein_g: number | null
          tags: Json | null
        }
        Insert: {
          carbs_g?: number | null
          catalog_key: string
          created_at?: string | null
          cuisine?: string | null
          default_serving?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name: string
          protein_g?: number | null
          tags?: Json | null
        }
        Update: {
          carbs_g?: number | null
          catalog_key?: string
          created_at?: string | null
          cuisine?: string | null
          default_serving?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          name?: string
          protein_g?: number | null
          tags?: Json | null
        }
        Relationships: []
      }
      dish_synonyms: {
        Row: {
          catalog_key: string
          id: string
          name: string
        }
        Insert: {
          catalog_key: string
          id?: string
          name: string
        }
        Update: {
          catalog_key?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_synonyms_catalog"
            columns: ["catalog_key"]
            isOneToOne: false
            referencedRelation: "dish_catalog"
            referencedColumns: ["catalog_key"]
          },
        ]
      }
      meal_logs: {
        Row: {
          carbs_g: number | null
          created_at: string | null
          dish_name: string
          dish_name_ci: string | null
          fat_g: number | null
          id: string
          image_url: string | null
          kcal: number | null
          meal_day_ist: string | null
          meal_time: string
          notes: string | null
          protein_g: number | null
          quantity: number | null
          source: string
          unit: string | null
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          created_at?: string | null
          dish_name: string
          dish_name_ci?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          kcal?: number | null
          meal_day_ist?: string | null
          meal_time?: string
          notes?: string | null
          protein_g?: number | null
          quantity?: number | null
          source: string
          unit?: string | null
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          created_at?: string | null
          dish_name?: string
          dish_name_ci?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          kcal?: number | null
          meal_day_ist?: string | null
          meal_time?: string
          notes?: string | null
          protein_g?: number | null
          quantity?: number | null
          source?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nudges: {
        Row: {
          delivered_at: string | null
          id: string
          payload: Json | null
          ts: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          delivered_at?: string | null
          id?: string
          payload?: Json | null
          ts?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          delivered_at?: string | null
          id?: string
          payload?: Json | null
          ts?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nutrition_facts: {
        Row: {
          dish_id: string | null
          id: string
          per_100g: Json | null
          per_portion: Json | null
          source: string | null
        }
        Insert: {
          dish_id?: string | null
          id?: string
          per_100g?: Json | null
          per_portion?: Json | null
          source?: string | null
        }
        Update: {
          dish_id?: string | null
          id?: string
          per_100g?: Json | null
          per_portion?: Json | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_facts_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dish_canon"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_results: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          lang: string | null
          lines: Json | null
          photo_id: string | null
          provider: string | null
          raw_text: string | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          lang?: string | null
          lines?: Json | null
          photo_id?: string | null
          provider?: string | null
          raw_text?: string | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          lang?: string | null
          lines?: Json | null
          photo_id?: string | null
          provider?: string | null
          raw_text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_results_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string | null
          height: number | null
          id: string
          meta: Json | null
          storage_path: string
          user_id: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          height?: number | null
          id?: string
          meta?: Json | null
          storage_path: string
          user_id?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          height?: number | null
          id?: string
          meta?: Json | null
          storage_path?: string
          user_id?: string | null
          width?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          age_years: number | null
          allergies: string[] | null
          bps_notes: string | null
          conditions: Json | null
          created_at: string | null
          cuisines: string[] | null
          diet: Database["public"]["Enums"]["diet_type"] | null
          diet_type: Database["public"]["Enums"]["diet_type_v2"] | null
          display_name: string | null
          dob: string | null
          flags: Json | null
          gender: string | null
          halal: boolean | null
          health_goals: string | null
          height_cm: number | null
          is_halal: boolean | null
          is_jain: boolean | null
          jain: boolean | null
          locale: string | null
          portions: Json | null
          prefs: Json | null
          sex: string | null
          sleep_hours: number | null
          stress_level: string | null
          targets: Json | null
          updated_at: string | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          age_years?: number | null
          allergies?: string[] | null
          bps_notes?: string | null
          conditions?: Json | null
          created_at?: string | null
          cuisines?: string[] | null
          diet?: Database["public"]["Enums"]["diet_type"] | null
          diet_type?: Database["public"]["Enums"]["diet_type_v2"] | null
          display_name?: string | null
          dob?: string | null
          flags?: Json | null
          gender?: string | null
          halal?: boolean | null
          health_goals?: string | null
          height_cm?: number | null
          is_halal?: boolean | null
          is_jain?: boolean | null
          jain?: boolean | null
          locale?: string | null
          portions?: Json | null
          prefs?: Json | null
          sex?: string | null
          sleep_hours?: number | null
          stress_level?: string | null
          targets?: Json | null
          updated_at?: string | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          age_years?: number | null
          allergies?: string[] | null
          bps_notes?: string | null
          conditions?: Json | null
          created_at?: string | null
          cuisines?: string[] | null
          diet?: Database["public"]["Enums"]["diet_type"] | null
          diet_type?: Database["public"]["Enums"]["diet_type_v2"] | null
          display_name?: string | null
          dob?: string | null
          flags?: Json | null
          gender?: string | null
          halal?: boolean | null
          health_goals?: string | null
          height_cm?: number | null
          is_halal?: boolean | null
          is_jain?: boolean | null
          jain?: boolean | null
          locale?: string | null
          portions?: Json | null
          prefs?: Json | null
          sex?: string | null
          sleep_hours?: number | null
          stress_level?: string | null
          targets?: Json | null
          updated_at?: string | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      synonyms: {
        Row: {
          dish_id: string | null
          id: string
          lang: string | null
          surface: string
          weight: number | null
        }
        Insert: {
          dish_id?: string | null
          id?: string
          lang?: string | null
          surface: string
          weight?: number | null
        }
        Update: {
          dish_id?: string | null
          id?: string
          lang?: string | null
          surface?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "synonyms_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dish_canon"
            referencedColumns: ["id"]
          },
        ]
      }
      targets: {
        Row: {
          calories_per_day: number | null
          carbs_g: number | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          protein_g: number | null
          sodium_mg: number | null
          steps: number | null
          sugar_g: number | null
          tdee_kcal: number | null
          updated_at: string | null
          user_id: string | null
          water_ml: number | null
        }
        Insert: {
          calories_per_day?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          protein_g?: number | null
          sodium_mg?: number | null
          steps?: number | null
          sugar_g?: number | null
          tdee_kcal?: number | null
          updated_at?: string | null
          user_id?: string | null
          water_ml?: number | null
        }
        Update: {
          calories_per_day?: number | null
          carbs_g?: number | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          protein_g?: number | null
          sodium_mg?: number | null
          steps?: number | null
          sugar_g?: number | null
          tdee_kcal?: number | null
          updated_at?: string | null
          user_id?: string | null
          water_ml?: number | null
        }
        Relationships: []
      }
      user_portion_overrides: {
        Row: {
          catalog_key: string
          grams: number | null
          id: string
          ml: number | null
          serving: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          catalog_key: string
          grams?: number | null
          id?: string
          ml?: number | null
          serving: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          catalog_key?: string
          grams?: number | null
          id?: string
          ml?: number | null
          serving?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_upo_catalog"
            columns: ["catalog_key"]
            isOneToOne: false
            referencedRelation: "dish_catalog"
            referencedColumns: ["catalog_key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      dish_nn: {
        Args: { match_limit?: number; q: string }
        Returns: {
          cuisine: string
          id: string
          is_veg: boolean
          jain_adaptable: boolean
          name: string
          protein_level: string
          similarity: number
          tags: string[]
        }[]
      }
      exec_sql: {
        Args: { params: Json; sql: string }
        Returns: undefined
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      merge_profile_targets: {
        Args: { p_targets_patch: Json; p_user_id: string }
        Returns: Json
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      upsert_dish: {
        Args: {
          p_cuisine: string
          p_embedding_text: string
          p_is_veg: boolean
          p_jain_adaptable: boolean
          p_name: string
          p_protein_level: string
          p_tags: string[]
        }
        Returns: undefined
      }
      upsert_dish_admin: {
        Args: {
          p_cuisine: string
          p_embedding_text: string
          p_is_veg: boolean
          p_jain_adaptable: boolean
          p_name: string
          p_protein_level: string
          p_tags: string[]
        }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      diet_type:
        | "omnivore"
        | "vegetarian"
        | "ovo_vegetarian"
        | "pescatarian"
        | "vegan"
        | "non_vegetarian"
      diet_type_v2:
        | "vegetarian"
        | "ovo_vegetarian"
        | "eggetarian"
        | "pescatarian"
        | "vegan"
        | "jain"
        | "non_vegetarian"
      meal_source: "photo" | "menu" | "manual"
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
      diet_type: [
        "omnivore",
        "vegetarian",
        "ovo_vegetarian",
        "pescatarian",
        "vegan",
        "non_vegetarian",
      ],
      diet_type_v2: [
        "vegetarian",
        "ovo_vegetarian",
        "eggetarian",
        "pescatarian",
        "vegan",
        "jain",
        "non_vegetarian",
      ],
      meal_source: ["photo", "menu", "manual"],
    },
  },
} as const
