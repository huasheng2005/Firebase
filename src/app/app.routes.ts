import { Routes } from '@angular/router';
import { ProjectListComponent } from './features/project-list/project-list';
import { ProjectEditComponent } from './features/project-edit/project-edit';
import { TodoListComponent } from './features/todo-list/todo-list'; // 新增导入

export const routes: Routes = [
  { path: 'projects', component: ProjectListComponent },
  { path: 'projects/new', component: ProjectEditComponent },
  { path: 'projects/edit/:id', component: ProjectEditComponent },
  { path: 'todos', component: TodoListComponent }, // Todo 页面路径
  { path: '', redirectTo: '/projects', pathMatch: 'full' }
];