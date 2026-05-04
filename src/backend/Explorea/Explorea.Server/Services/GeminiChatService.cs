using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Explorea.Server.Controllers;
using Explorea.Server.Repositories.Interfaces;
using Explorea.Server.Services.Interfaces;

namespace Explorea.Server.Services
{
    public class GeminiChatService : IChatService
    {
        private readonly ISearchService _searchService;
        private readonly IDestinationService _destinationService;
        private readonly IEventRepository _eventRepository;
        private readonly IActivityRepository _activityRepository;
        private readonly IPlaceRepository _placeRepository;
        private readonly IExploreService _exploreService;
        private readonly HttpClient _http;
        private readonly string _apiKey;

        private static readonly JsonSerializerOptions _json = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        public GeminiChatService(
            ISearchService searchService,
            IDestinationService destinationService,
            IEventRepository eventRepository,
            IActivityRepository activityRepository,
            IPlaceRepository placeRepository,
            IExploreService exploreService,
            HttpClient http,
            IConfiguration config)
        {
            _searchService = searchService;
            _destinationService = destinationService;
            _eventRepository = eventRepository;
            _activityRepository = activityRepository;
            _placeRepository = placeRepository;
            _exploreService = exploreService;
            _http = http;
            _apiKey = config["GeminiSettings:ApiKey"]!;
        }

        public async Task<string> ChatAsync(List<ChatMessage> history, string userMessage, ChatContext? context = null)
        {
            var contents = BuildContents(history, userMessage);

            for (int i = 0; i < 5; i++)
            {
                var request = BuildRequest(contents, context);
                var (response, raw) = await CallGeminiAsync(request);

                var apiError = response?["error"]?["message"]?.GetValue<string>();
                if (apiError is not null) return $"[Greška API-ja: {apiError}]";

                var parts = response?["candidates"]?[0]?["content"]?["parts"]?.AsArray();
                if (parts is null) return $"[Prazan odgovor od Gemini-ja: {raw[..Math.Min(200, raw.Length)]}]";

                var funcPart = parts.FirstOrDefault(p => p?["functionCall"] is not null);
                if (funcPart is not null)
                {
                    var fnCall = funcPart["functionCall"]!;
                    var fnName = fnCall["name"]!.GetValue<string>();
                    var fnArgs = fnCall["args"]?.AsObject() ?? new JsonObject();

                    contents.Add(new JsonObject
                    {
                        ["role"] = "model",
                        ["parts"] = new JsonArray { new JsonObject { ["functionCall"] = fnCall.DeepClone() } }
                    });

                    var fnResult = await ExecuteFunctionAsync(fnName, fnArgs);

                    contents.Add(new JsonObject
                    {
                        ["role"] = "user",
                        ["parts"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["functionResponse"] = new JsonObject
                                {
                                    ["name"] = fnName,
                                    ["response"] = new JsonObject { ["content"] = fnResult }
                                }
                            }
                        }
                    });

                    continue;
                }

                var textPart = parts.FirstOrDefault(p => p?["text"] is not null);
                if (textPart is not null)
                    return textPart["text"]!.GetValue<string>();

                return $"[Nema teksta u odgovoru. Delovi: {raw[..Math.Min(300, raw.Length)]}]";
            }

            return "Nisam uspeo da obradim vas zahtev.";
        }

