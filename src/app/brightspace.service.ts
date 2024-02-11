import { Injectable } from '@angular/core';
import * as PARAMS from './cred.json';
import { Storage } from '@ionic/storage';
import { Subject } from 'rxjs/Subject';
import { ApplicationContext, UserContext, Util } from './Module/valence/lib/valence';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { NavController } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { ToastService } from './toast.service.js';
import { HTTPResponse, HTTP } from '@ionic-native/http/ngx';
import { Keyboard } from '@ionic-native/keyboard/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

@Injectable({
  providedIn: 'root'
})
export class BrightspaceService implements CanActivate {


  private isDebugMode = false;
  private appID = PARAMS.Brightspace.appID;
  private appKey = PARAMS.Brightspace.appKey;
  private userID = '';
  private userKey = '';
  private sessionSkew = '';
  public redirectedURL = '';
  private userIDSubject: Subject<string> = new Subject<string>();
  private userKeySubject: Subject<string> = new Subject<string>();
  private sessionSkewSubject: Subject<string> = new Subject<string>();
  public userFirstName = '';
  public userFirstNameSubject: Subject<string> = new Subject<string>();
  public sideMenuItems: Array<{ Name: string; courseID: string, icon: string }> = [];
  public sideMenuSubject: Subject<string> = new Subject<string>();


  private CALLBACK_PARAM = PARAMS.Brightspace.Callback;
  public authenticated = false;
  private appContext: ApplicationContext;
  public userContext: UserContext;

  /**
   * Setting up the service.
   * 1. Initialize an Application Context.
   * 2. Requests previous session info from storage any try to create a UserContext if possible.
   * 3. Setup subscriptions to sync ID, Key, Skew to Storage from instance. Use setID/Key/Skew Helper
   *    Functions please.
   */
  constructor(private storage: Storage,
              private iab: InAppBrowser,
              private http: HttpClient,
              private nhttp: HTTP,
              private navCtrl: NavController,
              private toastService: ToastService,
              private splashScreen: SplashScreen,
              private keyboard: Keyboard,
              private statusBar: StatusBar) {
    this.appContext = new ApplicationContext(this.appID, this.appKey);


    storage.get('userID').then(userID => {
      this.userID = userID;
      this.createUserContext();
    });
    storage.get('userKey').then(userKey => {
      this.userKey = userKey;
      this.createUserContext();
    });
    storage.get('sessionSkew').then(sessionSkew => {
      this.sessionSkew = sessionSkew;
      this.createUserContext();
    });

    this.userIDSubject.asObservable().subscribe(() => {
      this.storage.set('userID', this.userID);
    });

    this.userKeySubject.asObservable().subscribe(() => {
      this.storage.set('userKey', this.userKey);
    });

    this.sessionSkewSubject.asObservable().subscribe(() => {
      this.storage.set('sessionSkew', this.sessionSkew);
    });
  }

  /**
   * could only be called when UserContext is created.
   * update the side menu by requesting myenrollments to the logged in LMS instance, store the parsed response in sideMenuItems then call sideMenuSubject.next to notify appComponent.
   */
  async updateSideMenu() {
    let jsonResponse = '';
    const url = this.userContext.createAuthenticatedUrl('/d2l/api/lp/1.10/enrollments/myenrollments/', 'get');
    await this.nhttp.get('https://' + url, {}, { 'Content-Type': 'application/json' }).then(data => {
      jsonResponse = data.data;
      // console.log(data.data);
    }, (err: HTTPResponse) => {
      if (err.status === 404) {
        this.toastService.showWarningToast('Your enrollments cannot be found on the server.\nContact Us if you think this is wrong.');
      } else if (err.status === 403) {
        this.toastService.showWarningToast('You have no permission to see your enrollments.\nContact Us if you think this is wrong.');
        this.validateSession();
      } else {
        this.toastService.showWarningToast('Cannot reach MyLS server. Please check your connection or MyLS status.');
      }
    });
    if (jsonResponse === '') {
      return;
    }
    this.sideMenuItems = [];
    const courses = JSON.parse(jsonResponse).Items;
    let thisIcon = '';

    for (const course of courses) {
      if (course.OrgUnit.Type.Id !== 3 || (course.Access.ClasslistRoleName !== 'TA' && course.Access.ClasslistRoleName !== 'Instructor')) {
        continue;
      }
      if (course.OrgUnit.Name.includes('CP')) {
        thisIcon = 'laptop';
      } else if (course.OrgUnit.Name.includes('EC')) {
        thisIcon = 'cash';
      } else if (course.OrgUnit.Name.includes('BU')) {
        thisIcon = 'briefcase';
      } else if (course.OrgUnit.Name.includes('BBA')) {
        thisIcon = 'briefcase';
      } else if (course.OrgUnit.Name.includes('MA')) {
        thisIcon = 'calculator';
      } else if (course.OrgUnit.Name.includes('Mathematics')) {
        thisIcon = 'calculator';
      } else if (course.OrgUnit.Name.includes('PC')) {
        thisIcon = 'laptop';
      } else if (course.OrgUnit.Name.includes('Clicker')) {
        thisIcon = 'keypad';
      } else {
        thisIcon = 'apps';
      }

      this.sideMenuItems.push({
        Name: course.OrgUnit.Name,
        courseID: course.OrgUnit.Id,
        icon: thisIcon
      });
    }
    this.sideMenuSubject.next('new Menu Items.');
  }


