import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningFormComponent } from './planning-form.component';

describe('PlanningFormComponent', () => {
  let component: PlanningFormComponent;
  let fixture: ComponentFixture<PlanningFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningFormComponent]
    });
    fixture = TestBed.createComponent(PlanningFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
