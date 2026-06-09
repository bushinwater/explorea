using System.Text.Json;

namespace Explorea.Server.Helpers
{
    /// <summary>
    /// Helpers for reading JSONB columns that historically stored mixed value types
    /// (legacy rows used raw bool/number, newer rows always store strings).
    /// </summary>
    public static class JsonbDictionaryHelper
    {
        public static Dictionary<string, string>? ParseStringDictionary(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Object) return null;

                var result = new Dictionary<string, string>();
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    result[prop.Name] = prop.Value.ValueKind switch
                    {
                        JsonValueKind.String => prop.Value.GetString() ?? string.Empty,
                        JsonValueKind.True   => "true",
                        JsonValueKind.False  => "false",
                        JsonValueKind.Null   => string.Empty,
                        _                    => prop.Value.GetRawText(),
                    };
                }
                return result;
            }
            catch
            {
                return null;
            }
        }
    }
}
