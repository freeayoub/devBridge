import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { guarduserGuard } from './guarduser.guard';

describe('guarduserGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => guarduserGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
