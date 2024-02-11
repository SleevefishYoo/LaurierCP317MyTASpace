import {Component, OnInit, ViewChild} from '@angular/core';
import {MenuController, Platform, IonSlides} from '@ionic/angular';
import {BrightspaceService} from '../brightspace.service';
import {Storage} from '@ionic/storage';
import {StatusBar} from '@ionic-native/status-bar/ngx';

@Component({
  selector: 'app-welcome-slide',
  templateUrl: './welcome-slide.page.html',
  styleUrls: ['./welcome-slide.page.scss'],
})
export class WelcomeSlidePage implements OnInit {
  @ViewChild(IonSlides) slides: IonSlides;

  constructor(private menuController: MenuController,
              private platform: Platform,
              private bService: BrightspaceService,
              private storage: Storage,
              private statusBar: StatusBar) {
    this.statusBar.hide();
  }

  sub;
  loginClicked = false;
  URL = '';

  ionViewWillEnter() {
    this.statusBar.hide();
    this.menuController.enable(false);
    this.sub = this.platform.backButton.subscribeWithPriority(1, () => {
    });
    this.platform.backButton.unsubscribe();
  }

  jumpToLogin() {
    this.slides.slideTo(6, 1000);
  }

  async delay(ms: number) {
    await new Promise(resolve => setTimeout(() => resolve(), ms));
  }

  ionViewDidLeave() {
    this.menuController.enable(true);
    this.sub.unsubscribe();
    this.statusBar.show();
  }

  login() {
    this.loginClicked = true;
    this.bService.login(this.URL === '' ? null : this.URL);
  }

  ngOnInit() {
    this.storage.get('not_first_time').then((isNotFirst) => {
      if (isNotFirst) {
        this.delay(200).then(() => {
          this.jumpToLogin();
        });
      }
    });
    this.storage.set('not_first_time', true);
  }

}
