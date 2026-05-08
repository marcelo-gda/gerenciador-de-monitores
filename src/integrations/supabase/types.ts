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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      event_comments: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_monitors: {
        Row: {
          bonus_tags: string[] | null
          created_at: string
          event_id: string
          id: string
          is_confirmed: boolean
          level: Database["public"]["Enums"]["monitor_level"] | null
          no_transport: boolean
          transport_amount: number
          user_id: string
        }
        Insert: {
          bonus_tags?: string[] | null
          created_at?: string
          event_id: string
          id?: string
          is_confirmed?: boolean
          level?: Database["public"]["Enums"]["monitor_level"] | null
          no_transport?: boolean
          transport_amount?: number
          user_id: string
        }
        Update: {
          bonus_tags?: string[] | null
          created_at?: string
          event_id?: string
          id?: string
          is_confirmed?: boolean
          level?: Database["public"]["Enums"]["monitor_level"] | null
          no_transport?: boolean
          transport_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_monitors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          description: string | null
          emoji: string
          end_date: string | null
          end_time: string
          event_date: string
          google_event_id: string | null
          id: string
          is_deleted: boolean
          is_locked: boolean
          start_time: string
          team: number | null
          title: string
          total_slots: number | null
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          end_date?: string | null
          end_time: string
          event_date: string
          google_event_id?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          start_time: string
          team?: number | null
          title: string
          total_slots?: number | null
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          emoji?: string
          end_date?: string | null
          end_time?: string
          event_date?: string
          google_event_id?: string | null
          id?: string
          is_deleted?: boolean
          is_locked?: boolean
          start_time?: string
          team?: number | null
          title?: string
          total_slots?: number | null
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_sync_log: {
        Row: {
          error_message: string | null
          events_created: number
          events_updated: number
          id: string
          status: string
          synced_at: string
        }
        Insert: {
          error_message?: string | null
          events_created?: number
          events_updated?: number
          id?: string
          status?: string
          synced_at?: string
        }
        Update: {
          error_message?: string | null
          events_created?: number
          events_updated?: number
          id?: string
          status?: string
          synced_at?: string
        }
        Relationships: []
      }
      info_sections: {
        Row: {
          content: string
          emoji: string
          id: string
          section_key: string
          sort_order: number
          title: string
          updated_at: string
          visible_to: string[]
        }
        Insert: {
          content?: string
          emoji?: string
          id?: string
          section_key: string
          sort_order?: number
          title: string
          updated_at?: string
          visible_to?: string[]
        }
        Update: {
          content?: string
          emoji?: string
          id?: string
          section_key?: string
          sort_order?: number
          title?: string
          updated_at?: string
          visible_to?: string[]
        }
        Relationships: []
      }
      hierarchies: {
        Row: {
          description: string
          emoji: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string
          emoji?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string
          emoji?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      roles: {
        Row: {
          description: string
          emoji: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string
          emoji?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string
          emoji?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      party_settings: {
        Row: {
          cache_emoji: string
          cache_value: number
          duration_max: number
          duration_min: number
          id: string
          incentive_message: string
          teams_section_title: string
          teams_visible_to: string[]
          updated_at: string
        }
        Insert: {
          cache_emoji?: string
          cache_value?: number
          duration_max?: number
          duration_min?: number
          id?: string
          incentive_message?: string
          teams_section_title?: string
          teams_visible_to?: string[]
          updated_at?: string
        }
        Update: {
          cache_emoji?: string
          cache_value?: number
          duration_max?: number
          duration_min?: number
          id?: string
          incentive_message?: string
          teams_section_title?: string
          teams_visible_to?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      team_roles: {
        Row: {
          emoji: string
          hierarchy_id: string | null
          hourly_rate: number
          id: string
          name: string
          role_id: string | null
          sort_order: number
          team_id: string
        }
        Insert: {
          emoji?: string
          hierarchy_id?: string | null
          hourly_rate?: number
          id?: string
          name: string
          role_id?: string | null
          sort_order?: number
          team_id: string
        }
        Update: {
          emoji?: string
          hierarchy_id?: string | null
          hourly_rate?: number
          id?: string
          name?: string
          role_id?: string | null
          sort_order?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roles_hierarchy_id_fkey"
            columns: ["hierarchy_id"]
            isOneToOne: false
            referencedRelation: "hierarchies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          message_type: string
          recipient_id: string | null
          related_user_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          recipient_id?: string | null
          related_user_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_type?: string
          recipient_id?: string | null
          related_user_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          created_at: string
          display_name: string
          hierarchy_ids: string[]
          id: string
          identity: string | null
          nickname: string | null
          phone: string | null
          role_ids: string[]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          display_name: string
          hierarchy_ids?: string[]
          id: string
          identity?: string | null
          nickname?: string | null
          phone?: string | null
          role_ids?: string[]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          display_name?: string
          hierarchy_ids?: string[]
          id?: string
          identity?: string | null
          nickname?: string | null
          phone?: string | null
          role_ids?: string[]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_monitor_count: { Args: { _event_id: string }; Returns: number }
      get_profile_emails: {
        Args: Record<string, never>
        Returns: { user_id: string; email: string }[]
      }
      get_total_slots: { Args: { _event_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "special_user" | "normal_user"
      event_type: "sun" | "moon" | "camp"
      monitor_level: "mestre" | "pleno" | "junior" | "trainee"
      user_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "special_user", "normal_user"],
      event_type: ["sun", "moon", "camp"],
      monitor_level: ["mestre", "pleno", "junior", "trainee"],
      user_status: ["pending", "approved", "rejected"],
    },
  },
} as const
