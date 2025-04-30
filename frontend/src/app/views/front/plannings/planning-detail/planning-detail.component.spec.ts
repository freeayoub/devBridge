import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningDetailComponent } from './planning-detail.component';

describe('PlanningDetailComponent', () => {
  let component: PlanningDetailComponent;
  let fixture: ComponentFixture<PlanningDetailComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningDetailComponent]
    });
    fixture = TestBed.createComponent(PlanningDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
