import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {OrganizationService} from '../organization.service';
import {Storage} from '@ionic/storage';

@Component({
  selector: 'app-list',
  templateUrl: 'list.page.html',
  styleUrls: ['list.page.scss']
})
export class ListPage implements OnInit {
  gradeItemList: Array<{ Name: string; gradeItemID: string; maxGrade: number; allowExceed: boolean }> = [];
  courseID = 0;
  loading = true;
  courseName = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private orgService: OrganizationService,
    private storage: Storage,
  ) {
    this.storage.set('bug_prompted', true);
    this.courseID = Number(this.activatedRoute.snapshot.paramMap.get('courseID'));
    this.courseName = this.activatedRoute.snapshot.paramMap.get('courseName');
    this.orgService.gradeItemsMenuSubject.asObservable().subscribe(() => {
      this.gradeItemList = this.orgService.gradeItemsMenuItems;
      this.loading = false;
    });
    this.gradeItemList = this.orgService.gradeItemsMenuItems;
    this.orgService.updateGradeItems(this.courseID);
  }
  async doRefresh(event) {
    console.log('Begin async operation');
    await this.orgService.updateGradeItems(this.courseID);
    this.gradeItemList = this.orgService.gradeItemsMenuItems;
    event.target.complete();
  }

  ngOnInit() {
  }
  // add back when alpha.4 is out
  // navigate(item) {
  //   this.router.navigate(['/list', JSON.stringify(item)]);
  // }
}
