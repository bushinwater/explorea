import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Post } from '../post';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root',
})
export class Posts {
  private apiUrl = 'http://localhost:5023/api/posts';

  constructor(
    private http: HttpClient,
    private authService: Auth,
  ) {}

  private getAdminHeaders(): { headers: HttpHeaders } {
    const user = this.authService.getCurrentUser();
    const headers = new HttpHeaders({ UserId: user?.id?.toString() ?? '' });
    return { headers };
  }

  getPosts(): Observable<Post[]> {
    return this.http.get<Post[]>(this.apiUrl);
  }

  addPost(post: Post): Observable<Post> {
    return this.http.post<Post>(this.apiUrl, post, this.getAdminHeaders());
  }

  updatePost(post: Post): Observable<Post> {
    return this.http.put<Post>(`${this.apiUrl}/${post.id}`, post, this.getAdminHeaders());
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, this.getAdminHeaders());
  }
}
