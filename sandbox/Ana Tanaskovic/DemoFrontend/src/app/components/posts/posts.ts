import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Post } from '../../post';
import { Auth } from '../../services/auth';
import { Posts } from '../../services/posts';
import { Login } from '../login/login';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.html',
  styleUrl: './posts.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FormsModule, Login, NgIf, NgFor],
})
export class PostsComponent implements OnInit {
  posts: Post[] = [];
  editPostId: number | null = null;
  editTitle: string = '';
  editContent: string = '';

  newTitle: string = '';
  newContent: string = '';

  loginFormVisible: boolean = false;
  isLoggedIn: boolean = false;
  isAdmin: boolean = false;

  constructor(
    private postService: Posts,
    private authService: Auth,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadPosts();

    this.authService.user$.subscribe((user) => {
      if (user) {
        this.isLoggedIn = true;
        this.isAdmin = user.role?.toLowerCase() === 'admin';
      } else {
        this.isLoggedIn = false;
        this.isAdmin = false;
      }
      this.cdr.detectChanges();
    });
  }

  loadPosts() {
    this.postService.getPosts().subscribe({
      next: (posts) => {
        this.posts = [...posts];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Greška pri učitavanju:', err),
    });
  }

  toggleLoginForm() {
    this.loginFormVisible = !this.loginFormVisible;
  }

  logout() {
    this.authService.logout();
    this.loginFormVisible = false;
  }

  startEdit(post: Post) {
    this.editPostId = post.id ?? null;
    this.editTitle = post.title;
    this.editContent = post.content;
  }

  cancelEdit() {
    this.editPostId = null;
    this.editTitle = '';
    this.editContent = '';
  }

  saveEdit(post: Post) {
    post.title = this.editTitle;
    post.content = this.editContent;

    this.postService.updatePost(post).subscribe(() => {
      this.loadPosts();
      this.cancelEdit();
    });
  }

  addPost() {
    if (!this.newTitle || !this.newContent) return;

    const newPost: Post = {
      title: this.newTitle,
      content: this.newContent,
    };

    this.postService.addPost(newPost).subscribe(() => {
      this.loadPosts();
      this.newTitle = '';
      this.newContent = '';
    });
  }

  deletePost(id: number | undefined) {
    if (id === undefined) return;
    this.postService.deletePost(id).subscribe(() => this.loadPosts());
  }
}
