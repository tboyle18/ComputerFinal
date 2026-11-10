// AUTO-GENERATED from the database schema. Regenerate after schema changes:
//   supabase gen types typescript --local --schema public > src/types/database.ts
/* eslint-disable */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "added_at": string,"listing_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"listing_id": string,"user_id"?: string
                  }
                  Update: {
                    "added_at"?: string,"listing_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_user_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"checkouts": {
                  Row: {
                    "buyer_id": string | null,"created_at": string,"id": string,"idempotency_key": string,"payment_ref": string,"total_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key": string,"payment_ref": string,"total_cents": number
                  }
                  Update: {
                    "buyer_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"payment_ref"?: string,"total_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkouts_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "buyer_id": string,"buyer_last_read_at": string,"created_at": string,"id": string,"last_message_at": string,"last_message_preview": string,"last_message_sender_id": string | null,"listing_id": string | null,"listing_title": string,"seller_id": string,"seller_last_read_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_message_sender_id"?: string | null,"listing_id"?: string | null,"listing_title": string,"seller_id": string,"seller_last_read_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"buyer_last_read_at"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string,"last_message_preview"?: string,"last_message_sender_id"?: string | null,"listing_id"?: string | null,"listing_title"?: string,"seller_id"?: string,"seller_last_read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seller_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "category": string,"condition": Database["public"]['Enums']["item_condition"],"created_at": string,"currency": string,"description": string,"id": string,"image_paths": (string)[],"location": string,"price_cents": number,"removed_reason": string | null,"search": unknown,"seller_id": string,"sold_at": string | null,"status": Database["public"]['Enums']["listing_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"currency"?: string,"description": string,"id"?: string,"image_paths"?: (string)[],"location"?: string,"price_cents": number,"removed_reason"?: string | null,"search"?: never,"seller_id"?: string,"sold_at"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"condition"?: Database["public"]['Enums']["item_condition"],"created_at"?: string,"currency"?: string,"description"?: string,"id"?: string,"image_paths"?: (string)[],"location"?: string,"price_cents"?: number,"removed_reason"?: string | null,"search"?: never,"seller_id"?: string,"sold_at"?: string | null,"status"?: Database["public"]['Enums']["listing_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "listings_seller_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": number,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: never,"sender_id"?: string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: never,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": number,"image_path": string | null,"listing_id": string | null,"order_id": string,"price_cents": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"image_path"?: string | null,"listing_id"?: string | null,"order_id": string,"price_cents": number,"title": string
                  }
                  Update: {
                    "id"?: never,"image_path"?: string | null,"listing_id"?: string | null,"order_id"?: string,"price_cents"?: number,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "buyer_id": string | null,"checkout_id": string,"created_at": string,"delivered_at": string | null,"id": string,"seller_id": string | null,"ship_city": string,"ship_country": string,"ship_line1": string,"ship_line2": string,"ship_name": string,"ship_postal_code": string,"ship_region": string,"shipped_at": string | null,"status": Database["public"]['Enums']["order_status"],"subtotal_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id"?: string | null,"checkout_id": string,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"seller_id"?: string | null,"ship_city": string,"ship_country": string,"ship_line1": string,"ship_line2"?: string,"ship_name": string,"ship_postal_code": string,"ship_region"?: string,"shipped_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal_cents": number
                  }
                  Update: {
                    "buyer_id"?: string | null,"checkout_id"?: string,"created_at"?: string,"delivered_at"?: string | null,"id"?: string,"seller_id"?: string | null,"ship_city"?: string,"ship_country"?: string,"ship_line1"?: string,"ship_line2"?: string,"ship_name"?: string,"ship_postal_code"?: string,"ship_region"?: string,"shipped_at"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"subtotal_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_checkout_id_fkey"
      columns: ["checkout_id"]
isOneToOne: false
      referencedRelation: "checkouts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_seller_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string,"created_at": string,"display_name": string,"id": string,"location": string,"suspended_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string,"created_at"?: string,"display_name": string,"id": string,"location"?: string,"suspended_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"location"?: string,"suspended_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"details": string,"id": string,"listing_id": string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string | null,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: string,"id"?: string,"listing_id": string,"reason": Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"details"?: string,"id"?: string,"listing_id"?: string,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_get_user":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"admin_list_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_search"?: string }; Returns: {
              "active_listings": number,"created_at": string,"display_name": string,"email": string,"id": string,"is_admin": boolean,"last_sign_in_at": string,"suspended_at": string,"total_count": number
            }[]
                           },
"admin_resolve_report":
{ Args: { "p_report_id": string }; Returns: undefined
                           },
"admin_set_listing_status":
{ Args: { "p_action": string,"p_listing_id": string,"p_reason"?: string }; Returns: undefined
                           },
"admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"checkout":
{ Args: { "p_expected_total_cents": number,"p_idempotency_key": string,"p_shipping": Json }; Returns: string
                           },
"confirm_order_delivered":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_order_shipped":
{ Args: { "p_order_id": string }; Returns: undefined
                           },
"search_listings":
{ Args: { "p_category"?: string,"p_condition"?: Database["public"]['Enums']["item_condition"],"p_limit"?: number,"p_max_price"?: number,"p_min_price"?: number,"p_offset"?: number,"p_query"?: string,"p_seller"?: string,"p_sort"?: string,"p_status"?: Database["public"]['Enums']["listing_status"] }; Returns: {
              "category": string,
"condition": Database["public"]['Enums']["item_condition"],
"created_at": string,
"currency": string,
"description": string,
"id": string,
"image_paths": (string)[],
"location": string,
"price_cents": number,
"removed_reason": string | null,
"search": unknown,
"seller_id": string,
"sold_at": string | null,
"status": Database["public"]['Enums']["listing_status"],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "listings"
        isOneToOne: false
        isSetofReturn: true
      } },
"start_conversation":
{ Args: { "p_listing_id": string }; Returns: string
                           },
"unread_conversation_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           }
          }
          Enums: {
            "item_condition": "new"|"like_new"|"good"|"fair"|"for_parts","listing_status": "active"|"sold"|"removed","order_status": "paid"|"shipped"|"delivered"|"cancelled","report_reason": "prohibited"|"scam"|"counterfeit"|"offensive"|"spam"|"other"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "item_condition": ["new", "like_new", "good", "fair", "for_parts"],"listing_status": ["active", "sold", "removed"],"order_status": ["paid", "shipped", "delivered", "cancelled"],"report_reason": ["prohibited", "scam", "counterfeit", "offensive", "spam", "other"]
          }
        }
} as const
