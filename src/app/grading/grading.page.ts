import { Component, OnInit } from '@angular/core';
import { OrganizationService } from '../organization.service';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { HTTP, HTTPResponse } from '@ionic-native/http/ngx';
import { BrightspaceService } from '../brightspace.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-grading',
  templateUrl: './grading.page.html',
  styleUrls: ['./grading.page.scss'],
})
export class GradingPage implements OnInit {
  searching = true;
  gradingUsers: Array<{ Name; WLUID: string; Identifier: string; WLUEmail: string; gradeItemId: string; gradeOutOf: string; currGrade: string }> = [];
  searchTerm: any;
  courseID = null;
  courseName = '';
  gradeItemID = null;
  gradeItemName = '';
  maxGrade = null;
  allowExceed = null;

  constructor(
    private orgService: OrganizationService,
    private alertController: AlertController,
    private activatedRoute: ActivatedRoute,
    private toastService: ToastService,
    private http: HTTP,
    private bService: BrightspaceService,
  ) {
    this.gradingUsers = [];
    this.courseID = this.activatedRoute.snapshot.paramMap.get('courseID');
    this.courseName = this.activatedRoute.snapshot.paramMap.get('courseName');
    this.courseName = this.courseName.substring(0, 6).replace('-', '');
    this.gradeItemID = this.activatedRoute.snapshot.paramMap.get('gradeItemID');
    this.gradeItemName = this.activatedRoute.snapshot.paramMap.get('GradeItemName');
    console.log('Grade Item Name: ', this.gradeItemName);
    this.maxGrade = Number(this.activatedRoute.snapshot.paramMap.get('maxGrade'));
    this.allowExceed = this.activatedRoute.snapshot.paramMap.get('allowExceed') === 'true';
    console.log('course: ' + this.courseID + '; gradeItemID: ' + this.gradeItemID + '; allowExceed: ' + this.allowExceed);
    this.orgService.updateGradingPage(this.courseID, this.gradeItemID);
    this.http.setDataSerializer('json');
  }

  onSearchInput() {
    this.searching = true;
    this.orgService.filterItems(this.searchTerm);
  }

  ngOnInit() {
    this.orgService.gradingUsersFilteredSubject.asObservable().subscribe(() => {
      this.gradingUsers = this.orgService.gradingUsersFiltered;
      this.searching = false;
    });
  }

  async doRefresh(event) {
    this.searchTerm = '';
    await this.orgService.updateGradingPage(this.courseID, this.gradeItemID);
    event.target.complete();
  }

