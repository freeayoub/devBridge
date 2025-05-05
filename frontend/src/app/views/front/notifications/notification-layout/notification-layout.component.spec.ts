import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationLayoutComponent } from './notification-layout.component';

describe('NotificationLayoutComponent', () => {
  let component: NotificationLayoutComponent;
  let fixture: ComponentFixture<NotificationLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotificationLayoutComponent]
    });
    fixture = TestBed.createComponent(NotificationLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
