import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MessageUserProfileComponent } from './message-user-profile.component';

describe('MessageUserProfileComponent', () => {
  let component: MessageUserProfileComponent;
  let fixture: ComponentFixture<MessageUserProfileComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MessageUserProfileComponent]
    });
    fixture = TestBed.createComponent(MessageUserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
