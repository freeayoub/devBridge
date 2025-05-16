import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { VoiceMessagePlayerComponent } from '../voice-message-player/voice-message-player.component';

@NgModule({
  declarations: [
    VoiceRecorderComponent,
    VoiceMessagePlayerComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    VoiceRecorderComponent,
    VoiceMessagePlayerComponent
  ]
})
export class VoiceMessageModule { }
