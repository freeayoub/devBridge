import { TestBed } from '@angular/core/testing';

import { ReunionService } from './reunion.service';

describe('ReunionService', () => {
  let service: ReunionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReunionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
