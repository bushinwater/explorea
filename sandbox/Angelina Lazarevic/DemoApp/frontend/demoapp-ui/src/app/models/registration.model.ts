import { EventModel } from './event.model';

export interface RegistrationModel {
  id: number;
  registeredAt: string;
  event: EventModel;
}