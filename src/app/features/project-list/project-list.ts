import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // 用于跳转
import { ProjectService } from '../../services/project'; //
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss'
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];

  constructor(private projectService: ProjectService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    // 每次进入页面时，打印一条日志确认组件已启动
    console.log('Project List 初始化中...');
    this.loadProjects();
  }

  // project-list.ts
  loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (res) => {
        this.projects = [...res]; // 使用解构赋值，强制创建一个新数组来触发更新
        this.cdr.detectChanges(); // 强制手动刷新界面渲染
        console.log('界面已强制刷新');
      }
    });
  }
}