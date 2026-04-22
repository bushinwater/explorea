import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthContextService } from '../../features/admin/core/services/admin-auth-context.service';

export const adminUsersAccessGuard: CanActivateFn = () => {
  const authContext = inject(AdminAuthContextService);
  const router = inject(Router);

  if (authContext.canViewUsersPage()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
