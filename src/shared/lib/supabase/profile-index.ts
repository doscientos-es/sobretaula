export interface ProfileSummary {
  display_name: string
  email: string
  user_id: string
}

/** Indexes public profiles after an RLS-protected membership lookup. */
export function indexProfilesByUserId(profiles: ProfileSummary[]): Map<string, ProfileSummary> {
  return new Map(profiles.map((profile) => [profile.user_id, profile]))
}