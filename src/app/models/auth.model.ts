export interface JellyfinUser {
  Id: string;
  Name: string;
  PrimaryImageTag?: string;
  ServerId?: string;
  Policy?: Record<string, unknown>;
  Configuration?: Record<string, unknown>;
}

export interface JellyfinSessionInfo {
  Id?: string;
  DeviceId?: string;
  Client?: string;
}

export interface AuthSession {
  AccessToken: string;
  ServerId?: string;
  User: JellyfinUser;
  SessionInfo?: JellyfinSessionInfo;
}
