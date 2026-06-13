using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Data;
using Activity = Explorea.API.Models.Activity;

namespace Explorea.Server.Repositories.Implementations
{
    public class SearchRepository : ISearchRepository
    {
        private readonly AppDbContext _db;

        public SearchRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<Destination>> SearchDestinationsAsync(string query, int take = 25)
        {
            var contains = $"%{query}";

            return await _db.Destinations
            .AsNoTracking()
            .Include(d => d.City)
            .Where(d =>
                !d.IsDeleted &&
                d.Visibility != "draft" && d.Visibility != "rejected" &&
                (EF.Functions.ILike(d.Name, contains) ||
                 (d.Description != null && EF.Functions.ILike(d.Description, contains)))
            )
            .OrderByDescending(d => d.IsFeatured)
            .ThenByDescending(d => d.AvgRating)
            .ThenBy(d => d.Name)
            .Take(take)
            .ToListAsync();
        }
        public async Task<List<Place>> SearchPlacesAsync(string query, int take = 25)
        {
         var contains = $"%{query}";

            return await _db.Places
            .AsNoTracking()
            .Include(p => p.City)
            .Include(p => p.Destination)
            .Include(p => p.Type)
            .Include(p => p.Images)
            .Where(p =>
                !p.IsDeleted &&
                p.ApprovalStatus == "approved" &&
                (
                EF.Functions.ILike(p.Name, contains) ||
                (p.Description != null && EF.Functions.ILike(p.Description, contains)) ||
                (p.Address != null && EF.Functions.ILike(p.Address, contains)) ||
                (p.City != null && EF.Functions.ILike(p.City.Name, contains)) ||
                (p.Destination != null && EF.Functions.ILike(p.Destination.Name, contains)) ||
                (p.Type != null && EF.Functions.ILike(p.Type.Name, contains))
                )
            )
            .OrderByDescending(p => p.IsFeatured)
            .ThenByDescending(p => p.AvgRating)
            .ThenBy(p => p.Name)
            .Take(take)
            .ToListAsync();
        }
        public async Task<List<Event>> SearchEventsAsync(string query, DateTimeOffset now, int take = 25)
        {
            var contains = $"%{query}";

            return await _db.Events
            .AsNoTracking()
            .Include(e => e.City)
            .Include(e => e.Destination)
            .Include(e => e.Place)
            .Include(e => e.Type)
            .Include(e => e.Images)
            .Where(e =>
                !e.IsDeleted &&
                (e.Visibility != "draft" && e.Visibility != "rejected") &&
                e.EndDatetime >= now &&
                (
                EF.Functions.ILike(e.Name, contains) ||
                (e.Description != null && EF.Functions.ILike(e.Description, contains)) ||
                (e.Address != null && EF.Functions.ILike(e.Address, contains)) ||
                (e.City != null && EF.Functions.ILike(e.City.Name, contains)) ||
                (e.Destination != null && EF.Functions.ILike(e.Destination.Name, contains)) ||
                (e.Place != null && EF.Functions.ILike(e.Place.Name, contains)) ||
                EF.Functions.ILike(e.Type.Name, contains)
                )
            )
            .OrderByDescending(e => e.IsFeatured)
            .ThenByDescending(e => e.StartDatetime)
            .ThenBy(e => e.Name)
            .Take(take)
            .ToListAsync();
        }
        public async Task<List<Activity>> SearchActivitiesAsync(string query, int take = 25)
        {
            var contains = $"%{query}";

            return await _db.Activities
            .AsNoTracking()
            .Include(a => a.City)
            .Include(a => a.Destination)
            .Include(a => a.Place)
            .Include(a => a.Category)
            .Include(a => a.Images)
            .Where(a =>
                !a.IsDeleted &&
                (EF.Functions.ILike(a.Name, contains) ||
                (a.Description != null && EF.Functions.ILike(a.Description, contains)) ||
                (a.StartPoint != null && EF.Functions.ILike(a.StartPoint, contains)) ||
                (a.City != null && EF.Functions.ILike(a.City.Name, contains)) ||
                (a.Destination != null && EF.Functions.ILike(a.Destination.Name, contains)) ||
                (a.Place != null && EF.Functions.ILike(a.Place.Name, contains)) ||
                EF.Functions.ILike(a.Category.Name, contains))
            )
            .OrderByDescending(a => a.IsFeatured)
            .ThenByDescending(a => a.AvgRating)
            .ThenBy(a => a.Name)
            .Take(take)
            .ToListAsync();
        }

