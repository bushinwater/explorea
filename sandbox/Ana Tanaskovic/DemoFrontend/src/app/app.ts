import { Component, signal } from '@angular/core';
import { PostsComponent } from './components/posts/posts';

@Component({
  selector: 'app-root',
  imports: [PostsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('DemoFrontend');
}
