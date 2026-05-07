import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectRequestDetail } from './object-request-detail';

describe('ObjectRequestDetail', () => {
  let component: ObjectRequestDetail;
  let fixture: ComponentFixture<ObjectRequestDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectRequestDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectRequestDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
