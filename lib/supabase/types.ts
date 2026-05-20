export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          role: 'user' | 'admin'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          role?: 'user' | 'admin'
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          role?: 'user' | 'admin'
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
          logo_league_folder: string
          logo_team_slug: string
          manager_id: string | null
          abandon_count: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          logo_league_folder: string
          logo_team_slug: string
          manager_id?: string | null
          abandon_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          logo_league_folder?: string
          logo_team_slug?: string
          manager_id?: string | null
          abandon_count?: number
          created_at?: string
        }
        Relationships: []
      }
      team_change_requests: {
        Row: {
          id: string
          requesting_user_id: string
          current_team_id: string | null
          requested_team_id: string
          status: 'pending' | 'approved' | 'denied'
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          requesting_user_id: string
          current_team_id?: string | null
          requested_team_id: string
          status?: 'pending' | 'approved' | 'denied'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          requesting_user_id?: string
          current_team_id?: string | null
          requested_team_id?: string
          status?: 'pending' | 'approved' | 'denied'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: string
          name: string
          base_league: string
          status: 'upcoming' | 'active' | 'completed'
          start_date: string | null
          end_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          base_league: string
          status?: 'upcoming' | 'active' | 'completed'
          start_date?: string | null
          end_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          base_league?: string
          status?: 'upcoming' | 'active' | 'completed'
          start_date?: string | null
          end_date?: string | null
          created_at?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          id: string
          season_id: string | null
          name: string
          type: 'league' | 'ucl' | 'europa' | 'super_cup'
          status: string
          settings: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          season_id?: string | null
          name: string
          type: 'league' | 'ucl' | 'europa' | 'super_cup'
          status?: string
          settings?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          season_id?: string | null
          name?: string
          type?: 'league' | 'ucl' | 'europa' | 'super_cup'
          status?: string
          settings?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          id: string
          tournament_id: string
          team_id: string
          group_name: string | null
          seed_pot: number | null
        }
        Insert: {
          id?: string
          tournament_id: string
          team_id: string
          group_name?: string | null
          seed_pot?: number | null
        }
        Update: {
          id?: string
          tournament_id?: string
          team_id?: string
          group_name?: string | null
          seed_pot?: number | null
        }
        Relationships: []
      }
      season_breaks: {
        Row: {
          id: string
          tournament_id: string
          break_start: string
          break_end: string
          reason: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          break_start: string
          break_end: string
          reason?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          break_start?: string
          break_end?: string
          reason?: string | null
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          id: string
          tournament_id: string
          home_team_id: string
          away_team_id: string
          matchday: number
          round_type: 'league' | 'group' | 'qf' | 'sf' | 'final' | 'super_cup'
          leg: number
          scheduled_date: string | null
          status: string
          is_postponed: boolean
          postponed_from: string | null
          deadline: string | null
          matchroom_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          home_team_id: string
          away_team_id: string
          matchday: number
          round_type?: 'league' | 'group' | 'qf' | 'sf' | 'final' | 'super_cup'
          leg?: number
          scheduled_date?: string | null
          status?: string
          is_postponed?: boolean
          postponed_from?: string | null
          deadline?: string | null
          matchroom_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          home_team_id?: string
          away_team_id?: string
          matchday?: number
          round_type?: 'league' | 'group' | 'qf' | 'sf' | 'final' | 'super_cup'
          leg?: number
          scheduled_date?: string | null
          status?: string
          is_postponed?: boolean
          postponed_from?: string | null
          deadline?: string | null
          matchroom_code?: string | null
          created_at?: string
        }
        Relationships: []
      }
      result_confirmations: {
        Row: {
          id: string
          fixture_id: string
          submitted_by: string
          home_score: number
          away_score: number
          confirmed_at: string
        }
        Insert: {
          id?: string
          fixture_id: string
          submitted_by: string
          home_score: number
          away_score: number
          confirmed_at?: string
        }
        Update: {
          id?: string
          fixture_id?: string
          submitted_by?: string
          home_score?: number
          away_score?: number
          confirmed_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          id: string
          fixture_id: string
          home_score: number
          away_score: number
          is_abandoned: boolean
          abandoned_type: 'home' | 'away' | 'both' | null
          finalised_by: string | null
          screenshot_url: string | null
          override_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          fixture_id: string
          home_score: number
          away_score: number
          is_abandoned?: boolean
          abandoned_type?: 'home' | 'away' | 'both' | null
          finalised_by?: string | null
          screenshot_url?: string | null
          override_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          fixture_id?: string
          home_score?: number
          away_score?: number
          is_abandoned?: boolean
          abandoned_type?: 'home' | 'away' | 'both' | null
          finalised_by?: string | null
          screenshot_url?: string | null
          override_reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      match_stats: {
        Row: {
          id: string
          result_id: string
          home_possession: number | null
          away_possession: number | null
          home_shots: number | null
          away_shots: number | null
          home_shots_on_target: number | null
          away_shots_on_target: number | null
          home_fouls: number | null
          away_fouls: number | null
          home_offsides: number | null
          away_offsides: number | null
          home_corners: number | null
          away_corners: number | null
          home_free_kicks: number | null
          away_free_kicks: number | null
          home_passes: number | null
          away_passes: number | null
          home_successful_passes: number | null
          away_successful_passes: number | null
          home_crosses: number | null
          away_crosses: number | null
          home_interceptions: number | null
          away_interceptions: number | null
          home_tackles: number | null
          away_tackles: number | null
          home_saves: number | null
          away_saves: number | null
        }
        Insert: {
          id?: string
          result_id: string
          home_possession?: number | null
          away_possession?: number | null
          home_shots?: number | null
          away_shots?: number | null
          home_shots_on_target?: number | null
          away_shots_on_target?: number | null
          home_fouls?: number | null
          away_fouls?: number | null
          home_offsides?: number | null
          away_offsides?: number | null
          home_corners?: number | null
          away_corners?: number | null
          home_free_kicks?: number | null
          away_free_kicks?: number | null
          home_passes?: number | null
          away_passes?: number | null
          home_successful_passes?: number | null
          away_successful_passes?: number | null
          home_crosses?: number | null
          away_crosses?: number | null
          home_interceptions?: number | null
          away_interceptions?: number | null
          home_tackles?: number | null
          away_tackles?: number | null
          home_saves?: number | null
          away_saves?: number | null
        }
        Update: Partial<Database['public']['Tables']['match_stats']['Insert']>
        Relationships: []
      }
      standings: {
        Row: {
          id: string
          tournament_id: string
          team_id: string
          played: number
          wins: number
          draws: number
          losses: number
          goals_for: number
          goals_against: number
          goal_difference: number
          points: number
          form: string
          unbeaten_run: number
          biggest_win_score: string | null
          biggest_win_opponent_id: string | null
          clean_sheets: number
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          team_id: string
          played?: number
          wins?: number
          draws?: number
          losses?: number
          goals_for?: number
          goals_against?: number
          points?: number
          form?: string
          unbeaten_run?: number
          biggest_win_score?: string | null
          biggest_win_opponent_id?: string | null
          clean_sheets?: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['standings']['Insert']>
        Relationships: []
      }
      group_standings: {
        Row: {
          id: string
          tournament_id: string
          group_name: string
          team_id: string
          played: number
          wins: number
          draws: number
          losses: number
          goals_for: number
          goals_against: number
          goal_difference: number
          points: number
        }
        Insert: {
          id?: string
          tournament_id: string
          group_name: string
          team_id: string
          played?: number
          wins?: number
          draws?: number
          losses?: number
          goals_for?: number
          goals_against?: number
          points?: number
        }
        Update: Partial<Database['public']['Tables']['group_standings']['Insert']>
        Relationships: []
      }
      knockout_rounds: {
        Row: {
          id: string
          tournament_id: string
          round_name: string
          home_team_id: string
          away_team_id: string
          home_agg: number
          away_agg: number
          winner_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          round_name: string
          home_team_id: string
          away_team_id: string
          home_agg?: number
          away_agg?: number
          winner_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['knockout_rounds']['Insert']>
        Relationships: []
      }
      team_name_mappings: {
        Row: {
          id: string
          ocr_name: string
          team_id: string
        }
        Insert: {
          id?: string
          ocr_name: string
          team_id: string
        }
        Update: {
          id?: string
          ocr_name?: string
          team_id?: string
        }
        Relationships: []
      }
      waiting_reports: {
        Row: {
          id: string
          fixture_id: string
          reported_by_team_id: string
          reported_at: string
        }
        Insert: {
          id?: string
          fixture_id: string
          reported_by_team_id: string
          reported_at?: string
        }
        Update: Partial<Database['public']['Tables']['waiting_reports']['Insert']>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          fixture_id: string
          user_id: string
          parent_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          fixture_id: string
          user_id: string
          parent_id?: string | null
          content: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
        Relationships: []
      }
      reactions: {
        Row: {
          id: string
          fixture_id: string
          user_id: string
          emoji: string
        }
        Insert: {
          id?: string
          fixture_id: string
          user_id: string
          emoji: string
        }
        Update: Partial<Database['public']['Tables']['reactions']['Insert']>
        Relationships: []
      }
      predictions: {
        Row: {
          id: string
          fixture_id: string
          user_id: string
          predicted_home_score: number | null
          predicted_away_score: number | null
          points_earned: number
        }
        Insert: {
          id?: string
          fixture_id: string
          user_id: string
          predicted_home_score?: number | null
          predicted_away_score?: number | null
          points_earned?: number
        }
        Update: Partial<Database['public']['Tables']['predictions']['Insert']>
        Relationships: []
      }
      trophies: {
        Row: {
          id: string
          team_id: string
          tournament_id: string
          season_id: string
          trophy_type: 'league' | 'ucl' | 'europa' | 'super_cup'
          awarded_at: string
        }
        Insert: {
          id?: string
          team_id: string
          tournament_id: string
          season_id: string
          trophy_type: 'league' | 'ucl' | 'europa' | 'super_cup'
          awarded_at?: string
        }
        Update: Partial<Database['public']['Tables']['trophies']['Insert']>
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          admin_id: string
          action: string
          target_type: string | null
          target_id: string | null
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          action: string
          target_type?: string | null
          target_id?: string | null
          details?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          created_at: string
        }
        Insert: {
          id?: string
          participant_1: string
          participant_2: string
          created_at?: string
        }
        Update: {
          id?: string
          participant_1?: string
          participant_2?: string
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          gif_url: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string | null
          gif_url?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string | null
          gif_url?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      channel_messages: {
        Row: {
          id: string
          channel_id: string
          sender_id: string
          content: string | null
          gif_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          sender_id: string
          content?: string | null
          gif_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          sender_id?: string
          content?: string | null
          gif_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Season = Database['public']['Tables']['seasons']['Row']
export type Tournament = Database['public']['Tables']['tournaments']['Row']
export type Fixture = Database['public']['Tables']['fixtures']['Row']
export type Result = Database['public']['Tables']['results']['Row']
export type MatchStats = Database['public']['Tables']['match_stats']['Row']
export type Standing = Database['public']['Tables']['standings']['Row']
export type GroupStanding = Database['public']['Tables']['group_standings']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']
export type Trophy = Database['public']['Tables']['trophies']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Reaction = Database['public']['Tables']['reactions']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']
export type TeamChangeRequest = Database['public']['Tables']['team_change_requests']['Row']
export type WaitingReport = Database['public']['Tables']['waiting_reports']['Row']
export type KnockoutRound = Database['public']['Tables']['knockout_rounds']['Row']
export type TournamentParticipant = Database['public']['Tables']['tournament_participants']['Row']
