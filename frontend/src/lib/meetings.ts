export const MEETING_REMINDERS_KEY = 'gd_meeting_reminders'

export type MeetingNotif = {
  id: string
  collaborator: string
  date: string
  time: string
  notes: string
  created_at: string
  dismissed_by: string[]
}
