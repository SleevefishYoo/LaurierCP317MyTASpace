import { Component, OnInit, ViewChild } from '@angular/core';
import { MenuController, Platform, IonSlides } from '@ionic/angular';
import { BrightspaceService } from '../brightspace.service';
import { Storage } from '@ionic/storage';

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
              private storage: Storage) {

  }

  sub;

  ionViewWillEnter() {
    this.menuController.enable(false);
    this.sub = this.platform.backButton.subscribeWithPriority(1, () => {});
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
  }

  login() {
    this.bService.login();
  }
  ngOnInit() {
    this.storage.get('not_first_time').then((isNotFirst) => {
      if (isNotFirst) { this.delay(500).then(() => {
        this.jumpToLogin();
        });
      }
    });
    this.storage.set('not_first_time', true);
  }

}
