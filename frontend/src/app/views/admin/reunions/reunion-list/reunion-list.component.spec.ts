import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionListComponent } from './reunion-list.component';

describe('ReunionListComponent', () => {
  let component: ReunionListComponent;
  let fixture: ComponentFixture<ReunionListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReunionListComponent]
    });
    fixture = TestBed.createComponent(ReunionListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
