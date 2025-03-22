import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllusersComponent } from './allusers.component';

describe('AllusersComponent', () => {
  let component: AllusersComponent;
  let fixture: ComponentFixture<AllusersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AllusersComponent]
    });
    fixture = TestBed.createComponent(AllusersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
