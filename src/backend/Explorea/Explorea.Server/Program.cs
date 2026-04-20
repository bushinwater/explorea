using Explorea.Server.Data;
using Explorea.Server.Helpers;
using Explorea.Server.McpTools;
using Explorea.Server.Repositories.Implementations;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services;
using Explorea.Server.Services.Admin;
using Explorea.Server.Services.Admin.Interfaces;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseNetTopologySuite() // za koordinate
    )
);

builder.Services.AddMemoryCache();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<ISearchRepository, SearchRepository>();
builder.Services.AddScoped<ISearchService, SearchService>();

builder.Services.AddScoped<IHomeRepository, HomeRepository>();
builder.Services.AddScoped<IHomeService, HomeService>();

builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IActivityService, ActivityService>();

builder.Services.AddScoped<ISearchPageService, SearchPageService>();
builder.Services.AddScoped<ISearchPageRepository, SearchPageRepository>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
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
builder.Services.AddScoped<IAiBotService, AiBotService>();
builder.Services.AddScoped<IDestinationService, DestinationService>();
builder.Services.AddScoped<ICloudinaryService, CloudinaryService>();
builder.Services.AddScoped<IEventRepository, EventRepository>();
builder.Services.AddScoped<IEventService, EventService>();

builder.Services.AddScoped<IExploreRepository, ExploreRepository>();
builder.Services.AddScoped<IExploreService, ExploreService>();

builder.Services.AddScoped<IPlaceRepository, PlaceRepository>();

builder.Services.AddScoped<IOrganizationAssignmentRepository, OrganizationAssignmentRepository>();
builder.Services.AddScoped<ISubmissionQueueRepository, SubmissionQueueRepository>();
builder.Services.AddScoped<IAdminDestinationService, AdminDestinationService>();
builder.Services.AddScoped<IAdminQueueService, AdminQueueService>();
builder.Services.AddScoped<IAdminAssignmentService, AdminAssignmentService>();

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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
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
                await context.Response.WriteAsJsonAsync(new
                {
                    error   = err.Message,
                    type    = err.GetType().FullName,
                    stack   = err.StackTrace,
                    inner   = err.InnerException?.Message
                });
            }
        });
    });
}

app.UseCors("AllowAngular");
//app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapMcp("/mcp");

app.Run();
