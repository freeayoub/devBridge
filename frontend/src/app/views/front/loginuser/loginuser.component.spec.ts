import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginuserComponent } from './loginuser.component';

describe('LoginuserComponent', () => {
  let component: LoginuserComponent;
  let fixture: ComponentFixture<LoginuserComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LoginuserComponent]
    });
    fixture = TestBed.createComponent(LoginuserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
