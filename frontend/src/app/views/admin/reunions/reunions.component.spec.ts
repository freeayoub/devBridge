import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReunionsComponent } from './reunions.component';

describe('ReunionsComponent', () => {
  let component: ReunionsComponent;
  let fixture: ComponentFixture<ReunionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ReunionsComponent]
    });
    fixture = TestBed.createComponent(ReunionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
