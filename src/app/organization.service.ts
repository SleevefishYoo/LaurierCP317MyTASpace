import {Injectable} from '@angular/core';
import {Subject} from 'rxjs/Subject';
import {isNumeric} from 'rxjs/util/isNumeric';
import {ToastController, ModalController} from '@ionic/angular';
import {BrightspaceService} from './brightspace.service';
import {ToastService} from './toast.service';
import {HTTP, HTTPResponse} from '@ionic-native/http/ngx';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  toast: any;
  gradeItemsMenuItems: Array<{ Name: string; gradeItemID: string; maxGrade: number; allowExceed: boolean }> = [];
  gradeItemsMenuSubject: Subject<string> = new Subject<string>();

  assignmentItems: Array<{ Name: string; gradeItemID: string; maxGrade: number; allowExceed: boolean }> = [];
  labItems: Array<{ Name: string; gradeItemID: string; maxGrade: number; allowExceed: boolean }> = [];
  otherItems: Array<{ Name: string; gradeItemID: string; maxGrade: number; allowExceed: boolean }> = [];

  gradingUsers: Array<{ Name; WLUID: string; Identifier: string; WLUEmail: string; gradeItemId: string; gradeOutOf: string; currGrade: string }> = [];
  gradingUsersFiltered: Array<{ Name; WLUID: string; Identifier: string; WLUEmail: string; gradeItemId: string; gradeOutOf: string; currGrade: string }> = [];
  gradingUsersFilteredSubject: Subject<string> = new Subject<string>();

  public gradeItems = [];

  constructor(private bService: BrightspaceService,
              private toastService: ToastService,
              private http: HTTP,
              private modalController: ModalController) {
    this.http.setDataSerializer('json');
  }

  /**
   * Called when user enters Grading page from List page or refreshes the Grading page.
   * Should only be called after the UserContext is created.
   * We need the info of current gradeItem because user's grades does not contain gradeItemIdand when the mark is dropped by setting the gradeItem to disregard the lowest score,
   * that score is counted as out of 0. So we need to grab the pointsNumerator from the GradeItem.
   * Users are updated by:
   * 1. Requesting the info of the current GradeItem, stores the response to itemJsonResponse; Requesting the usergrades, store them in jsonResponse(Nameing could be done better)
   * 2. Parse them they way described above, the store them in gradingUsers.
   * 3. gradingUsersFilteredSubject = gradingUsers because the list that's actually displayed on gradingPage is gradingUsersFilteredSubject.
   * 4. call gradingUsersFilteredSubject.next to notify gradingPage to update their copy.
   *
   * @param courseID courseID
   * @param gradeItemID grade item ID
   */
  async updateGradingPage(courseID: string, gradeItemID: string) {
    this.gradingUsers = [];
    let jsonResponse = '';
    let itemJsonResponse = '';

    const itemUrl = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.35/' + courseID + '/grades/' + gradeItemID, 'get');
    let url = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.35/' + courseID + '/grades/' + gradeItemID + '/values/?sort=lastname&pageSize=200', 'get');
    while (url != null) {
      await this.http.get('https://' + url, {}, {'Content-Type': 'application/json'}).then(data => {
        jsonResponse = data.data;
      }, (err: HTTPResponse) => {
        if (err.status === 404) {
          this.toastService.showWarningToast('Selected Grade Item cannot be found on the server.\nContact Us if you think this is wrong.');
        } else if (err.status === 403) {
          this.toastService.showWarningToast('You have no permission to see grade values of this item.\nContact Us if you think this is wrong.');
          this.bService.validateSession();
        } else if (err.status === -6) {
          this.toastService.showWarningToast('Cannot reach MyLS server. Please check your internet connection or MyLS status.');
        } else {
          this.toastService.showWarningToast(err.status + ': ' + err.data);
        }
      });

      await this.http.get('https://' + itemUrl, {}, {'Content-Type': 'application/json'}).then(data => {
        itemJsonResponse = data.data;
      }, (err: HTTPResponse) => {
        if (err.status === 403) {
          this.bService.validateSession();
        } else if (err.status === -6) {
        } else {
          this.toastService.showWarningToast(err.status + ': ' + err.data);
        }
      });

      if (jsonResponse === '' || itemJsonResponse === '') {
        return;
      }
      const userGrades: GradeItemUserValues = JSON.parse(jsonResponse);
      const gradeItem = JSON.parse(itemJsonResponse);
      for (const userGrade of userGrades.Objects) {
        let currentGrade = 0;
        if (JSON.stringify(userGrade.GradeValue) !== 'null') {
          currentGrade = userGrade.GradeValue.PointsNumerator;
        }
        this.gradingUsers.push({
          Name: userGrade.User.DisplayName,
          WLUID: userGrade.User.OrgDefinedId,
          Identifier: userGrade.User.Identifier,
          WLUEmail: userGrade.User.EmailAddress,
          gradeItemId: gradeItemID,
          gradeOutOf: gradeItem.MaxPoints,
          currGrade: String(currentGrade)
        });
      }
      url = userGrades.Next != null ? this.bService.userContext.createAuthenticatedUrl(userGrades.Next, 'get') : null;
    }
    this.gradingUsersFiltered = this.gradingUsers;
    console.log('Grading page updated: ' + this.gradingUsers.length);
    this.gradingUsersFilteredSubject.next('List updated');
    return;
  }

  /**
   * updates the listPage with catagorization.
   * Called when user enters the List page.
   * list is uodated by:
   * 1. requesting info from server
   * 2. catagorize the returened items and store them in gradeItemsMenuItems
   * 3. call gradeItemsMenuSubject.next to notify listPage to update.
   * the final gradeItemsMenuItems contains dividers to devide different types of gradeItems (Labs/Asgns/Others).
   * Dividers have the property gradeItemID set to '000000' and Name of theuir respective catagories.
   *
   * @param courseID course ID
   */
  async updateGradeItems(courseID: number) {
    this.gradeItems = [];
    let jsonResponse = '';
    const url = this.bService.userContext.createAuthenticatedUrl('/d2l/api/le/1.35/' + courseID + '/grades/', 'get');
    await this.http.get('https://' + url, {}, {'Content-Type': 'application/json'}).then(data => {
      jsonResponse = data.data;
    }, (err: HTTPResponse) => {
      if (err.status === 404) {
        this.toastService.showWarningToast('Cannot find this course on the server.\nContact Us if you think this is wrong.');
      } else if (err.status === 403) {
        this.toastService.showWarningToast('You have no permission to list grade items of this course.\n' +
          'Contact Us if you think this is wrong.');
        this.bService.validateSession();
      } else if (err.status === -6) {
        this.toastService.showWarningToast('Cannot reach MyLS server. Please check your internet connection or MyLS status.');
      } else {
        this.toastService.showWarningToast(err.status + ': ' + err.data);
      }
    });

    this.gradeItems = JSON.parse(jsonResponse);

    this.gradeItemsMenuItems = [];
    this.assignmentItems = [];
    this.labItems = [];
    this.otherItems = [];

    let labCounter = 0;
    let assignmentCounter = 0;
    let otherCounter = 0;

    // push Labs, assignments and other into their correposnding arrays.
    for (const item of this.gradeItems) {
      if (item.Name.charAt(0) === 'L' || item.Name.toLowerCase().includes('lab')) {
        if (labCounter === 0) {
          this.labItems.push({
            Name: 'Lab',
            gradeItemID: '000000',
            allowExceed: false,
            maxGrade: 0
          });
          this.labItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        } else {
          this.labItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        }
        labCounter += 1;
      } else if (item.Name.charAt(0) === 'A' || item.Name.toLowerCase().includes('assignment')) {
        if (assignmentCounter === 0) {
          this.assignmentItems.push({
            Name: 'Assignment',
            gradeItemID: '000000',
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
          this.assignmentItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        } else {
          this.assignmentItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        }
        assignmentCounter += 1;
      } else {
        if (otherCounter === 0) {
          this.otherItems.push({
            Name: 'Other',
            gradeItemID: '000000',
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
          this.otherItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        } else {
          this.otherItems.push({
            Name: item.Name,
            gradeItemID: item.Id,
            allowExceed: Boolean(item.CanExceedMaxPoints),
            maxGrade: item.MaxPoints
          });
        }
        otherCounter += 1;
      }
    }

    // sort each array here
    this.labItems.sort((a, b) => {
      if (a.Name.length > b.Name.length || a.Name > b.Name) {
        return 1;
      }
      if (a.Name < b.Name) {
        return -1;
      }
      return 0;
    });

    this.assignmentItems.sort((a, b) => {
      if (a.Name.length > b.Name.length || a.Name > b.Name) {
        return 1;
      }
      if (a.Name < b.Name) {
        return -1;
      }
      return 0;
    });

    this.otherItems.sort((a, b) => {
      if (a.Name.length > b.Name.length || a.Name > b.Name) {
        return 1;
      }
      if (a.Name < b.Name) {
        return -1;
      }
      return 0;
    });

    // merge all the arrays into gradeItemsMenueItems in order
    Array.prototype.push.apply(this.gradeItemsMenuItems, this.labItems);
    Array.prototype.push.apply(this.gradeItemsMenuItems, this.assignmentItems);
    Array.prototype.push.apply(this.gradeItemsMenuItems, this.otherItems);

    this.gradeItemsMenuSubject.next('New Course has been selected!!');
  }


  filterItems(searchTerm: string) {
    console.log('filtering with term: ' + searchTerm);
    if (searchTerm === '') {
      this.gradingUsersFiltered = this.gradingUsers;

    } else {
      this.gradingUsersFiltered = this.gradingUsers.filter(item => {
        return item.Name.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || item.WLUEmail.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 || item.WLUID.toString().indexOf(searchTerm.toLowerCase()) > -1;
      });
    }
    this.gradingUsersFilteredSubject.next('New filtered items ready.');
  }

  validateGradeInput(newGrade: string, maxGrade: number, canExceed: boolean): boolean {
    if (newGrade === '' || !isNumeric(newGrade)) {
      return false;
    }
    if (!canExceed && Number(newGrade) > maxGrade) {
      return false;
    }
    return Number(newGrade) >= 0;
  }
}

interface GradeItemUserValues {
  Objects: [{
    User: {
      Identifier: string,
      DisplayName: string,
      EmailAddress: string,
      OrgDefinedId: string,
      ProfileBadgeUrl: string,
      ProfileIdentifier: string
    },
    GradeValue: {
      PointsNumerator: number,
      PointsDenominator: number,
      WeightedNumerator: number,
      WeightedDenominator: number,
      GradeObjectIdentifier: string,
      GradeObjectName: string,
      GradeObjectType: number,
      GradeObjectTypeName: string,
      DisplayedGrade: string,
      Comments: {
        Text: string,
        Html: string
      },
      PrivateComments: {
        Text: string,
        Html: string
      }
    }
  }];
  Next;
}

export interface HistoryItem {
  CourseName: string;
  GradeItems: [{
    itemID: number,
    itemName: string,
    Entries: [{
      studentName: string,
      studentID: number,
      studentEmail: string,
      time: string,
      oldScore: string,
      newScore: string
    }]
  }];
}
