import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Storage} from '@ionic/storage';
import {HistoryItem} from '../organization.service';

@Component({
  selector: 'app-history',
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage implements OnInit {

  courseID = null;
  courseName = null;
  itemID = null;
  itemName = null;
  items;
  pageTitle = 'History';
  mode = 0; // 0: history of all items in a course, 1: history of specific item

  constructor(private activatedRoute: ActivatedRoute,
              private storage: Storage) {
  }

  ngOnInit() {
    this.courseID = this.activatedRoute.snapshot.paramMap.get('courseID');
    this.courseName = this.activatedRoute.snapshot.paramMap.get('courseName');
    this.itemID = this.activatedRoute.snapshot.paramMap.get('itemID');
    this.itemName = this.activatedRoute.snapshot.paramMap.get('itemName');
    if (this.itemID == null) {
      this.pageTitle = 'History for ' + this.courseName.split(' ')[0];
    } else {
      this.mode = 1;
      this.pageTitle = 'History for ' + this.courseName.substring(0, 6) + ' - ' + this.itemName;
    }

    this.storage.get(this.courseID).then((val) => {
      console.log('Your json is', val);
      const obj: HistoryItem = JSON.parse(val);
      this.items = this.mode === 0 ? obj.GradeItems : obj.GradeItems.filter(x => x.itemID === this.itemID)[0].Entries;
    });
  }
}
