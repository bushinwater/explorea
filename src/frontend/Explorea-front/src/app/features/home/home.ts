import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Sidebar } from '../../layout/shell/sidebar/sidebar';
import { BottomNav } from '../../shared/bottom-nav/bottom-nav';
import { HeroBanner } from './hero-banner/hero-banner';
import { FeaturedDestinations } from './featured-destinations/featured-destinations';
import { UpcomingEvents } from './upcoming-events/upcoming-events';
import { PopularActivities } from './popular-activities/popular-activities';
import { AiRecommendations } from './ai-recommendations/ai-recommendations';
import { TravelReviews } from './travel-reviews/travel-reviews';
import { HomeService } from '../../core/services/home.service';
import { LocationService } from '../../core/services/location.service';
import { LookupService } from '../../core/services/lookup.service';
import { DetailFooter } from '../../shared/components/detail-footer/detail-footer';
import {
  HeroBanner as HeroBannerModel,
  DestinationCard,
  EventCard,
  ActivityCard,
  ReviewDto,
  CityFilter,
} from '../../core/models/home.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    Sidebar,
    BottomNav,
    HeroBanner,
    FeaturedDestinations,
    UpcomingEvents,
    PopularActivities,
    AiRecommendations,
    TravelReviews,
    DetailFooter,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  heroBanners: HeroBannerModel[] = [];
  featuredDestinations: DestinationCard[] = [];
  upcomingEvents: EventCard[] = [];
  popularActivities: ActivityCard[] = [];
  travelerReviews: ReviewDto[] = [];
  recommendedDestinations: DestinationCard[] = [];
  recommendedEvents: EventCard[] = [];
  recommendedActivities: ActivityCard[] = [];
  cityFilters: CityFilter[] = [];
  loading = true;
  activeCityId: number | null = null;

  constructor(
    private homeService: HomeService,
    private locationService: LocationService,
    private lookupService: LookupService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.locationService.requestIfFirstTime();
    this.cityFilters = [{ id: null, name: 'Popularne' }];
    this.lookupService.getCities().subscribe(cities => {
      this.cityFilters = [{ id: null, name: 'Popularne' }, ...cities.slice(0, 6).map(c => ({ id: c.id, name: c.name }))];
      this.cdr.detectChanges();
    });
    this.loadHomeData(null);

    const loc = this.locationService.getCached();
    this.homeService.getRecommendations(loc?.lat, loc?.lng).subscribe((recs) => {
      this.recommendedDestinations = recs?.destinations ?? [];
      this.recommendedEvents = recs?.events ?? [];
      this.recommendedActivities = recs?.activities ?? [];
    });
  }

  private loadHomeData(cityId: number | null): void {
    this.loading = true;
    this.cdr.detectChanges();
    const loc = this.locationService.getCached();
    this.homeService.getHomeData(cityId, loc?.lat, loc?.lng).subscribe((data) => {
      this.heroBanners = data.heroBanners;
      this.featuredDestinations = data.featuredDestinations;
      this.upcomingEvents = data.upcomingEvents;
      this.popularActivities = data.popularActivities;
      this.travelerReviews = data.travelerReviews;
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  onCitySelected(cityId: number | null) {
    this.activeCityId = cityId;
    this.loadHomeData(cityId);
  }

  onSearch(query: string) {
    // Navigate to search page when router is set up
    console.log('Search query:', query);
  }
}
