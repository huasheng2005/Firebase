import { Component } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule], // 必须包含这两个
  templateUrl: './app.html',
})
export class App { } // 主类现在不需要 Todo 逻辑了