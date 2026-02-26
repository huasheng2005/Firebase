import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Todo {
  
  private baseUrl = 'http://localhost:5001/todolist-example-firebase/asia-southeast1/api';

  constructor(private http: HttpClient) { }

  getTodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/todos`);
  }

 
  createTodo(title: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/todos`, { title, completed: false });
  }

 
  updateTodo(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/todos/${id}`, data);
  }


  deleteTodo(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/todos/${id}`);
  }
}