  async gradeChangePrompt(Identifier: string) {
    const user = this.gradingUsers.find(x => x.Identifier === Identifier);
    const alert = await this.alertController.create({
      header: user.Name,
      message: user.WLUID + '<br/>Current Mark: <strong>' + user.currGrade + '</strong>',
      cssClass: 'myNormalPrompt',
      inputs: [
        {
          name: 'newGrade',
          type: 'number',
          placeholder: 'Out of ' + this.maxGrade + ((this.allowExceed) ? ', allow exceeding.' : ''),
          min: 0,
          max: this.maxGrade
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
          }
        }, {
          text: 'Submit',
          handler: (data) => {
            if (this.orgService.validateGradeInput(data.newGrade, this.maxGrade, this.allowExceed)) {
              console.log('Grade passed validation. Attempting to update the mark server-side.');
              this.updateGrade(Identifier, data.newGrade);
            } else {
              this.gradeFailedChangePrompt(Identifier);
            }
          }
        }
      ]
    });
    await alert.present().then(() => {
      const firstInput: any = document.querySelector('ion-alert input');
      firstInput.focus();
      return;
    });
  }

  async gradeFailedChangePrompt(Identifier: string) {
    const user = this.gradingUsers.find(x => x.Identifier === Identifier);
    const alert = await this.alertController.create({
      header: user.Name,
      subHeader: 'The value entered is not valid. Please re-enter. \n',
      message: user.WLUID + '<br/> Current Mark: <strong>' + user.currGrade + '</strong>',
      cssClass: 'myAlertPrompt',
      inputs: [
        {
          name: 'newGrade',
          type: 'number',
          placeholder: 'Out of ' + this.maxGrade + ((this.allowExceed) ? ', allow exceeding.' : ''),
          min: 0,
          max: this.maxGrade
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
          }
        }, {
          text: 'Submit',
          handler: (data) => {
            console.log('Confirm Ok. New Grade: ' + data.newGrade);
            if (this.orgService.validateGradeInput(data.newGrade, this.maxGrade, this.allowExceed)) {
              console.log('Grade passed validation. Attempting to update the mark server-side.');
              this.updateGrade(Identifier, data.newGrade);
            } else {
              this.gradeFailedChangePrompt(Identifier);
            }
          }
        }
      ]
    });
    await alert.present().then(() => {
      const firstInput: any = document.querySelector('ion-alert input');
      firstInput.focus();
      return;
    });
  }

  async mergeConflictPrompt(Identifier: string, gradeOnServer: number, newGrade: string) {
    const user = this.gradingUsers.find(x => x.Identifier === Identifier);
    const alert = await this.alertController.create({
      header: 'Merge Conflict',
      subHeader: user.Name + '\'s grade was updated on the server after the app have pulled the grades shown on the screen. \nDo you wish to override?',
      message: 'Mark on the screen: <strong>' + user.currGrade + '</strong>,\n Mark on the server: <strong>' + gradeOnServer + '</strong>,\n Updating to: <strong>' + newGrade,
      cssClass: 'myAlertPrompt',
      buttons: [
        {
          text: 'No',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
          }
        }, {
          text: 'Yes',
          handler: () => {
            const url = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.35/' + this.courseID + '/grades/' + this.gradeItemID + '/values/' + Identifier, 'put');
            this.http.put('https://' + url, {
              Comments: {
                Content: '',
                Type: 'Text'
              },
              PrivateComments: {
                Content: '',
                Type: 'Text'
              },
              GradeObjectType: 1,
              PointsNumerator: Number(newGrade)
            }, {}).then(() => {
              this.toastService.showNormalToast('Grade Updated.');
              this.orgService.updateGradingPage(this.courseID, this.gradeItemID);
              this.searchTerm = '';
            }, (err: HTTPResponse) => {
              if (err.status === 403) {
                this.toastService.showWarningToast('Weird. You are not allowed to update the marks of this grade item.');
                this.bService.validateSession();
              } else if (err.status === 404) {
                this.toastService.showWarningToast('User/course/gradeItem Not found. Please restart the app and try again. If you still get this prompt, contact us.');
              } else {
                this.toastService.showWarningToast('Cannot reach MyLS server. Please check your connection or MyLS status.');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  gradeFirst() {
    if (this.searchTerm === '') {
      return;
    }
    this.gradeChangePrompt(this.gradingUsers[0].Identifier);
    this.searchTerm = '';
  }

  async updateGrade(Identifier: string, newGrade: string) {
    const user = this.gradingUsers.find(x => x.Identifier === Identifier);
    const gradeOnScreen = Number(user.currGrade);
    const gradeOnServerURL = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.35/' + this.courseID + '/grades/' + this.gradeItemID + '/values/' + Identifier, 'get');
    let gradeOnServer = 0;
    let jsonResponse;
    await this.http.get('https://' + gradeOnServerURL, {}, { 'Content-Type': 'application/json' }).then(data => {
      jsonResponse = JSON.parse(data.data);
      gradeOnServer = jsonResponse.PointsNumerator;
    }, (err: HTTPResponse) => {
      if (err.status === 403) {
        this.bService.validateSession();
      }
    });
    if (gradeOnScreen !== gradeOnServer) {
      this.mergeConflictPrompt(Identifier, gradeOnServer, newGrade);
      return;
    }
    const url = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.12/' + this.courseID + '/grades/' + this.gradeItemID + '/values/' + Identifier, 'put');
    this.http.put('https://' + url, {
      GradeObjectType: '1',
      PointsNumerator: newGrade
    }, { 'Content-Type': 'application/json' }).then(() => {
      this.toastService.showNormalToast('Grade updated for ' + user.Name + '.');
      this.orgService.updateGradingPage(this.courseID, this.gradeItemID);
    }, (err: HTTPResponse) => {
      if (err.status === 403) {
        this.bService.validateSession();
      } else if (err.status === 404) {
        this.toastService.showWarningToast('User/course/gradeItem Not found. Please restart the app and try again. If you still get this prompt, contact us.');
      } else if (err.status === 400) {
        this.toastService.showWarningToast('Grade type mismatch. This app only supports numeric grade type at the moment. ');
        prompt('Hey. Sorry to bother you again.<br/>We do not currently support grade types other than numeric. <br/>If you would like us to support grade types other than numeric, please send us a email in the Contact Us page in Settings and describe how often do you encounter/set up grade types that are not numeric.');
        // prompt(JSON.stringify(err.headers));
        // prompt(JSON.stringify(err.data));
        // prompt(err.url);
        // prompt(err.error);
      } else {
        this.toastService.showWarningToast('Cannot reach MyLS server. Please check your connection or MyLS status.');
      }
    });

  }
}