  /*
   * Auth Guard Implementation
   */
  canActivate(route: ActivatedRouteSnapshot): boolean {
    return this.authenticated;
  }

  /**
   * Get Current userID
   */
  getUserID() {
    return this.userID;
  }

  /**
   * Get Current userKey
   */
  getUserKey() {
    return this.userKey;
  }

  /**
   * Get Current sessionSkew
   */
  getSkew() {
    return this.sessionSkew;
  }

  /**
   * Create a Authentication url, then open up a browser page and listen for a valid session key in the url.
   * The function will return, create a new userContext and lead user to the main page when user log in successfully,
   * will return and remain on current page if user decides to go back.
   *
   * Should only be called on welcome-slide.
   */
  login(callBackURL?: string) {
    if (callBackURL != null) {
      const params = (callBackURL.split('?')[1]).split('&');
      this.setUserID(params[0].split('=')[1]);
      this.setUserKey(params[1].split('=')[1]);
      this.setSessionSkew(Util.calculateSkew(PARAMS.Session.CallBackURLWithParams));
      this.createUserContext(true);
    } else {
      const browser = this.iab.create('https://' + this.generateAuthURL(), '_blank', {
        zoom: 'no',
        clearsessioncache: 'yes',
        toolbartranslucent: 'yes',
        closebuttoncaption: 'Cancel',
        toolbarcolor: '#330572',
        navigationbuttoncolor: '#ffffff'
      });
      browser.on('loadstart').subscribe(
        data => {
          const url = data.url;
          if (url.indexOf('&x_c=') !== -1) {
            const params = (url.split('?')[1]).split('&');
            this.setUserID(params[0].split('=')[1]);
            this.setUserKey(params[1].split('=')[1]);
            this.setSessionSkew(Util.calculateSkew(url));
            this.redirectedURL = url;
            browser.close();
            this.createUserContext(true);
          }
        });
    }
  }

  /**
   * returns a url for user to authenticate on.
   */
  generateAuthURL(): string {
    return this.appContext.createUrlForAuthentication(PARAMS.Brightspace.Host, 443, this.CALLBACK_PARAM);
  }

  /**
   * @return Skew calculated from the last returned URL.
   */
  calcSkew(): string {
    return Util.calculateSkew(this.redirectedURL);
  }

  /**
   * sets the current userID both in the instance and Storage.
   * @param userID userID you wish to set
   */
  setUserID(userID: string) {
    this.userID = userID;
    console.log('setting userid to:' + this.userID);
    this.userIDSubject.next('New UserID');
  }

  /**
   * called by Get Started button on welcomeSlidePage of DEMO app to not have to go through login page.
   */
  setTestIdKey() {
    this.setUserID(PARAMS.Session.userID);
    this.setUserKey(PARAMS.Session.userKey);
    this.redirectedURL = PARAMS.Session.CallBackURLWithParams;
    this.setSessionSkew(this.calcSkew());
  }

  /**
   * sets the current UserKey both in the instance and Storage.
   * @param UserKey UserKey you wish to set
   */
  setUserKey(UserKey: string) {
    this.userKey = UserKey;
    console.log('setting userKey to:' + this.userKey);
    this.userKeySubject.next('New UserKey');
  }

