export interface Event {
  id: number;
  title: string;
  description?: string;
  eventDate: string;
  location?: string;
  isCompleted: boolean;
  created: string;
  updated: string;
  isDeleted: boolean;
  deletedAt: string | null;
}
