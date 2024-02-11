import {Component} from '@angular/core';
import {Camera, CameraOptions} from '@ionic-native/camera/ngx';
import {EmailComposer} from '@ionic-native/email-composer/ngx';
import {version} from '../../../package.json';

@Component({
  selector: 'app-grading',
  templateUrl: 'contactus.page.html'
})
export class ContactusPage {
  public ver: string = version;

  currentImage = null;

  constructor(private camera: Camera,
              private emailComposer: EmailComposer) {
  }

  captureImage() {
    const options: CameraOptions = {
      sourceType: this.camera.PictureSourceType.PHOTOLIBRARY,
      destinationType: this.camera.DestinationType.FILE_URI,
    };

    this.camera.getPicture(options).then((imageData) => {
      this.currentImage = imageData;
    });
  }

  removeImage() {
    this.currentImage = null;
  }


  sendEmail() {
    let email = {
      to: 'ziyaowangwayne@gmail.com',
      attachments: [this.currentImage],
      subject: 'MyTASpace Support: ',
      body: 'Platform: ' + this.platform() + '<br/>Version: ' + this.ver
        + '<br/>Please describe the issue you\'ve encountered with MyTASpace below:\n',
      isHtml: true
    };

    this.emailComposer.open(email);
  }


  platform() {
    if (cordova.platformId === 'android') {
      return 'Android';
    } else {
      return 'IOS';
    }
  }

}
