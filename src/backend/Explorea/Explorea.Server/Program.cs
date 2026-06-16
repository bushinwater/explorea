using Explorea.API.Models;
using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.McpTools;
using Explorea.Server.Repositories.Admin;
using Explorea.Server.Repositories.Admin.Interfaces;
using Explorea.Server.Repositories.Implementations;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services;
using Explorea.Server.Services.Admin;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseNetTopologySuite() // za koordinate
    )
);

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Explorea.Server",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Unesi: Bearer {token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddScoped<ISearchRepository, SearchRepository>();
builder.Services.AddScoped<ISearchService, SearchService>();

builder.Services.AddScoped<IHomeRepository, HomeRepository>();
builder.Services.AddScoped<IHomeService, HomeService>();

builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IActivityService, ActivityService>();

builder.Services.AddScoped<ISearchPageService, SearchPageService>();
builder.Services.AddScoped<ISearchPageRepository, SearchPageRepository>();

builder.Services.AddScoped<IAdminPlaceRepository, AdminPlaceRepository>();
builder.Services.AddScoped<IAdminPlaceService, AdminPlaceService>();

builder.Services.AddScoped<IAdminActivityRepository, AdminActivityRepository>();
builder.Services.AddScoped<IAdminActivityService, AdminActivityService>();
builder.Services.AddScoped<IAdminActivityFeedService, AdminActivityFeedService>();
builder.Services.AddScoped<IAdminActivityLogService, AdminActivityLogService>();

builder.Services.AddScoped<IOrganizationAssignmentRepository, OrganizationAssignmentRepository>();
builder.Services.AddScoped<IOrganizationRegionAssignmentRepository, OrganizationRegionAssignmentRepository>();
builder.Services.AddScoped<ISubmissionQueueRepository, SubmissionQueueRepository>();
builder.Services.AddScoped<IAdminQueueService, AdminQueueService>();
builder.Services.AddScoped<ISavedItemCleanupService, SavedItemCleanupService>();
builder.Services.AddScoped<IOwnerChangeNotificationService, OwnerChangeNotificationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://softeng.pmf.kg.ac.rs:10112", "https://softeng.pmf.kg.ac.rs:10112")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddScoped<IUserRepository, UserRepository>(); // scoped = 1 objekat po 1 http request-u
builder.Services.AddScoped<INewsletterRepository, NewsletterRepository>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<INewsletterService, NewsletterService>();
builder.Services.AddScoped<PasswordHelper>();
builder.Services.AddScoped<JwtHelper>();
builder.Services.AddScoped<ILookupRepository, LookupRepository>();
builder.Services.AddScoped<ISavedItemRepository, SavedItemRepository>();
builder.Services.AddScoped<IReviewRepository, ReviewRepository>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<ISupportRepository, SupportRepository>();
builder.Services.AddScoped<IUserSupportService, UserSupportService>();
builder.Services.AddScoped<IAiBotService, AiBotService>();
builder.Services.AddScoped<IDestinationRepository, DestinationRepository>();
builder.Services.AddScoped<IDestinationService, DestinationService>();
builder.Services.AddScoped<ICloudinaryService, CloudinaryService>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IEventService, EventService>();

builder.Services.AddScoped<IExploreRepository, ExploreRepository>();
builder.Services.AddScoped<IExploreService, ExploreService>();

builder.Services.AddScoped<IPlaceRepository, PlaceRepository>();

builder.Services.AddScoped<IOrganizationAssignmentRepository, OrganizationAssignmentRepository>();
builder.Services.AddScoped<IOrganizationRegionAssignmentRepository, OrganizationRegionAssignmentRepository>();
builder.Services.AddScoped<ISubmissionQueueRepository, SubmissionQueueRepository>();
builder.Services.AddScoped<IAdminDestinationService, AdminDestinationService>();
builder.Services.AddScoped<IAdminQueueService, AdminQueueService>();
builder.Services.AddScoped<IAdminAssignmentService, AdminAssignmentService>();
builder.Services.AddScoped<IAdminUserService, AdminUserService>();
builder.Services.AddScoped<IAdminEventRepository, AdminEventRepository>();
builder.Services.AddScoped<IAdminEventService, AdminEventService>();
builder.Services.AddScoped<IAdminReviewRepository, AdminReviewRepository>();
builder.Services.AddScoped<IAdminReviewService, AdminReviewService>();
builder.Services.AddScoped<IAdminSupportService, AdminSupportService>();
builder.Services.AddScoped<ISuperAdminSupportService, SuperAdminSupportService>();
builder.Services.AddScoped<IAdminNotificationService, AdminNotificationService>();
builder.Services.AddScoped<IAdminNotificationReportService, AdminNotificationReportService>();
builder.Services.AddHttpClient<IAdminAiAssistantService, AdminAiAssistantService>();
builder.Services.AddScoped<IPopularityService, PopularityService>();
builder.Services.AddScoped<IAdminReportRepository, AdminReportRepository>();
builder.Services.AddScoped<IAdminReportService, AdminReportService>();
builder.Services.AddScoped<IAdminStatsService, AdminStatsService>();
builder.Services.AddSingleton<IAdminErrorLogService, AdminErrorLogService>();

