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
  recommendations: DestinationCard[] = [];
  cityFilters: CityFilter[] = [];
  loading = true;

  constructor(
    private homeService: HomeService,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.locationService.requestAndStore();
    this.cityFilters = this.homeService.getCityFilters();

    this.homeService.getHomeData().subscribe((data) => {
      this.heroBanners = data.heroBanners;
      this.featuredDestinations = data.featuredDestinations;
      this.upcomingEvents = data.upcomingEvents;
      this.popularActivities = data.popularActivities;
      this.travelerReviews = data.travelerReviews;
      this.loading = false;
      this.cdr.detectChanges();
    });

    this.homeService.getRecommendations().subscribe((recs) => {
      this.recommendations = recs;
    });
  }

  onCitySelected(cityId: number | null) {
    // Filter destinations by city when API is connected
    console.log('City filter:', cityId);
  }

  onSearch(query: string) {
    // Navigate to search page when router is set up
    console.log('Search query:', query);
  }
}
