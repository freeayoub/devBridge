import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthAdminLayoutComponent } from './auth-admin-layout.component';

describe('AuthAdminLayoutComponent', () => {
  let component: AuthAdminLayoutComponent;
  let fixture: ComponentFixture<AuthAdminLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AuthAdminLayoutComponent]
    });
    fixture = TestBed.createComponent(AuthAdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