        public async Task<(List<Destination> Destinations, List<Place> Places,
              List<Event> Events, List<Activity> Activities, int Total)>
            SearchAsync(string? q, string type, int? cityId,
                       decimal? minRating, decimal? maxPrice, int page, int pageSize)
        {
            var destinations = new List<Destination>();
            var places = new List<Place>();
            var events = new List<Event>();
            var activities = new List<Activity>();

            if (type == "all" || type == "destination")
            {
                var query = _db.Destinations.Include(d => d.City).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(d => d.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(d => d.CityId == cityId);
                if (minRating.HasValue)
                    query = query.Where(d => d.AvgRating >= minRating);
                destinations = await query.ToListAsync();
            }

            if (type == "all" || type == "place")
            {
                var query = _db.Places.Include(p => p.City).Include(p => p.Type)
                    .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved")
                    .AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(p => p.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(p => p.CityId == cityId);
                if (minRating.HasValue)
                    query = query.Where(p => p.AvgRating >= minRating);
                places = await query.ToListAsync();
            }

            if (type == "all" || type == "event")
            {
                var now = DateTimeOffset.UtcNow;
                var query = _db.Events.Include(e => e.City).Include(e => e.Type)
                    .Where(e =>
                        !e.IsDeleted &&
                        (e.Visibility != "draft" && e.Visibility != "rejected") &&
                        e.EndDatetime >= now)
                    .AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(e => e.Name.Contains(q));
                if (cityId.HasValue)
                    query = query.Where(e => e.CityId == cityId);
                if (maxPrice.HasValue)
                    query = query.Where(e => e.Price == null || e.Price <= maxPrice);
                events = await query.ToListAsync();
            }

            if (type == "all" || type == "activity")
            {
                var query = _db.Activities.Include(a => a.Category).AsQueryable();
                if (!string.IsNullOrEmpty(q))
                    query = query.Where(a => a.Name.Contains(q));
                if (maxPrice.HasValue)
                    query = query.Where(a => a.Price == null || a.Price <= maxPrice);
                activities = await query.ToListAsync();
            }

            var total = destinations.Count + places.Count + events.Count + activities.Count;

            return (destinations, places, events, activities, total);
        }

        public async Task<(List<Place> Places, List<Event> Events, List<Activity> Activities)>
            SearchMapAsync(double lat, double lng, double radiusKm, string type)
        {
            var places = new List<Place>();
            var events = new List<Event>();
            var activities = new List<Activity>();

            var radiusMeters = radiusKm * 1000;

            if (type == "all" || type == "place")
            {
                places = await _db.Places
                    .Include(p => p.Type)
                    .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved" && p.Latitude != 0 && p.Longitude != 0)
                    .ToListAsync();
            }

            if (type == "all" || type == "event")
            {
                var now = DateTimeOffset.UtcNow;
                events = await _db.Events
                    .Include(e => e.Type)
                    .Where(e =>
                        !e.IsDeleted &&
                        (e.Visibility != "draft" && e.Visibility != "rejected") &&
                        e.EndDatetime >= now &&
                        e.Latitude != null &&
                        e.Longitude != null)
                    .ToListAsync();
            }

            if (type == "all" || type == "activity")
            {
                activities = await _db.Activities
                    .Include(a => a.Category)
                    .Where(a => a.Latitude != null && a.Longitude != null)
                    .ToListAsync();
            }

            return (places, events, activities);
        }

    // SHORTCUTS ZA PRETRAGU
    async Task<List<Destination>> ISearchRepository.GetDestinationsForSearchAsync(int take)
    {
      return await _db.Destinations
      .AsNoTracking()
      .Include(d => d.City)
      .Where(d => !d.IsDeleted && d.Visibility != "draft" && d.Visibility != "rejected")
      .OrderByDescending(d => d.IsFeatured)
      .ThenByDescending(d => d.AvgRating)
      .ThenBy(d => d.Name)
      .Take(take)
      .ToListAsync();
    }
    async Task<List<Activity>> ISearchRepository.GetActivitiesForSearchAsync(int take)
    {
      return await _db.Activities
        .AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.Images)
        .Where(a => !a.IsDeleted)
        .OrderByDescending(a => a.IsFeatured)
        .ThenByDescending(a => a.AvgRating)
        .ThenBy(a => a.Name)
        .Take(take)
        .ToListAsync();
    }

    async Task<List<Place>> ISearchRepository.GetPlacesForSearchAsync(int take)
    {
      return await _db.Places
        .AsNoTracking()
        .Include(p => p.City)
        .Include(p => p.Type)
        .Include(p => p.Images)
        .Where(p => !p.IsDeleted && p.ApprovalStatus == "approved")
        .OrderByDescending(p => p.IsFeatured)
        .ThenByDescending(p => p.AvgRating)
        .ThenBy(p => p.Name)
        .Take(take)
        .ToListAsync();
    }

    async Task<List<Event>> ISearchRepository.GetEventsForSearchAsync(DateTimeOffset now, int take)
    {
      return await _db.Events
        .AsNoTracking()
        .Include(e => e.Type)
        .Include(e => e.City)
        .Include(e => e.Images)
        .Where(e => !e.IsDeleted && (e.Visibility != "draft" && e.Visibility != "rejected") && e.EndDatetime >= now)
        .OrderByDescending(e => e.IsFeatured)
        .ThenBy(e => e.StartDatetime)
        .ThenBy(e => e.Name)
        .Take(take)
        .ToListAsync();
    }

    // RAW SQL DEO
    async Task<List<SearchProjection<Destination>>> ISearchRepository.SearchDestinationsAsync(string query, int take)
    {
        var rows = await ExecuteDestinationSearchAsync(query, take);
        if(rows.Count == 0) return new List<SearchProjection<Destination>>();

        var ids = rows.Select(r => r.Id).ToList();

        var entities = await _db.Destinations
            .AsNoTracking()
            .Include(d => d.City)
            .Where(d => ids.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id);

        return rows
            .Where(r => entities.ContainsKey(r.Id))
            .Select(r => new SearchProjection<Destination>
            {
               Entity = entities[r.Id],
               FtsRank = r.FtsRank,
               NameSimilarity = r.NameSimilarity,
               CitySimilarity = r.CitySimilarity 
            })
            .ToList();
    }

    private async Task<List<DestinationSearchHitRow>> ExecuteDestinationSearchAsync(string query, int take)
    {
        const string sql = """
        SELECT
            d.id AS id,
            ts_rank(
                d.search_vector,
                websearch_to_tsquery('simple', @q)
            ) AS fts_rank,
            GREATEST(
                similarity(d.name, @q),
                word_similarity(@q, COALESCE(d.name, ''))
            ) AS name_similarity,
            CASE
                WHEN c.name IS NULL THEN NULL
                ELSE GREATEST(
                    similarity(c.name, @q),
                    word_similarity(@q, COALESCE(c.name, ''))
                )
            END AS city_similarity
        FROM destinations d
        LEFT JOIN cities c ON c.id = d.city_id
        WHERE d.is_deleted = FALSE
          AND d.visibility NOT IN ('draft', 'rejected')
          AND (
                d.search_vector @@ websearch_to_tsquery('simple', @q)
             OR unaccent(d.name) ILIKE @containsUnaccent
             OR unaccent(COALESCE(d.address, '')) ILIKE @containsUnaccent
             OR COALESCE(d.description, '') ILIKE @contains
             OR (
                    @enableFuzzy = TRUE
                AND (
                        GREATEST(
                            similarity(d.name, @q),
                            word_similarity(@q, COALESCE(d.name, ''))
                        ) >= @nameThreshold
                    )
                )
            )
        ORDER BY
            ts_rank(
                d.search_vector,
                websearch_to_tsquery('simple', @q)
            ) DESC,
            GREATEST(
                GREATEST(
                    similarity(d.name, @q),
                    word_similarity(@q, COALESCE(d.name, ''))
                ),
                COALESCE(
                    GREATEST(
                        similarity(c.name, @q),
                        word_similarity(@q, COALESCE(c.name, ''))
                    ),
                    0
                )
            ) DESC,
            d.is_featured DESC,
            d.avg_rating DESC,
            d.name ASC
        LIMIT @take;
        """;

        var result = new List<DestinationSearchHitRow>();
        await using var conn = CreateConnection();
        await conn.OpenAsync();

        await using var cmd = CreateSearchCommand(conn, sql, query, take);
        await using var reader = await cmd.ExecuteReaderAsync();

        while(await reader.ReadAsync())
        {
          result.Add(new DestinationSearchHitRow
          {
              Id = reader.GetGuid(reader.GetOrdinal("id")),
              FtsRank = Convert.ToDouble(reader.GetValue(reader.GetOrdinal("fts_rank"))),
              NameSimilarity = reader.GetDouble(reader.GetOrdinal("name_similarity")),
              CitySimilarity = GetNullableDouble(reader, "city_similarity")
          });      
        }

        return result;
    }
    // =====================================================================================================
    // OBUHVATA DESTINACIJE --------------------------------------------------------------------------------
    // =====================================================================================================
    
    async Task<List<SearchProjection<Place>>> ISearchRepository.SearchPlacesAsync(string query, int take)
    {
       var rows = await ExecutePlaceSearchAsync(query, take);
       if(rows.Count == 0) return new List<SearchProjection<Place>>();

       var ids = rows.Select(r => r.Id).ToList();

       var entities = await _db.Places
            .AsNoTracking()
            .Include(p => p.City)
            .Include(p => p.Destination)
            .Include(p => p.Type)
            .Include(p => p.Images)
            .Where(p => ids.Contains(p.Id) && !p.IsDeleted && p.ApprovalStatus == "approved")
            .ToDictionaryAsync(p => p.Id);

        return rows
            .Where(r => entities.ContainsKey(r.Id))
            .Select(r => new SearchProjection<Place>
            {
                Entity = entities[r.Id],
                FtsRank = r.FtsRank,
                NameSimilarity = r.NameSimilarity,
                CitySimilarity = r.CitySimilarity,
                DestinationSimilarity = r.DestinationSimilarity,
                TypeSimilarity = r.TypeSimilarity,
            })
            .ToList();
    }
    private async Task<List<PlaceSearchHitRow>> ExecutePlaceSearchAsync(string query, int take){
        const string sql = """
            SELECT
                p.id AS id,
                ts_rank(
                    p.search_vector,
                    websearch_to_tsquery('simple', @q)
                ) AS fts_rank,
                GREATEST(
                    similarity(p.name, @q),
                    word_similarity(@q, COALESCE(p.name, ''))
                ) AS name_similarity,
                CASE
                    WHEN c.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(c.name, @q),
                        word_similarity(@q, COALESCE(c.name, ''))
                    )
                END AS city_similarity,
                CASE
                    WHEN d.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(d.name, @q),
                        word_similarity(@q, COALESCE(d.name, ''))
                    )
                END AS destination_similarity,
                CASE
                    WHEN pt.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(pt.name, @q),
                        word_similarity(@q, COALESCE(pt.name, ''))
                    )
                END AS type_similarity
            FROM places p
            LEFT JOIN cities c ON c.id = p.city_id
            LEFT JOIN destinations d ON d.id = p.destination_id AND d.is_deleted = FALSE
            LEFT JOIN place_types pt ON pt.id = p.type_id
            WHERE p.is_deleted = FALSE
              AND p.approval_status = 'approved'
              AND (
                    p.search_vector @@ websearch_to_tsquery('simple', @q)
                 OR p.name ILIKE @contains
                 OR COALESCE(p.description, '') ILIKE @contains
                 OR COALESCE(p.address, '') ILIKE @contains
                 OR COALESCE(c.name, '') ILIKE @contains
                 OR COALESCE(d.name, '') ILIKE @contains
                 OR COALESCE(pt.name, '') ILIKE @contains
                 OR (
                        @enableFuzzy = TRUE
                    AND (
                            GREATEST(
                                similarity(p.name, @q),
                                word_similarity(@q, COALESCE(p.name, ''))
                            ) >= @nameThreshold
                            OR GREATEST(
                                similarity(c.name, @q),
                                word_similarity(@q, COALESCE(c.name, ''))
                            ) >= @relatedThreshold
                            OR GREATEST(
                                similarity(d.name, @q),
                                word_similarity(@q, COALESCE(d.name, ''))
                            ) >= @relatedThreshold
                            OR GREATEST(
                                similarity(pt.name, @q),
                                word_similarity(@q, COALESCE(pt.name, ''))
                            ) >= @relatedThreshold
                        )
                    )
               )
            ORDER BY
                ts_rank(
                    p.search_vector, 
                    websearch_to_tsquery('simple', @q)
                ) DESC,
                GREATEST(
                    GREATEST(
                        similarity(p.name, @q),
                        word_similarity(@q, COALESCE(p.name, ''))
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(c.name, @q),
                            word_similarity(@q, COALESCE(c.name, ''))
                        ),
                        0
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(d.name, @q),
                            word_similarity(@q, COALESCE(d.name, ''))
                        ),
                        0
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(pt.name, @q),
                            word_similarity(@q, COALESCE(pt.name, ''))
                        ),
                        0
                    )
                ) DESC,
                p.is_featured DESC,
                p.popularity DESC,
                p.avg_rating DESC,
                p.name ASC
            LIMIT @take;
            """;

        var result = new List<PlaceSearchHitRow>();
        await using var conn = CreateConnection();
        await conn.OpenAsync();

        await using var cmd = CreateSearchCommand(conn, sql, query, take);
        await using var reader = await cmd.ExecuteReaderAsync();

        while(await reader.ReadAsync())
        {
          result.Add(new PlaceSearchHitRow
          {
              Id = reader.GetGuid(reader.GetOrdinal("id")),
              FtsRank = Convert.ToDouble(reader.GetValue(reader.GetOrdinal("fts_rank"))),
              NameSimilarity = reader.GetDouble(reader.GetOrdinal("name_similarity")),
              CitySimilarity = GetNullableDouble(reader, "city_similarity"),
              DestinationSimilarity = GetNullableDouble(reader, "destination_similarity"),
              TypeSimilarity = GetNullableDouble(reader, "type_similarity")
          });      
        }

        return result;
    }
    // OBUHVATA MESTA --------------------------------------------------------------------------------

    async Task<List<SearchProjection<Event>>> ISearchRepository.SearchEventsAsync(string query, DateTimeOffset now, int take)
    {
        var rows = await ExecuteEventSearchAsync(query, now, take);
        if(rows.Count == 0) return new List<SearchProjection<Event>>();

        var ids = rows.Select(r => r.Id).ToList();

        var entities = await _db.Events
            .AsNoTracking()
            .Include(e => e.City)        
            .Include(e => e.Destination)        
            .Include(e => e.Place)        
            .Include(e => e.Type)        
            .Include(e => e.Images)
            .Where(e =>
                ids.Contains(e.Id) &&
                !e.IsDeleted &&
                (e.Visibility != "draft" && e.Visibility != "rejected") &&
                e.EndDatetime >= now)
            .ToDictionaryAsync(e => e.Id);

        return rows
            .Where(r => entities.ContainsKey(r.Id))
            .Select(r => new SearchProjection<Event>
            {
                Entity = entities[r.Id],
                FtsRank = r.FtsRank,
                NameSimilarity = r.NameSimilarity,
                CitySimilarity = r.CitySimilarity,
                DestinationSimilarity = r.DestinationSimilarity,
                PlaceSimilarity = r.PlaceSimilarity,
                TypeSimilarity = r.TypeSimilarity
            }).ToList();        
    }
    private async Task<List<EventSearchHitRow>> ExecuteEventSearchAsync(string query, DateTimeOffset now, int take)
    {
        const string sql = """
        SELECT
            e.id AS id,
            ts_rank(
                e.search_vector,
                websearch_to_tsquery('simple', @q)
            ) AS fts_rank,
            GREATEST(
                similarity(e.name, @q),
                word_similarity(@q, COALESCE(e.name, ''))
            ) AS name_similarity,
            CASE
                WHEN c.name IS NULL THEN NULL
                ELSE GREATEST(
                    similarity(c.name, @q),
                    word_similarity(@q, COALESCE(c.name, ''))
                )
            END AS city_similarity,
            CASE
                WHEN d.name IS NULL THEN NULL
                ELSE GREATEST(
                    similarity(d.name, @q),
                    word_similarity(@q, COALESCE(d.name, ''))
                )
            END AS destination_similarity,
            CASE
                WHEN p.name IS NULL THEN NULL
                ELSE GREATEST(
                    similarity(p.name, @q),
                    word_similarity(@q, COALESCE(p.name, ''))
                )
            END AS place_similarity,
            GREATEST(
                similarity(et.name, @q),
                word_similarity(@q, COALESCE(et.name, ''))
            ) AS type_similarity
        FROM events e
        LEFT JOIN cities c ON c.id = e.city_id
        LEFT JOIN destinations d ON d.id = e.destination_id AND d.is_deleted = FALSE
        LEFT JOIN places p ON p.id = e.place_id AND p.is_deleted = FALSE
        INNER JOIN event_types et ON et.id = e.type_id
        WHERE e.is_deleted = FALSE
          AND e.visibility NOT IN ('draft', 'rejected')
          AND e.end_datetime >= @now
          AND (
                e.search_vector @@ websearch_to_tsquery('simple', @q)
             OR e.name ILIKE @contains
             OR COALESCE(e.description, '') ILIKE @contains
             OR COALESCE(e.address, '') ILIKE @contains
             OR (
                    @enableFuzzy = TRUE
                AND (
                        GREATEST(
                            similarity(e.name, @q),
                            word_similarity(@q, COALESCE(e.name, ''))
                        ) >= @nameThreshold
                        OR GREATEST(
                            similarity(COALESCE(c.name, ''), @q),
                            word_similarity(@q, COALESCE(c.name, ''))
                        ) >=  @relatedThreshold
                        OR GREATEST(
                            similarity(COALESCE(d.name, ''), @q),
                            word_similarity(@q, COALESCE(d.name, ''))
                        ) >=  @relatedThreshold
                        OR GREATEST(
                            similarity(COALESCE(p.name, ''), @q),
                            word_similarity(@q, COALESCE(d.name, ''))
                        ) >=  @relatedThreshold
                        OR GREATEST(
                            similarity(COALESCE(et.name, ''), @q),
                            word_similarity(@q, COALESCE(et.name, ''))
                        ) >=  @relatedThreshold
                    )
                )
            )
        ORDER BY
            ts_rank(
                e.search_vector, 
                websearch_to_tsquery('simple', @q)
            ) DESC,
            GREATEST(
                GREATEST(
                    similarity(e.name, @q),
                    word_similarity(@q, COALESCE(e.name, ''))
                ),
                COALESCE(
                    GREATEST(
                        similarity(c.name, @q),
                        word_similarity(@q, COALESCE(c.name, ''))
                    ),
                    0
                ),
                COALESCE(
                    GREATEST(
                        similarity(d.name, @q),
                        word_similarity(@q, COALESCE(d.name, ''))
                    ),
                    0
                ),
                COALESCE(
                    GREATEST(
                        similarity(p.name, @q),
                        word_similarity(@q, COALESCE(p.name, ''))
                    ),
                    0
                ),
                GREATEST(
                    similarity(et.name, @q),
                    word_similarity(@q, COALESCE(et.name, ''))
                )
            ) DESC,
            e.is_featured DESC,
            e.popularity DESC,
            e.start_datetime ASC,
            e.name ASC
        LIMIT @take;
        """;

        var result = new List<EventSearchHitRow>();
        await using var conn = CreateConnection();
        await conn.OpenAsync();

        await using var cmd = CreateSearchCommand(conn, sql, query, take);
        cmd.Parameters.Add(new NpgsqlParameter("@now", now));

        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            result.Add(new EventSearchHitRow
            {
                Id = reader.GetGuid(reader.GetOrdinal("id")),
                FtsRank = Convert.ToDouble(reader.GetValue(reader.GetOrdinal("fts_rank"))),
                NameSimilarity = reader.GetDouble(reader.GetOrdinal("name_similarity")),
                CitySimilarity = GetNullableDouble(reader, "city_similarity"),
                DestinationSimilarity = GetNullableDouble(reader, "destination_similarity"),
                PlaceSimilarity = GetNullableDouble(reader, "place_similarity"),
                TypeSimilarity = GetNullableDouble(reader, "type_similarity")
            });
        }

        return result;
    }
    // OBUHVATA DOGADJAJE --------------------------------------------------------------------------------

