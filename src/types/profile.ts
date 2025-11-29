export interface IProfileData {
  avatarSrc?: string;
  username?: string;
  userId: string;
  level: number;
  bio?: string;
  repaints: number;
  joined: string;
}

export interface IUpdateProfilePayload {
  username?: string;
  bio?: string;
  avatarSrc?: string;
}

export interface IUserProfile {
  user_id: string;
  username: string | null;
  bio: string | null;
  avatar_src: string | null;
}

export interface IProfileUserStats {
  user_id: string;
  level: number;
}

export interface IProfileUser {
  id: string;
  created_at: string;
}
