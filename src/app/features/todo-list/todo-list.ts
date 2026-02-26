
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo } from '../../services/todo'; // 注意路径回到 services

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo-list.html', // 关联新的 HTML
})
export class TodoListComponent implements OnInit {
  protected readonly title = signal('Firebase Todo Framework');
  todos: any[] = [];
  inputTitle: string = '';

  
  editingId: string | null = null;
  editTitle: string = '';

  constructor(private todoService: Todo) { }

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.todoService.getTodos().subscribe(res => this.todos = res);
  }

  handleCreate() {
    if (this.inputTitle) {
      this.todoService.createTodo(this.inputTitle).subscribe(() => {
        this.inputTitle = '';
        this.refresh();
      });
    }
  }


  startEdit(item: any) {
    this.editingId = item.id;
    this.editTitle = item.title;
  }

  saveEdit(item: any) {
    if (this.editTitle.trim()) {
      const updatedData = { ...item, title: this.editTitle };
      this.todoService.updateTodo(item.id, updatedData).subscribe(() => {
        this.editingId = null; 
        this.refresh();
      });
    }
  }

 
  cancelEdit() {
    this.editingId = null;
  }

  handleDelete(id: string) {
    this.todoService.deleteTodo(id).subscribe(() => this.refresh());
  }

  toggleStatus(item: any) {
 
    item.completed = !item.completed;


    this.todoService.updateTodo(item.id, item).subscribe({
      next: () => console.log('Status updated!'),
      error: (err) => {
        console.error('更新失败，回滚状态', err);
        item.completed = !item.completed; 
      }
    });
  }
}