    async Task<List<SearchProjection<Activity>>> ISearchRepository.SearchActivitiesAsync(string query, int take)
    {
      var rows = await ExecuteActivitySearchAsync(query, take);
      if (rows.Count == 0) return new List<SearchProjection<Activity>>();
      
      var ids = rows.Select(r => r.Id).ToList();
      
      var entities = await _db.Activities
          .AsNoTracking()
          .Include(a => a.City)
          .Include(a => a.Destination)
          .Include(a => a.Place)
          .Include(a => a.Category)
          .Include(a => a.Images)
          .Where(a => ids.Contains(a.Id))
          .ToDictionaryAsync(a => a.Id);
      
      return rows
          .Where(r => entities.ContainsKey(r.Id))
          .Select(r => new SearchProjection<Activity>
          {
              Entity = entities[r.Id],
              FtsRank = r.FtsRank,
              NameSimilarity = r.NameSimilarity,
              CitySimilarity = r.CitySimilarity,
              DestinationSimilarity = r.DestinationSimilarity,
              PlaceSimilarity = r.PlaceSimilarity,
              CategorySimilarity = r.CategorySimilarity
          })
          .ToList();
    }
    private async Task<List<ActivitySearchHitRow>> ExecuteActivitySearchAsync(string query, int take){
        const string sql = """
            SELECT
                a.id AS id,
                ts_rank(
                    a.search_vector,
                    websearch_to_tsquery('simple', @q)
                ) AS fts_rank,
                GREATEST(
                    similarity(a.name, @q),
                    word_similarity(@q, COALESCE(a.name, ''))
                ) AS name_similarity,
                CASE
                    WHEN c.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(c.name, @q),
                        word_similarity(@q, COALESCE(c.name, ''))
                    )
                END AS city_similarity,
                CASE
                    WHEN d.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(d.name, @q),
                        word_similarity(@q, COALESCE(d.name, ''))
                    )
                END AS destination_similarity,
                CASE
                    WHEN p.name IS NULL THEN NULL
                    ELSE GREATEST(
                        similarity(p.name, @q),
                        word_similarity(@q, COALESCE(p.name, ''))
                    )
                END AS place_similarity,
                GREATEST(
                    similarity(ac.name, @q),
                    word_similarity(@q, COALESCE(ac.name, ''))
                ) AS category_similarity
            FROM activities a
            LEFT JOIN cities c ON c.id = a.city_id
            LEFT JOIN destinations d ON d.id = a.destination_id AND d.is_deleted = FALSE
            LEFT JOIN places p ON p.id = a.place_id AND p.is_deleted = FALSE
            INNER JOIN activity_categories ac ON ac.id = a.category_id
            WHERE a.is_deleted = FALSE
              AND (
                    a.search_vector @@ websearch_to_tsquery('simple', @q)
                 OR a.name ILIKE @contains
                 OR COALESCE(a.description, '') ILIKE @contains
                 OR COALESCE(a.start_point, '') ILIKE @contains
                 OR (
                        @enableFuzzy = TRUE
                    AND (
                            GREATEST(
                                similarity(a.name, @q),
                                word_similarity(@q, COALESCE(a.name, ''))
                            ) >= @nameThreshold
                            OR GREATEST(
                                similarity(COALESCE(c.name, ''), @q),
                                word_similarity(@q, COALESCE(c.name, ''))
                            ) >= @relatedThreshold
                            OR GREATEST(
                                similarity(COALESCE(d.name, ''), @q),
                                word_similarity(@q, COALESCE(d.name, ''))
                            ) >= @relatedThreshold
                            OR GREATEST(
                                similarity(COALESCE(p.name, ''), @q),
                                word_similarity(@q, COALESCE(p.name, ''))
                            ) >= @relatedThreshold
                            OR GREATEST(
                                similarity(COALESCE(ac.name, ''), @q),
                                word_similarity(@q, COALESCE(ac.name, ''))
                            ) >= @relatedThreshold
                        )
                    )
                )
            ORDER BY
                ts_rank(
                    a.search_vector,
                    websearch_to_tsquery('simple', @q)
                ) DESC,
                GREATEST(
                    GREATEST(
                        similarity(a.name, @q),
                        word_similarity(@q, COALESCE(a.name, ''))
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(c.name, @q),
                            word_similarity(@q, COALESCE(c.name, ''))
                        ),
                        0
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(d.name, @q),
                            word_similarity(@q, COALESCE(d.name, ''))
                        ),
                        0
                    ),
                    COALESCE(
                        GREATEST(
                            similarity(p.name, @q),
                            word_similarity(@q, COALESCE(p.name, ''))
                        ),
                        0
                    ),
                    GREATEST(
                        similarity(ac.name, @q),
                        word_similarity(@q, COALESCE(ac.name, ''))
                    )
                ) DESC,
                a.is_featured DESC,
                a.popularity DESC,
                a.avg_rating DESC,
                a.name ASC
            LIMIT @take;
            """;

        var result = new List<ActivitySearchHitRow>();
        await using var conn = CreateConnection();
        await conn.OpenAsync();

        await using var cmd = CreateSearchCommand(conn, sql, query, take);
        await using var reader = await cmd.ExecuteReaderAsync();

        while(await reader.ReadAsync())
        {
          result.Add(new ActivitySearchHitRow
          {
              Id = reader.GetGuid(reader.GetOrdinal("id")),
              FtsRank = Convert.ToDouble(reader.GetValue(reader.GetOrdinal("fts_rank"))),
              NameSimilarity = reader.GetDouble(reader.GetOrdinal("name_similarity")),
              CitySimilarity = GetNullableDouble(reader, "city_similarity"),
              DestinationSimilarity = GetNullableDouble(reader, "destination_similarity"),
              PlaceSimilarity = GetNullableDouble(reader, "place_similarity"),
              CategorySimilarity = GetNullableDouble(reader, "category_similarity")
          });      
        }

        return result;
    }
    // OBUHVATA AKTIVNOSTI --------------------------------------------------------------------------------

