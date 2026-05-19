import { HttpInterceptorFn } from '@angular/common/http';

const BACKEND_URL = 'https://softeng.pmf.kg.ac.rs:10111';

export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocalhost && req.url.startsWith('/api/')) {
    const cloned = req.clone({ url: BACKEND_URL + req.url });
    return next(cloned);
  }

  return next(req);
};
