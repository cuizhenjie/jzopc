/**
 * 本文件由 scripts/gen-db-types.mjs 自动生成，请勿手改。
 *
 * 数据来源：supabase/migrations/0001_init.sql
 * 重新生成：node scripts/gen-db-types.mjs（也可执行 pnpm db:types）
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** JSON 值类型（与 @supabase/supabase-js 的 Json 定义一致） */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      site_contents: {
        Row: {
          id: number;
          section: string;
          slug: string;
          title: string;
          subtitle: string | null;
          body_md: string | null;
          meta: Json;
          sort_order: number;
          published: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          section: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          body_md?: string | null;
          meta?: Json;
          sort_order?: number;
          published?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: number;
          section?: string;
          slug?: string;
          title?: string;
          subtitle?: string | null;
          body_md?: string | null;
          meta?: Json;
          sort_order?: number;
          published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      empower_modules: {
        Row: {
          slug: string;
          index_no: string;
          title: string;
          tagline: string;
          hero_desc: string | null;
          body_md: string | null;
          values: Json;
          items: Json;
          highlights: Json;
          lead_type: string | null;
          pending: string | null;
          related: string[];
          sort_order: number;
          published: boolean;
          updated_at: string;
        };
        Insert: {
          slug: string;
          index_no: string;
          title: string;
          tagline: string;
          hero_desc?: string | null;
          body_md?: string | null;
          values?: Json;
          items?: Json;
          highlights?: Json;
          lead_type?: string | null;
          pending?: string | null;
          related?: string[];
          sort_order?: number;
          published?: boolean;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          index_no?: string;
          title?: string;
          tagline?: string;
          hero_desc?: string | null;
          body_md?: string | null;
          values?: Json;
          items?: Json;
          highlights?: Json;
          lead_type?: string | null;
          pending?: string | null;
          related?: string[];
          sort_order?: number;
          published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_stats: {
        Row: {
          key: string;
          value: number;
          suffix: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          key: string;
          value: number;
          suffix?: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          key?: string;
          value?: number;
          suffix?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      agent_categories: {
        Row: {
          slug: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          slug: string;
          name: string;
          sort_order?: number;
        };
        Update: {
          slug?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          id: number;
          slug: string;
          name: string;
          category: string;
          summary: string;
          description: string | null;
          icon_url: string | null;
          cover_url: string | null;
          tags: string[];
          external_url: string;
          provider: string | null;
          featured: boolean;
          sort_order: number;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          name: string;
          category: string;
          summary: string;
          description?: string | null;
          icon_url?: string | null;
          cover_url?: string | null;
          tags?: string[];
          external_url: string;
          provider?: string | null;
          featured?: boolean;
          sort_order?: number;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          name?: string;
          category?: string;
          summary?: string;
          description?: string | null;
          icon_url?: string | null;
          cover_url?: string | null;
          tags?: string[];
          external_url?: string;
          provider?: string | null;
          featured?: boolean;
          sort_order?: number;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_category_fkey",
            columns: ["category"],
            isOneToOne: false,
            referencedRelation: "agent_categories",
            referencedColumns: ["slug"],
          },
        ];
      };
      market_items: {
        Row: {
          id: number;
          slug: string;
          type: string;
          title: string;
          category: string;
          summary: string;
          body: Json;
          org_name: string | null;
          tags: string[];
          contact_hint: string | null;
          status: string;
          published_at: string | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          type: string;
          title: string;
          category: string;
          summary: string;
          body?: Json;
          org_name?: string | null;
          tags?: string[];
          contact_hint?: string | null;
          status?: string;
          published_at?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          type?: string;
          title?: string;
          category?: string;
          summary?: string;
          body?: Json;
          org_name?: string | null;
          tags?: string[];
          contact_hint?: string | null;
          status?: string;
          published_at?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: number;
          slug: string;
          track: string;
          title: string;
          summary: string;
          body: Json;
          tags: string[];
          cover_url: string | null;
          mentor: string | null;
          sort_order: number;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          track: string;
          title: string;
          summary: string;
          body?: Json;
          tags?: string[];
          cover_url?: string | null;
          mentor?: string | null;
          sort_order?: number;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          track?: string;
          title?: string;
          summary?: string;
          body?: Json;
          tags?: string[];
          cover_url?: string | null;
          mentor?: string | null;
          sort_order?: number;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      news_posts: {
        Row: {
          id: number;
          slug: string;
          title: string;
          summary: string;
          body: Json;
          cover_url: string | null;
          category: string;
          author: string | null;
          status: string;
          published_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          slug: string;
          title: string;
          summary: string;
          body?: Json;
          cover_url?: string | null;
          category: string;
          author?: string | null;
          status?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          slug?: string;
          title?: string;
          summary?: string;
          body?: Json;
          cover_url?: string | null;
          category?: string;
          author?: string | null;
          status?: string;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          id: number;
          name: string;
          logo_url: string | null;
          website: string | null;
          group_name: string | null;
          sort_order: number;
          published: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          logo_url?: string | null;
          website?: string | null;
          group_name?: string | null;
          sort_order?: number;
          published?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          logo_url?: string | null;
          website?: string | null;
          group_name?: string | null;
          sort_order?: number;
          published?: boolean;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: number;
          lead_type: string;
          name: string;
          contact_type: string;
          contact: string;
          org_name: string | null;
          role: string | null;
          subject_type: string | null;
          team_size: number | null;
          track: string | null;
          message: string | null;
          source_page: string;
          source_ref: string | null;
          utm: Json;
          status: string;
          note: string | null;
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          lead_type: string;
          name: string;
          contact_type: string;
          contact: string;
          org_name?: string | null;
          role?: string | null;
          subject_type?: string | null;
          team_size?: number | null;
          track?: string | null;
          message?: string | null;
          source_page: string;
          source_ref?: string | null;
          utm?: Json;
          status?: string;
          note?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          lead_type?: string;
          name?: string;
          contact_type?: string;
          contact?: string;
          org_name?: string | null;
          role?: string | null;
          subject_type?: string | null;
          team_size?: number | null;
          track?: string | null;
          message?: string | null;
          source_page?: string;
          source_ref?: string | null;
          utm?: Json;
          status?: string;
          note?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: number;
          path: string;
          url: string;
          kind: string;
          alt: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          path: string;
          url: string;
          kind: string;
          alt?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          path?: string;
          url?: string;
          kind?: string;
          alt?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/** 编译期自检：Database 必须能直接作为 SupabaseClient 的泛型参数 */
export type DatabaseIsClientCompatible = SupabaseClient<Database>;
