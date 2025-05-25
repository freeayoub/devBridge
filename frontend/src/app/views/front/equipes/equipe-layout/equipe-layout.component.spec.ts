import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipeLayoutComponent } from './equipe-layout.component';

describe('EquipeLayoutComponent', () => {
  let component: EquipeLayoutComponent;
  let fixture: ComponentFixture<EquipeLayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EquipeLayoutComponent]
    });
    fixture = TestBed.createComponent(EquipeLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
