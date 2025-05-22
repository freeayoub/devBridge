import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionEditComponent } from './reunion-edit.component';

describe('ReunionEditComponent', () => {
  let component: ReunionEditComponent;
  let fixture: ComponentFixture<ReunionEditComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReunionEditComponent]
    });
    fixture = TestBed.createComponent(ReunionEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
