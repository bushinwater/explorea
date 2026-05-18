import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminHeader } from '../admin-header/admin-header';
import { LayoutService } from '../../core/services/layout.service';
import { AdminProfileService } from '../../core/services/admin-profile.service';
import { DashboardAuthService } from '../../core/services/dashboard-auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AdminSidebar, AdminHeader],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
})
export class AdminShellComponent implements OnInit {
  constructor(
    public layout: LayoutService,
    private adminProfile: AdminProfileService,
    private dashboardAuth: DashboardAuthService,
  ) {}

  ngOnInit(): void {
    this.dashboardAuth.syncRoleFromJwt();
    this.adminProfile.load().subscribe();
  }
}
