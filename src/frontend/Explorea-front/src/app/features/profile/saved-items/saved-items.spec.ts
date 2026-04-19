import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavedItemsPage } from './saved-items';

describe('SavedItemsPage', () => {
  let component: SavedItemsPage;
  let fixture: ComponentFixture<SavedItemsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavedItemsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(SavedItemsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
