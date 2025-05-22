import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningEditComponent } from './planning-edit.component';

describe('PlanningEditComponent', () => {
  let component: PlanningEditComponent;
  let fixture: ComponentFixture<PlanningEditComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningEditComponent]
    });
    fixture = TestBed.createComponent(PlanningEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
