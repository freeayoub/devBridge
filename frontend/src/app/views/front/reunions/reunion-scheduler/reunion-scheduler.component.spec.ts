import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionSchedulerComponent } from './reunion-scheduler.component';

describe('ReunionSchedulerComponent', () => {
  let component: ReunionSchedulerComponent;
  let fixture: ComponentFixture<ReunionSchedulerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReunionSchedulerComponent]
    });
    fixture = TestBed.createComponent(ReunionSchedulerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
