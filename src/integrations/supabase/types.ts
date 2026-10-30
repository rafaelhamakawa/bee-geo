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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      apiaries: {
        Row: {
          address: string | null
          biome: string | null
          city: string | null
          code: string | null
          created_at: string | null
          current_hives: number
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          predominant_vegetation: string | null
          property_name: string | null
          state: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          biome?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          current_hives?: number
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          predominant_vegetation?: string | null
          property_name?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          biome?: string | null
          city?: string | null
          code?: string | null
          created_at?: string | null
          current_hives?: number
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          predominant_vegetation?: string | null
          property_name?: string | null
          state?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      apiary_expenses: {
        Row: {
          amount: number
          apiary_id: string
          category: string
          cost_type: string
          created_at: string
          description: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          occurred_at: string
          payment_method: string | null
          supplier: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          apiary_id: string
          category: string
          cost_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          supplier?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          apiary_id?: string
          category?: string
          cost_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          supplier?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apiary_expenses_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      apiary_sales: {
        Row: {
          apiary_id: string
          buyer: string | null
          created_at: string
          gross_amount: number
          hive_id: string | null
          id: string
          lot_number: string | null
          notes: string | null
          product_type: string
          quantity_kg: number
          sale_date: string
          sales_channel: string | null
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          apiary_id: string
          buyer?: string | null
          created_at?: string
          gross_amount: number
          hive_id?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_type: string
          quantity_kg: number
          sale_date?: string
          sales_channel?: string | null
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          apiary_id?: string
          buyer?: string | null
          created_at?: string
          gross_amount?: number
          hive_id?: string | null
          id?: string
          lot_number?: string | null
          notes?: string | null
          product_type?: string
          quantity_kg?: number
          sale_date?: string
          sales_channel?: string | null
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apiary_sales_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apiary_sales_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      bait_boxes: {
        Row: {
          apiary_id: string
          code: string
          created_at: string
          id: string
          installed_at: string
          latitude: number
          longitude: number
          notes: string | null
          photo_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apiary_id: string
          code: string
          created_at?: string
          id?: string
          installed_at?: string
          latitude: number
          longitude: number
          notes?: string | null
          photo_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apiary_id?: string
          code?: string
          created_at?: string
          id?: string
          installed_at?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          photo_path?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bait_boxes_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      forage_analyses: {
        Row: {
          analysis_mode: string
          analyzed_at: string | null
          apiary_id: string
          biome: string | null
          circle_area_ha: number
          confidence_level: number | null
          created_at: string | null
          dataset_name: string | null
          dataset_version: string | null
          dataset_year: number | null
          forage_area_ha: number
          forage_percentage: number
          gross_hive_capacity: number
          id: string
          safe_hive_capacity: number
          safety_factor: number
          status: string
          technical_notes: string | null
          updated_at: string | null
          user_id: string
          warnings: Json | null
        }
        Insert: {
          analysis_mode: string
          analyzed_at?: string | null
          apiary_id: string
          biome?: string | null
          circle_area_ha?: number
          confidence_level?: number | null
          created_at?: string | null
          dataset_name?: string | null
          dataset_version?: string | null
          dataset_year?: number | null
          forage_area_ha?: number
          forage_percentage?: number
          gross_hive_capacity?: number
          id?: string
          safe_hive_capacity?: number
          safety_factor?: number
          status?: string
          technical_notes?: string | null
          updated_at?: string | null
          user_id: string
          warnings?: Json | null
        }
        Update: {
          analysis_mode?: string
          analyzed_at?: string | null
          apiary_id?: string
          biome?: string | null
          circle_area_ha?: number
          confidence_level?: number | null
          created_at?: string | null
          dataset_name?: string | null
          dataset_version?: string | null
          dataset_year?: number | null
          forage_area_ha?: number
          forage_percentage?: number
          gross_hive_capacity?: number
          id?: string
          safe_hive_capacity?: number
          safety_factor?: number
          status?: string
          technical_notes?: string | null
          updated_at?: string | null
          user_id?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "forage_analyses_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      forage_patches: {
        Row: {
          analysis_id: string
          area_ha: number
          confidence: number | null
          created_at: string | null
          geojson: Json | null
          gross_hives: number
          hive_multiplier: number
          id: string
          is_approved: boolean
          land_cover_type: string | null
          name: string | null
          notes: string | null
          patch_number: number
          percentage: number
          source: string | null
          updated_at: string | null
          user_id: string
          vegetation_type: string | null
        }
        Insert: {
          analysis_id: string
          area_ha?: number
          confidence?: number | null
          created_at?: string | null
          geojson?: Json | null
          gross_hives?: number
          hive_multiplier?: number
          id?: string
          is_approved?: boolean
          land_cover_type?: string | null
          name?: string | null
          notes?: string | null
          patch_number: number
          percentage?: number
          source?: string | null
          updated_at?: string | null
          user_id: string
          vegetation_type?: string | null
        }
        Update: {
          analysis_id?: string
          area_ha?: number
          confidence?: number | null
          created_at?: string | null
          geojson?: Json | null
          gross_hives?: number
          hive_multiplier?: number
          id?: string
          is_approved?: boolean
          land_cover_type?: string | null
          name?: string | null
          notes?: string | null
          patch_number?: number
          percentage?: number
          source?: string | null
          updated_at?: string | null
          user_id?: string
          vegetation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forage_patches_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "forage_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      hive_managements: {
        Row: {
          apiary_id: string
          brood_pattern: string | null
          colony_strength: string | null
          created_at: string
          feeding: string | null
          food_reserve: string | null
          hive_id: string
          id: string
          managed_at: string
          management_type: string | null
          next_review_at: string | null
          notes: string | null
          occupied_frames: number | null
          queen_seen: boolean | null
          queen_status: string | null
          responsible: string | null
          sanitary_status: string | null
          temperament: string | null
          treatment: string | null
          user_id: string
        }
        Insert: {
          apiary_id: string
          brood_pattern?: string | null
          colony_strength?: string | null
          created_at?: string
          feeding?: string | null
          food_reserve?: string | null
          hive_id: string
          id?: string
          managed_at?: string
          management_type?: string | null
          next_review_at?: string | null
          notes?: string | null
          occupied_frames?: number | null
          queen_seen?: boolean | null
          queen_status?: string | null
          responsible?: string | null
          sanitary_status?: string | null
          temperament?: string | null
          treatment?: string | null
          user_id: string
        }
        Update: {
          apiary_id?: string
          brood_pattern?: string | null
          colony_strength?: string | null
          created_at?: string
          feeding?: string | null
          food_reserve?: string | null
          hive_id?: string
          id?: string
          managed_at?: string
          management_type?: string | null
          next_review_at?: string | null
          notes?: string | null
          occupied_frames?: number | null
          queen_seen?: boolean | null
          queen_status?: string | null
          responsible?: string | null
          sanitary_status?: string | null
          temperament?: string | null
          treatment?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hive_managements_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hive_managements_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      hive_production_records: {
        Row: {
          apiary_id: string
          created_at: string
          hive_id: string
          id: string
          lot_number: string | null
          notes: string | null
          produced_at: string
          product_type: string
          quantity_kg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          apiary_id: string
          created_at?: string
          hive_id: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          produced_at?: string
          product_type: string
          quantity_kg: number
          updated_at?: string
          user_id: string
        }
        Update: {
          apiary_id?: string
          created_at?: string
          hive_id?: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          produced_at?: string
          product_type?: string
          quantity_kg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hive_production_records_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hive_production_records_hive_id_fkey"
            columns: ["hive_id"]
            isOneToOne: false
            referencedRelation: "hives"
            referencedColumns: ["id"]
          },
        ]
      }
      hives: {
        Row: {
          apiary_id: string
          code: string
          cover_photo_path: string | null
          created_at: string
          id: string
          introduced_at: string | null
          last_management_at: string | null
          name: string | null
          notes: string | null
          origin: string | null
          purposes: string[]
          queen_identification: string | null
          queen_introduced_at: string | null
          queen_status: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apiary_id: string
          code: string
          cover_photo_path?: string | null
          created_at?: string
          id?: string
          introduced_at?: string | null
          last_management_at?: string | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          purposes?: string[]
          queen_identification?: string | null
          queen_introduced_at?: string | null
          queen_status?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apiary_id?: string
          code?: string
          cover_photo_path?: string | null
          created_at?: string
          id?: string
          introduced_at?: string | null
          last_management_at?: string | null
          name?: string | null
          notes?: string | null
          origin?: string | null
          purposes?: string[]
          queen_identification?: string | null
          queen_introduced_at?: string | null
          queen_status?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hives_apiary_id_fkey"
            columns: ["apiary_id"]
            isOneToOne: false
            referencedRelation: "apiaries"
            referencedColumns: ["id"]
          },
        ]
      }
      honey_price_quotes: {
        Row: {
          created_at: string
          error_message: string | null
          fetched_at: string
          honey_type: string | null
          id: string
          price_avg: number | null
          price_max: number | null
          price_min: number | null
          reference_date: string | null
          region: string | null
          source_name: string
          source_url: string
          state: string | null
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          fetched_at?: string
          honey_type?: string | null
          id?: string
          price_avg?: number | null
          price_max?: number | null
          price_min?: number | null
          reference_date?: string | null
          region?: string | null
          source_name?: string
          source_url?: string
          state?: string | null
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          fetched_at?: string
          honey_type?: string | null
          id?: string
          price_avg?: number | null
          price_max?: number | null
          price_min?: number | null
          reference_date?: string | null
          region?: string | null
          source_name?: string
          source_url?: string
          state?: string | null
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          city: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_apiaries: {
        Args: never
        Returns: {
          address: string
          analysis_count: number
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          notes: string
          recommended_hives: number
          user_email: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          analysis_count: number
          apiary_count: number
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          role: string
        }[]
      }
      admin_update_profile: {
        Args: {
          new_full_name: string
          new_phone: string
          new_role: string
          target_user_id: string
        }
        Returns: undefined
      }
      apiary_economic_summary: {
        Args: { _apiary_id: string; _end: string; _start: string }
        Returns: {
          apiary_id: string
          costs: number
          fixed_costs: number
          honey_produced_kg: number
          honey_revenue: number
          honey_sold_kg: number
          productive_hives: number
          profit: number
          revenue: number
          variable_costs: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tecnico" | "apicultor"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "tecnico", "apicultor"],
    },
  },
} as const