builder.Services.AddHttpClient<IChatService, GeminiChatService>();
builder.Services.AddHostedService<SupportRetentionService>();
builder.Services.AddHostedService<UserPurgeService>();
builder.Services.AddHostedService<SoftDeleteCleanupService>();
builder.Services.AddHostedService<DatabaseBackupService>();
builder.Services.AddHostedService<NotificationReportBackgroundService>();
builder.Services.AddHostedService<EventAnnualRecurrenceService>();

builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithTools<SearchTools>()
    .WithTools<DestinationTools>()
    .WithTools<DiscoveryTools>();

var jwtSection = builder.Configuration.GetSection("JwtSettings");
var key = jwtSection["SecretKey"]!;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            ClockSkew = TimeSpan.Zero
        };
    });

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbSeeder.SeedAsync(db);
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        if (feature?.Error is not null)
        {
            var err = feature.Error;
            if (app.Environment.IsDevelopment())
            {
                await context.Response.WriteAsJsonAsync(new
                {
                    error = err.Message,
                    type  = err.GetType().FullName,
                    stack = err.StackTrace,
                    inner = err.InnerException?.Message
                });
            }
            else
            {
                await context.Response.WriteAsJsonAsync(new { error = "Internal server error." });
            }
        }
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// TEMP SEED SUPER ADMIN — Development only. A hardcoded credential in
// production is a known-account backdoor; gating to Development prevents
// it from existing in any non-dev deploy until a proper seed strategy
// (one-off migration / CLI command) replaces this block.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    {
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var passwordHelper = scope.ServiceProvider.GetRequiredService<PasswordHelper>();

    const string adminRoleName = "place_owner";
    const string adminEmail = "admin@explorea.local";
    const string adminPassword = "Admin123!";

    var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == adminRoleName);
    if (role == null)
    {
        role = new Role
        {
            Name = adminRoleName,
            Description = "Temporary seeded super admin",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        db.Roles.Add(role);
        await db.SaveChangesAsync();
    }

    var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email == adminEmail);
    if (existingUser == null)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = "Admin",
            LastName = "User",
            Email = adminEmail,
            PasswordHash = passwordHelper.HashPassword(adminPassword),
            RoleId = role.Id,
            IsActive = true,
            EmailVerifiedAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        db.Users.Add(user);

        db.UserAuthAccounts.Add(new UserAuthAccount
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Provider = "local",
            EmailAtProvider = adminEmail,
            IsPrimary = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });

        await db.SaveChangesAsync();
    }
    }
}

// One-shot backfill: link CityId on city-type destinations that don't have one yet.
using (var scope = app.Services.CreateScope())
{
    try
    {
        var destService = scope.ServiceProvider
            .GetRequiredService<Explorea.Server.Services.Admin.Interfaces.IAdminDestinationService>();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var gradTypeId = await db.DestinationTypes
            .Where(t => t.Name.ToLower() == "grad")
            .Select(t => (int?)t.Id)
            .FirstOrDefaultAsync();
        if (gradTypeId.HasValue)
        {
            var pendingCount = await db.Destinations
                .CountAsync(d => d.TypeId == gradTypeId.Value && d.CityId == null && !d.IsDeleted);
            if (pendingCount > 0)
            {
                // System-runs the backfill — bypass user permission check by writing directly.
                var candidates = await db.Destinations
                    .Where(d => d.TypeId == gradTypeId.Value && d.CityId == null && !d.IsDeleted)
                    .ToListAsync();
                var touched = 0;
                foreach (var dest in candidates)
                {
                    City? existing = null;
                    if (dest.RegionId.HasValue)
                        existing = await db.Cities.FirstOrDefaultAsync(c => c.Name == dest.Name && c.RegionId == dest.RegionId.Value);
                    existing ??= await db.Cities.FirstOrDefaultAsync(c => c.Name == dest.Name);
                    if (existing != null)
                    {
                        dest.CityId = existing.Id;
                        touched++;
                        continue;
                    }
                    var lat = dest.Latitude ?? 0;
                    var lng = dest.Longitude ?? 0;
                    var geometryFactory = new NetTopologySuite.NtsGeometryServices(new NetTopologySuite.Geometries.PrecisionModel(), 4326)
                        .CreateGeometryFactory();
                    var newCity = new City
                    {
                        Name = dest.Name,
                        RegionId = dest.RegionId,
                        Latitude = lat,
                        Longitude = lng,
                        Location = geometryFactory.CreatePoint(new NetTopologySuite.Geometries.Coordinate(lng, lat)),
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow,
                        CreatedBy = dest.CreatedBy,
                        UpdatedBy = dest.UpdatedBy,
                    };
                    db.Cities.Add(newCity);
                    await db.SaveChangesAsync();
                    dest.CityId = newCity.Id;
                    touched++;
                }
                if (touched > 0) await db.SaveChangesAsync();
            }
        }
    }
    catch
    {
        /* startup backfill is best-effort */
    }
}

app.UseCors("AllowAngular");
// HTTPS redirect is a no-op when the front end and API both run on http
// locally, but in any non-development deploy it must be on so tokens and
// credentials don't traverse the network unencrypted.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        context.RequestServices.GetRequiredService<IAdminErrorLogService>().Record(context, ex);
        throw;
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapMcp("/mcp");

app.Run();