    private NpgsqlConnection CreateConnection()
    {
      var connectionString = _db.Database.GetConnectionString()
          ?? throw new InvalidOperationException("Database connection string is not configured");

      return new NpgsqlConnection(connectionString);
    }

    private static (double nameThreshold, double RelatedThreshold) GetSimilarityThreshold(string query)
    {
        var normalizedLength = query.Trim().Length;

        if(normalizedLength <= 4) return (0.35, 0.40);

        if(normalizedLength <= 7) return (0.30, 0.35);
        
        return (0.25, 0.30);    
    }
    private NpgsqlCommand CreateSearchCommand(
      NpgsqlConnection conn,
      string sql,
      string query,
      int take
    )
    {
       var trimmedQuery = query.Trim();
       var enableFuzzy = trimmedQuery.Length >= 2;
       var contains = $"%{trimmedQuery}%";
       var containsUnaccent = $"%{NormalizeQuery(trimmedQuery)}%";

       var (nameThreshold, relatedThreshold) = GetSimilarityThreshold(trimmedQuery);

       var cmd = new NpgsqlCommand(sql, conn);

       cmd.Parameters.AddWithValue("@q", query);
       cmd.Parameters.AddWithValue("@contains", contains);
       cmd.Parameters.AddWithValue("@containsUnaccent", containsUnaccent);
       cmd.Parameters.AddWithValue("@enableFuzzy", enableFuzzy);
       cmd.Parameters.AddWithValue("@nameThreshold", nameThreshold);
       cmd.Parameters.AddWithValue("@relatedThreshold", relatedThreshold);
       cmd.Parameters.AddWithValue("@take", take);

       return cmd;
    }

    private static string NormalizeQuery(string input)
    {
        var normalized = input.Trim().Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (char c in normalized)
        {
            var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(System.Text.NormalizationForm.FormC).ToLower();
    }

    private static double? GetNullableDouble(NpgsqlDataReader reader, string columnName)
    {
      var ordinal = reader.GetOrdinal(columnName);
      if(reader.IsDBNull(ordinal)) return null;
      return Convert.ToDouble(reader.GetValue(ordinal));    
    } 
  }
}
