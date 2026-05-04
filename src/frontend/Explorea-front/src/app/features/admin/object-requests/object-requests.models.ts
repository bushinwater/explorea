export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestPriority = 'low' | 'medium' | 'high';
export type PipelineStepState = 'done' | 'active' | 'pending' | 'rejected';

export interface PipelineStep {
  label: string;
  actor: string;
  comment: string;
  date?: string;
  state: PipelineStepState;
}

export interface RequestDocument {
  id: string;
  name: string;
  url: string;
  size?: string;
}

export interface ObjectRequest {
  id: string;
  requestNumber: string;
  entityId: string;
  name: string;
  city: string;
  address: string;
  region: string;
  submittedAt: string;
  heroImageUrl: string;
  priority: RequestPriority;
  capacityRooms?: number;
  capacityGuests?: number;
  contactPhone?: string;
  website?: string;
  description?: string;
  features: {
    accessibility?: string;
    parkingSpaces?: string;
    ecoCertified?: string;
    openingHours?: string;
  };
  documents: RequestDocument[];
  status: RequestStatus;
  pipelineSteps: PipelineStep[];
  adminComment?: string;
  rejectionReason?: string;
}
