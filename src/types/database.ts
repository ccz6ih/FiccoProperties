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
      applications: {
        Row: {
          authorize_landlord_contact: boolean
          authorize_screening: boolean
          created_at: string
          created_by: string | null
          current_address: string | null
          current_residency_length: string | null
          date_of_birth: string | null
          desired_move_in: string | null
          email: string
          employer_name: string | null
          employer_phone: string | null
          first_name: string
          household_size: number | null
          id: string
          id_photo_path: string | null
          landlord_email: string | null
          landlord_name: string | null
          landlord_phone: string | null
          last_name: string
          message: string | null
          monthly_income_cents: number | null
          pets_ack: boolean
          phone: string | null
          property_id: string | null
          reason_for_moving: string | null
          screening_notes: string | null
          screening_report_url: string | null
          screening_requested_at: string | null
          screening_status: string
          signature_name: string | null
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          authorize_landlord_contact?: boolean
          authorize_screening?: boolean
          created_at?: string
          created_by?: string | null
          current_address?: string | null
          current_residency_length?: string | null
          date_of_birth?: string | null
          desired_move_in?: string | null
          email: string
          employer_name?: string | null
          employer_phone?: string | null
          first_name: string
          household_size?: number | null
          id?: string
          id_photo_path?: string | null
          landlord_email?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          last_name: string
          message?: string | null
          monthly_income_cents?: number | null
          pets_ack?: boolean
          phone?: string | null
          property_id?: string | null
          reason_for_moving?: string | null
          screening_notes?: string | null
          screening_report_url?: string | null
          screening_requested_at?: string | null
          screening_status?: string
          signature_name?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          authorize_landlord_contact?: boolean
          authorize_screening?: boolean
          created_at?: string
          created_by?: string | null
          current_address?: string | null
          current_residency_length?: string | null
          date_of_birth?: string | null
          desired_move_in?: string | null
          email?: string
          employer_name?: string | null
          employer_phone?: string | null
          first_name?: string
          household_size?: number | null
          id?: string
          id_photo_path?: string | null
          landlord_email?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          last_name?: string
          message?: string | null
          monthly_income_cents?: number | null
          pets_ack?: boolean
          phone?: string | null
          property_id?: string | null
          reason_for_moving?: string | null
          screening_notes?: string | null
          screening_report_url?: string | null
          screening_requested_at?: string | null
          screening_status?: string
          signature_name?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount_cents: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lease_id: string
          period: string | null
          resident_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lease_id: string
          period?: string | null
          resident_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lease_id?: string
          period?: string | null
          resident_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          resident_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          resident_id: string
          subject?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          resident_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          lease_id: string
          note: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lease_id: string
          note?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lease_id?: string
          note?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_events_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          application_id: string | null
          created_at: string
          deposit_cents: number
          document_url: string | null
          end_date: string | null
          id: string
          rent_cents: number
          resident_id: string
          signature_ip: string | null
          signature_name: string | null
          signed_at: string | null
          start_date: string
          status: string
          terms: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          deposit_cents?: number
          document_url?: string | null
          end_date?: string | null
          id?: string
          rent_cents?: number
          resident_id: string
          signature_ip?: string | null
          signature_name?: string | null
          signed_at?: string | null
          start_date: string
          status?: string
          terms?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          deposit_cents?: number
          document_url?: string | null
          end_date?: string | null
          id?: string
          rent_cents?: number
          resident_id?: string
          signature_ip?: string | null
          signature_name?: string | null
          signed_at?: string | null
          start_date?: string
          status?: string
          terms?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          kind: string
          lease_id: string | null
          memo: string | null
          ref_id: string | null
          resident_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          kind: string
          lease_id?: string | null
          memo?: string | null
          ref_id?: string | null
          resident_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: string
          lease_id?: string | null
          memo?: string | null
          ref_id?: string | null
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          internal: boolean
          request_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          request_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assigned_to: string | null
          category: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          priority: string
          status: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      makeready_tasks: {
        Row: {
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          label: string
          sort: number
          turn_id: string
        }
        Insert: {
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          label: string
          sort?: number
          turn_id: string
        }
        Update: {
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          label?: string
          sort?: number
          turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeready_tasks_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeready_tasks_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "makeready_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      makeready_template_items: {
        Row: {
          id: string
          label: string
          sort: number
          template_id: string
        }
        Insert: {
          id?: string
          label: string
          sort?: number
          template_id: string
        }
        Update: {
          id?: string
          label?: string
          sort?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeready_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "makeready_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      makeready_templates: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      makeready_turns: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          started_by: string | null
          status: string
          template_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          started_by?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          started_by?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "makeready_turns_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeready_turns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "makeready_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeready_turns_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          kind: string
          label: string | null
          profile_id: string
          provider_ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          profile_id: string
          provider_ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          label?: string | null
          profile_id?: string
          provider_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          charge_id: string | null
          created_at: string
          id: string
          method_id: string | null
          provider_ref: string | null
          resident_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          charge_id?: string | null
          created_at?: string
          id?: string
          method_id?: string | null
          provider_ref?: string | null
          resident_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          charge_id?: string | null
          created_at?: string
          id?: string
          method_id?: string | null
          provider_ref?: string | null
          resident_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address_line1: string | null
          amenities: string[]
          city: string | null
          created_at: string
          description: string | null
          hero_image: string | null
          id: string
          name: string
          postal_code: string | null
          slug: string
          state: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          amenities?: string[]
          city?: string | null
          created_at?: string
          description?: string | null
          hero_image?: string | null
          id?: string
          name: string
          postal_code?: string | null
          slug: string
          state?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          amenities?: string[]
          city?: string | null
          created_at?: string
          description?: string | null
          hero_image?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          slug?: string
          state?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tour_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          preferred_date: string | null
          preferred_time: string | null
          property_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          property_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_occupancy: {
        Row: {
          lease_end_date: string | null
          lease_signed_date: string | null
          lease_start_date: string | null
          move_in_date: string | null
          notes: string | null
          occupant_profile_id: string | null
          rent_cents: number | null
          tenant_email: string | null
          tenant_name: string | null
          tenant_phone: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          lease_end_date?: string | null
          lease_signed_date?: string | null
          lease_start_date?: string | null
          move_in_date?: string | null
          notes?: string | null
          occupant_profile_id?: string | null
          rent_cents?: number | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          lease_end_date?: string | null
          lease_signed_date?: string | null
          lease_start_date?: string | null
          move_in_date?: string | null
          notes?: string | null
          occupant_profile_id?: string | null
          rent_cents?: number | null
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_occupancy_occupant_profile_id_fkey"
            columns: ["occupant_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_occupancy_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_photos: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          path: string
          sort: number
          unit_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          path: string
          sort?: number
          unit_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          path?: string
          sort?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_photos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          id: string
          label: string
          notes: string | null
          property_id: string
          rent_cents: number | null
          sqft: number | null
          status: string
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          property_id: string
          rent_cents?: number | null
          sqft?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          property_id?: string
          rent_cents?: number | null
          sqft?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_staff: { Args: never; Returns: boolean }
      settle_charge: {
        Args: {
          p_charge_id: string
          p_method_id: string
          p_provider_ref: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const
