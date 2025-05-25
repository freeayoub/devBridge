import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EquipeFormComponent } from './equipe-form.component';

describe('EquipeFormComponent', () => {
  let component: EquipeFormComponent;
  let fixture: ComponentFixture<EquipeFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EquipeFormComponent]
    });
    fixture = TestBed.createComponent(EquipeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
