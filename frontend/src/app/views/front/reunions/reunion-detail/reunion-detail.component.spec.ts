import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionDetailComponent } from './reunion-detail.component';

describe('ReunionDetailComponent', () => {
  let component: ReunionDetailComponent;
  let fixture: ComponentFixture<ReunionDetailComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReunionDetailComponent]
    });
    fixture = TestBed.createComponent(ReunionDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
