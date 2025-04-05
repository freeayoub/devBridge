import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { guardadminGuard } from './guardadmin.guard';

describe('guardadminGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => guardadminGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