  /**
   * sets the current sessionSkew both in the instance and Storage.
   * @param sessionSkew sessionSkew you wish to set
   */
  setSessionSkew(sessionSkew: string) {
    this.sessionSkew = sessionSkew;
    console.log('setting sessionSkew to:' + this.sessionSkew);
    this.sessionSkewSubject.next('New skew');
  }


  /**
   * This function determines whether creating a new userContext could be done.
   * The function will return true when:
   * userContext is not created & userID, userKey & sessionSkew are set.
   * @return boolean
   */
  public isUserContextCreatable(): boolean {
    return this.userID !== '' && this.userKey !== '' && this.sessionSkew !== ''
      && this.userID != null && this.userKey != null && this.sessionSkew != null;
  }

  /**
   * Determines whether the current userContext created is valid on the server side,
   * and kick user out of the app if session is no longer valid.
   * TODO:Finish it.
   * @param userLogin should pass true when it is a user initiated userContext creation, so There will be a pop up appear.
   */
  public async validateSession(userLogin = false) {
    if (this.isDebugMode) {
      this.authenticated = true;
      this.navCtrl.navigateRoot('/home');
      this.updateNameOnPages('debuggy');
      this.updateSideMenu();
      this.statusBar.show();
      if (userLogin) {
        this.toastService.showNormalToast('You are logged in.');
      }
      this.keyboard.show();
      this.keyboard.hide();
      this.splashScreen.hide();

    } else {
      const url = this.userContext.createAuthenticatedUrl('/d2l/api/lp/1.0/users/whoami', 'get');
      console.log('Testing if current userContext is Valid: Getting response from:' + url);
      await this.http.get('https://' + url).subscribe((response) => {
        console.log('Session Valid');
        this.authenticated = true;
        this.navCtrl.navigateRoot('/home');
        this.updateNameOnPages(JSON.stringify(response));
        this.updateSideMenu();
        this.statusBar.show();
        if (userLogin) {
          this.toastService.showNormalToast('You are logged in.');
        }
        this.keyboard.show();
        this.keyboard.hide();
        this.splashScreen.hide();
      },
        (error: HttpErrorResponse) => {
          if (error.status === 403) {
            this.authenticated = false;
            this.toastService.showWarningToast('Session info Expired. Please Sign in again.');
            this.logout(0);
          } else {
            this.toastService.showWarningToast('Cannot reach MyLS server. Please check your connection or MyLS status.');
            this.authenticated = true;
            this.navCtrl.navigateRoot('/home');
            this.statusBar.show();
          }
        });
    }
  }


  /**
   * Create a new userContext using the userID, Key, Skew set in the instance. Then call validateSession
   * to check if current session info is still recognized by the server.
   * @param userLogin should pass true when it is a user initiated userContext creation, so There will be a pop up appear.
   */
  public createUserContext(userLogin = false) {
    console.log('Trying to create User Context. isUserContextCreatable() = ' + this.isUserContextCreatable());
    if (this.isUserContextCreatable()) {
      console.log('Creating user Context with ID:' + this.userID + ' Key:' + this.userKey + ' Skew:' + this.sessionSkew);
      this.userContext = this.appContext.createUserContextWithValues(
        PARAMS.Brightspace.Host, 443, this.userID, this.userKey, this.sessionSkew);
      this.validateSession(userLogin);
    }
  }

  /**
   * Clear session info and kick user back to welcome page.
   * @param cause 1:user initiated logout, other: other reasons
   */
  public logout(cause: number) {
    this.userContext = null;
    this.setSessionSkew(null);
    this.setUserKey(null);
    this.setUserID(null);
    this.authenticated = false;
    if (cause === 1) {
      this.toastService.showNormalToast('You are logged out.');
    }
    this.navCtrl.navigateRoot('welcome-slide');

  }

  /**
   * Should only be called by validateSession. Using the response to update the user's name on main page and side menu.
   * @param jsonResponse response of whoami from LMS instance.
   */
  public updateNameOnPages(jsonResponse: string) {
    if (this.isDebugMode) {
      this.userFirstName = 'Debugger';
    } else {
      this.userFirstName = JSON.parse(jsonResponse).FirstName;
    }
    this.userFirstNameSubject.next('new user Name');
  }
}