        private static List<JsonObject> BuildContents(List<ChatMessage> history, string userMessage)
        {
            var contents = new List<JsonObject>();

            foreach (var msg in history)
            {
                contents.Add(new JsonObject
                {
                    ["role"] = msg.Role == "assistant" ? "model" : "user",
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = msg.Content } }
                });
            }

            contents.Add(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray { new JsonObject { ["text"] = userMessage } }
            });

            return contents;
        }

        private JsonObject BuildRequest(List<JsonObject> contents, ChatContext? context)
        {
            var arr = new JsonArray();
            foreach (var c in contents) arr.Add(c.DeepClone());

            var systemPrompt = SystemPrompt;
            if (context is not null)
            {
                if (!string.IsNullOrWhiteSpace(context.FirstName))
                    systemPrompt += $" Korisnikovo ime je {context.FirstName}.";
                if (context.Lat.HasValue && context.Lng.HasValue)
                    systemPrompt += $" Korisnikova GPS lokacija: lat={context.Lat:F4}, lng={context.Lng:F4}. Kada pita sta ima u blizini ili gde da ide, pozovi get_nearby sa ovim koordinatama.";
            }

            return new JsonObject
            {
                ["system_instruction"] = new JsonObject
                {
                    ["parts"] = new JsonArray { new JsonObject { ["text"] = systemPrompt } }
                },
                ["contents"] = arr,
                ["tools"] = new JsonArray
                {
                    new JsonObject { ["function_declarations"] = ToolDeclarations.DeepClone() }
                }
            };
        }

        private static readonly System.Text.RegularExpressions.Regex RetryAfterRegex =
            new(@"retry in (\d+(?:\.\d+)?)s", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private async Task<(JsonNode? Node, string Raw)> CallGeminiAsync(JsonObject request)
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
            var body = request.ToJsonString();

            for (int attempt = 0; attempt < 4; attempt++)
            {
                using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
                var resp = await _http.PostAsync(url, content);
                var raw = await resp.Content.ReadAsStringAsync();
                var node = JsonNode.Parse(raw);

                var errorMsg = node?["error"]?["message"]?.GetValue<string>() ?? "";

                var shouldRetry = errorMsg.Contains("high demand") || errorMsg.Contains("quota", StringComparison.OrdinalIgnoreCase);

                if (shouldRetry && attempt < 3)
                {
                    var match = RetryAfterRegex.Match(errorMsg);
                    var seconds = match.Success ? double.Parse(match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture) + 1.0 : 5.0 * (attempt + 1);
                    await Task.Delay(TimeSpan.FromSeconds(Math.Min(seconds, 30)));
                    continue;
                }

                return (node, raw);
            }

            return (null, "{}");
        }

        private async Task<string> ExecuteFunctionAsync(string name, JsonObject args)
        {
            try
            {
                return name switch
                {
                    "search" => await ExecSearch(args),
                    "get_nearby" => await ExecGetNearby(args),
                    "get_destination_details" => await ExecDestinationDetails(args),
                    "get_destination_content" => await ExecDestinationContent(args),
                    "get_upcoming_events" => await ExecUpcomingEvents(args),
                    "get_activities" => await ExecActivities(args),
                    "get_places" => await ExecPlaces(args),
                    _ => Err($"Unknown function: {name}")
                };
            }
            catch (Exception ex)
            {
                return Err(ex.Message);
            }
        }

        private async Task<string> ExecSearch(JsonObject args)
        {
            var query = args["query"]?.GetValue<string>() ?? "";
            var limit = args["limit"]?.GetValue<int>() ?? 10;
            var result = await _searchService.SearchAsync(query, Math.Clamp(limit, 1, 20));
            return JsonSerializer.Serialize(result, _json);
        }

        private async Task<string> ExecDestinationDetails(JsonObject args)
        {
            var slug = args["slug"]?.GetValue<string>() ?? "";
            var dest = await _destinationService.GetBySlugAsync(slug);
            if (dest is null) return Err($"Destination '{slug}' not found.");

            return JsonSerializer.Serialize(new
            {
                dest.Name, dest.Slug, dest.Description, dest.AvgRating,
                city = dest.City?.Name, country = dest.Country?.Name
            }, _json);
        }

        private async Task<string> ExecDestinationContent(JsonObject args)
        {
            var slug = args["slug"]?.GetValue<string>() ?? "";
            var dest = await _destinationService.GetBySlugAsync(slug);
            if (dest is null) return Err($"Destination '{slug}' not found.");

            return JsonSerializer.Serialize(new
            {
                destinationName = dest.Name,
                activities = dest.Activities.Take(15).Select(a => new { a.Name, a.Slug, category = a.Category?.Name, a.DifficultyLevel }),
                events = dest.Events.Take(15).Select(e => new { e.Name, e.Slug, startDatetime = e.StartDatetime }),
                places = dest.Places.Take(15).Select(p => new { p.Name, p.Slug, type = p.Type?.Name, p.AvgRating })
            }, _json);
        }

        private async Task<string> ExecUpcomingEvents(JsonObject args)
        {
            var limit = Math.Clamp(args["limit"]?.GetValue<int>() ?? 20, 1, 50);
            var (items, total) = await _eventRepository.GetPagedAsync(null, null, DateTimeOffset.UtcNow, null, null, 1, limit);

            return JsonSerializer.Serialize(new
            {
                total,
                events = items.Select(e => new { e.Name, e.Slug, type = e.Type?.Name, startDatetime = e.StartDatetime, price = e.Price, city = e.City?.Name })
            }, _json);
        }

        private async Task<string> ExecActivities(JsonObject args)
        {
            var limit = Math.Clamp(args["limit"]?.GetValue<int>() ?? 20, 1, 50);
            var (items, total) = await _activityRepository.GetPagedAsync(null, null, null, null, 1, limit);

            return JsonSerializer.Serialize(new
            {
                total,
                activities = items.Select(a => new { a.Name, a.Slug, category = a.Category?.Name, a.DifficultyLevel, price = a.Price, avgRating = a.AvgRating })
            }, _json);
        }

        private async Task<string> ExecPlaces(JsonObject args)
        {
            var limit = Math.Clamp(args["limit"]?.GetValue<int>() ?? 20, 1, 50);
            var (items, total) = await _placeRepository.GetPagedAsync(null, null, null, null, null, 1, limit);

            return JsonSerializer.Serialize(new
            {
                total,
                places = items.Select(p => new { p.Name, p.Slug, type = p.Type?.Name, avgRating = p.AvgRating, address = p.Address, city = p.City?.Name })
            }, _json);
        }

        private async Task<string> ExecGetNearby(JsonObject args)
        {
            var lat = args["lat"]?.GetValue<double>();
            var lng = args["lng"]?.GetValue<double>();
            if (!lat.HasValue || !lng.HasValue) return Err("lat i lng su obavezni.");

            var radius = args["radius_km"]?.GetValue<double>() ?? 30.0;
            var type = args["type"]?.GetValue<string>() ?? "all";
            var limit = Math.Clamp(args["limit"]?.GetValue<int>() ?? 20, 1, 50);

            var result = await _exploreService.GetMapMarkersAsync(lat, lng, radius, type, limit, null, null);
            return JsonSerializer.Serialize(new
            {
                total = result.Markers.Count,
                markers = result.Markers.Select(m => new { m.Name, m.Slug, m.EntityType, m.AvgRating, m.Subtitle })
            }, _json);
        }

        private static string Err(string msg) => JsonSerializer.Serialize(new { error = msg });

        private const string SystemPrompt =
            "Ti si AI asistent aplikacije Explorea - turisticke platforme za Srbiju. " +
            "Pomažeš korisnicima da pronađu destinacije, mesta, aktivnosti i dogadjaje u Srbiji. " +

            "PRAVILA KORISĆENJA ALATA:\n" +
            "1. Kada korisnik pomene bilo koje ime (destinacija, planina, grad, aktivnost, dogadjaj) - ODMAH pozovi `search` sa tim imenom da pronađes slug i podatke.\n" +
            "2. Nikad ne pretpostavljaj slug destinacije - uvek koristi `search` da ga pronađes.\n" +
            "3. Ako `get_destination_details` vrati grešku, pokušaj ponovo sa `search` da pronađes tacan slug.\n" +
            "4. Kada korisnik pita šta ima u blizini, blizu njega, u okolini ili na kom mestu da ide - koristi `get_nearby` sa korisnikovom lokacijom.\n" +
            "5. Za opšta pitanja o aktivnostima/mestima/dogadjajima bez specificnog mesta - koristi `get_activities`, `get_places`, `get_upcoming_events`.\n" +
            "6. Kada korisnik pita o popularnim, preporucenim ili najboljim destinacijama bez specificnog naziva i bez GPS lokacije - pozovi `search` sa kljucnom recju 'destinacija' da vidis sta je dostupno, pa preporuci nekoliko.\n" +

            "FORMAT ODGOVORA:\n" +
            "- Odgovaraj kratko i konkretno.\n" +
            "- Ne izmišljaj informacije - koristi samo podatke iz alata.\n" +
            "- Kada pominjеš destinaciju, mesto, aktivnost ili dogadjaj, formatuj ga kao markdown link: [Ime](/destinations/slug), [Ime](/places/slug), [Ime](/activities/slug), [Ime](/events/slug). Nikad ne pisi sam path bez markdown formata.";

        private static readonly JsonArray ToolDeclarations = new()
        {
            new JsonObject
            {
                ["name"] = "get_nearby",
                ["description"] = "Pronalazi destinacije, mesta, aktivnosti ili dogadjaje u blizini date lokacije. Koristi kada korisnik pita sta ima u okolini, blizu njega ili gde da ide.",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["lat"] = new JsonObject { ["type"] = "NUMBER", ["description"] = "Geografska sirina (latitude)" },
                        ["lng"] = new JsonObject { ["type"] = "NUMBER", ["description"] = "Geografska duzina (longitude)" },
                        ["radius_km"] = new JsonObject { ["type"] = "NUMBER", ["description"] = "Radius pretrage u km (default 30)" },
                        ["type"] = new JsonObject { ["type"] = "STRING", ["description"] = "Tip: 'all', 'destination', 'place', 'event', 'activity'" },
                        ["limit"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Maks. broj rezultata (1-50)" }
                    },
                    ["required"] = new JsonArray { "lat", "lng" }
                }
            },
            new JsonObject
            {
                ["name"] = "search",
                ["description"] = "Pretraga destinacija, mesta, aktivnosti i dogadjaja po imenu ili kljucnoj reci.",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["query"] = new JsonObject { ["type"] = "STRING", ["description"] = "Pojam za pretragu" },
                        ["limit"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Maks. broj rezultata (1-20)" }
                    },
                    ["required"] = new JsonArray { "query" }
                }
            },
            new JsonObject
            {
                ["name"] = "get_destination_details",
                ["description"] = "Vraca detalje o konkretnoj turistickoj destinaciji po slug-u (npr. 'fruska-gora').",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["slug"] = new JsonObject { ["type"] = "STRING", ["description"] = "URL slug destinacije" }
                    },
                    ["required"] = new JsonArray { "slug" }
                }
            },
            new JsonObject
            {
                ["name"] = "get_destination_content",
                ["description"] = "Vraca aktivnosti, dogadjaje i mesta za konkretnu destinaciju po slug-u.",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["slug"] = new JsonObject { ["type"] = "STRING", ["description"] = "URL slug destinacije" }
                    },
                    ["required"] = new JsonArray { "slug" }
                }
            },
            new JsonObject
            {
                ["name"] = "get_upcoming_events",
                ["description"] = "Vraca listu nadolazecih dogadjaja.",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["limit"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Maks. broj dogadjaja (1-50)" }
                    }
                }
            },
            new JsonObject
            {
                ["name"] = "get_activities",
                ["description"] = "Vraca listu aktivnosti (planinarenje, penjanje, biciklizam...).",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["limit"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Maks. broj aktivnosti (1-50)" }
                    }
                }
            },
            new JsonObject
            {
                ["name"] = "get_places",
                ["description"] = "Vraca listu mesta (restorani, hoteli, kafei, muzeji...).",
                ["parameters"] = new JsonObject
                {
                    ["type"] = "OBJECT",
                    ["properties"] = new JsonObject
                    {
                        ["limit"] = new JsonObject { ["type"] = "INTEGER", ["description"] = "Maks. broj mesta (1-50)" }
                    }
                }
            }
        };
    }
}
