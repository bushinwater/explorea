import { Injectable, signal } from '@angular/core';
import { ObjectRequest } from './object-requests.models';

@Injectable({ providedIn: 'root' })
export class ObjectRequestsService {
  private _request = signal<ObjectRequest | null>(null);
  readonly request = this._request.asReadonly();

  private _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  loadRequestById(id: string) {
    this._loading.set(true);

    setTimeout(() => {
      this._request.set({
        id,
        requestNumber: 'OBJ-2023-442',
        entityId: 'SRB-VEN-9882',
        name: 'Villa Dunav Boutique Hotel',
        city: 'Novi Sad',
        address: 'Dunavska 12, Novi Sad, Serbia',
        region: 'Vojvodina',
        submittedAt: 'Oct 24, 2023',
        heroImageUrl: 'https://picsum.photos/seed/villa-dunav/1200/600',
        priority: 'medium',
        capacityRooms: 24,
        capacityGuests: 48,
        contactPhone: '+381 21 445 990',
        website: 'www.villadunav.rs',
        description:
          'Villa Dunav is a newly renovated historical building transformed into a high-end boutique hotel. The project aims to serve the growing business tourism in Novi Sad. The facility includes a spa, a rooftop terrace overlooking the Danube, and a conference hall for up to 50 participants. All restorations were done in accordance with the Institute for the Protection of Cultural Monuments.',
        features: {
          accessibility: 'Full Access',
          parkingSpaces: '12 Dedicated',
          ecoCertified: 'Green Key',
          openingHours: '24/7 Operations',
        },
        documents: [
          { id: '1', name: 'Business License 2023.pdf', url: '#', size: '2.4 MB' },
          { id: '2', name: 'Safety & Fire Permit.pdf', url: '#', size: '1.1 MB' },
          { id: '3', name: 'Restoration Certificate.pdf', url: '#', size: '4.8 MB' },
          { id: '4', name: 'Environmental Impact Study.pdf', url: '#', size: '1.9 MB' },
        ],
        status: 'pending',
        pipelineSteps: [
          {
            label: 'Initial Submission',
            actor: 'Marko Jovanović (Business Owner)',
            date: 'Oct 24, 09:12 AM',
            comment: 'Proposed a new 4-star boutique hotel in the heart of Novi Sad.',
            state: 'done',
          },
          {
            label: 'Regional TO Review',
            actor: 'Ana Babić (Tourism Operator - Vojvodina)',
            date: 'Oct 25, 02:45 PM',
            comment:
              'Verified on-site facilities. Documentation aligns with regional development plan.',
            state: 'done',
          },
          {
            label: 'Business Owner Confirmation',
            actor: 'System Automated Flow',
            comment: 'Final agreement signature and platform access credentials generation.',
            state: 'active',
          },
        ],
      });

      this._loading.set(false);
    }, 800);
  }

  approveRequest(comment?: string) {
    const req = this._request();
    if (!req) return;
    this._request.set({ ...req, status: 'approved', adminComment: comment });
  }

  rejectRequest(reason: string) {
    const req = this._request();
    if (!req) return;
    this._request.set({ ...req, status: 'rejected', rejectionReason: reason });
  }
}
