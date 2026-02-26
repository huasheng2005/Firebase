import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-edit.html',
  styleUrl: './project-edit.scss'
})
export class ProjectEditComponent implements OnInit {
  project: Project = { name: '', description: '' };
  isEditMode = false;

  constructor(
    private projectService: ProjectService,
    private route: ActivatedRoute, // 获取 URL 参数
    private router: Router // 用于成功后跳转
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.projectService.getProjectById(id).subscribe(data => {
        // 这里的 data 必须包含 id，否则后续 update 会失效
        this.project = data;
        // 如果后端返回的数据里没带 id，手动补一下：
        if (!this.project.id) this.project.id = id;
      });
    }
  }

  // Senior 要求：Submit & Redirect
  onSubmit() {
    console.log('准备提交的数据：', this.project);

    if (this.isEditMode && this.project.id) {
      // ✨ 模式 1：修改现有的 Project
      this.projectService.updateProject(this.project.id, this.project).subscribe({
        next: (res) => {
          console.log('修改成功：', res);
          this.router.navigate(['/projects']); // 修改成功后跳回列表页
        },
        error: (err) => console.error('修改失败：', err)
      });
    } else {
      // ✨ 模式 2：创建新的 Project
      this.projectService.createProject(this.project).subscribe({
        next: (res) => {
          console.log('创建成功：', res);
          this.router.navigate(['/projects']); // 创建成功后跳回列表页
        },
        error: (err) => console.error('创建失败：', err)
      });
    }
  }


  // Senior 要求：Delete Button (仅在 Edit 模式下)
  onDelete(): void {
    if (this.project.id && confirm('Confirm delete?')) {
      this.projectService.deleteProject(this.project.id).subscribe(() => {
        this.router.navigate(['/projects']);
      });
    }
  }
}