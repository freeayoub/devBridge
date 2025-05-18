import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningsComponent } from './plannings.component';

describe('PlanningsComponent', () => {
  let component: PlanningsComponent;
  let fixture: ComponentFixture<PlanningsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningsComponent]
    });
    fixture = TestBed.createComponent(PlanningsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
