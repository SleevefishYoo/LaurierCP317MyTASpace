import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { BrightspaceService } from './brightspace.service';
import { LoginGuardService } from './login-guard.service';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'welcome-slide',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadChildren: './home/home.module#HomePageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'list/:courseID/:courseName',
    loadChildren: './list/list.module#ListPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'settings',
    loadChildren: './settings/settings.module#SettingsPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'welcome-slide',
    loadChildren: './welcome-slide/welcome-slide.module#WelcomeSlidePageModule',
    canActivate: [LoginGuardService]
  },
  {
    path: 'grading/:courseID/:gradeItemID/:maxGrade/:allowExceed/:GradeItemName/:courseName',
    loadChildren: './grading/grading.module#GradingPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'about',
    loadChildren: './about/about.module#AboutPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'contactus',
    loadChildren: './contactus/contactus.module#ContactusPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'test',
    loadChildren: './test/test.module#TestPageModule',
    canActivate: [BrightspaceService]
  },
  { path: 'history', loadChildren: './history/history.module#HistoryPageModule' },

  {
    path: 'history/:courseID/:courseName',
    loadChildren: './history/history.module#HistoryPageModule',
    canActivate: [BrightspaceService]
  },
  {
    path: 'history/:courseID/:courseName/:itemID/:itemName',
    loadChildren: './history/history.module#HistoryPageModule',
    canActivate: [BrightspaceService]
  },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
