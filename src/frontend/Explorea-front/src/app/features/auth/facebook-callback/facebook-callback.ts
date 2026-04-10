import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-facebook-callback',
  standalone: true,
  template: '',
})
export class FacebookCallback implements OnInit {
  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'facebook-oauth-code', code, error },
        window.location.origin,
      );
    }
    window.close();
  }
}
