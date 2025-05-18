import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanningListComponent } from './planning-list.component';

describe('PlanningListComponent', () => {
  let component: PlanningListComponent;
  let fixture: ComponentFixture<PlanningListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PlanningListComponent]
    });
    fixture = TestBed.createComponent(PlanningListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
