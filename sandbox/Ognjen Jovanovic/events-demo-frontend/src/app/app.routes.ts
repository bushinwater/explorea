import { Routes } from '@angular/router';
import { EventsPageComponent } from './pages/events-page/events-page';
import { DEPComponent } from './pages/deleted-events-page/deleted-events-page';
import { EFPComponent } from './components/event-form-page/event-form-page';

export const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  { path: 'events', component: EventsPageComponent },
  { path: 'events/new', component: EFPComponent },
  { path: 'events/edit/:id', component: EFPComponent },
  { path: 'deleted-events', component: DEPComponent },
];
