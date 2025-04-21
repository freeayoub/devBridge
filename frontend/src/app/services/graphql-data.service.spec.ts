import { TestBed } from '@angular/core/testing';

import { GraphqlDataService } from './graphql-data.service';

describe('GraphqlDataService', () => {
  let service: GraphqlDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphqlDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
