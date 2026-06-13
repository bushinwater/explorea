using System.Globalization;
using System.Text;

namespace Explorea.Server.Helpers
{
    /// <summary>
    /// Normalizes entity names so that duplicate-name checks treat Serbian Latin
    /// diacritics and their ASCII fallbacks as equivalent (č↔c, ć↔c, š↔s, ž↔z,
    /// đ↔dj). Used by the admin Create flows for destinations / places / events /
    /// activities — letting users write "Nis" and still reject "Niš" as duplicate.
    /// </summary>
    public static class NameNormalizer
    {
        /// <summary>
        /// Returns a lowercase, whitespace-collapsed form with diacritics stripped
        /// and đ replaced by "dj". Empty/whitespace input maps to empty string.
        /// </summary>
        public static string Normalize(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

            var sb = new StringBuilder(raw.Length);
            foreach (var ch in raw.Trim().ToLowerInvariant())
            {
                if (ch == 'đ') { sb.Append("dj"); continue; }
                sb.Append(ch);
            }

            // Strip remaining diacritics (č→c, ć→c, š→s, ž→z and any others).
            var decomposed = sb.ToString().Normalize(NormalizationForm.FormD);
            var ascii = new StringBuilder(decomposed.Length);
            foreach (var ch in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
                ascii.Append(ch);
            }

            // Collapse repeated whitespace so " Beograd  city " == "beograd city".
            var collapsed = new StringBuilder(ascii.Length);
            var lastWasSpace = false;
            foreach (var ch in ascii.ToString())
            {
                if (char.IsWhiteSpace(ch))
                {
                    if (lastWasSpace) continue;
                    collapsed.Append(' ');
                    lastWasSpace = true;
                }
                else
                {
                    collapsed.Append(ch);
                    lastWasSpace = false;
                }
            }
            return collapsed.ToString().Trim();
        }
    }
}
