import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { noguarduserGuard } from './noguarduser.guard';

describe('noguarduserGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => noguarduserGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
