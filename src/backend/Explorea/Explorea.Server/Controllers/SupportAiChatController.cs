using Explorea.API.DTOs.Support;
using Explorea.Server.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Explorea.Server.Controllers
{
    [ApiController]
    [Route("api/support/ai-chat")]
    [Authorize]
    public class SupportAiChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public SupportAiChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpPost]
        public async Task<IActionResult> Chat([FromBody] SupportAiChatRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Message))
                return BadRequest(new { message = "Message is required." });

            var history = dto.History
                .Select(h => new ChatMessage(h.Role, h.Content))
                .ToList();

            var reply = await _chatService.ChatAsync(history, dto.Message, systemPromptOverride: SupportAssistantPrompt);
            if (IsProviderError(reply))
                reply = BuildSupportFallback(dto.Message);

            return Ok(new SupportAiChatResponseDto
            {
                Reply = reply,
                SessionId = dto.SessionId
            });
        }

        private static bool IsProviderError(string reply)
        {
            return reply.StartsWith("[Gre", StringComparison.OrdinalIgnoreCase) ||
                   reply.StartsWith("[Prazan odgovor", StringComparison.OrdinalIgnoreCase) ||
                   reply.StartsWith("[Nema teksta", StringComparison.OrdinalIgnoreCase);
        }

        private static string BuildSupportFallback(string message)
        {
            var normalized = message.ToLowerInvariant();

            if (normalized.Contains("eskal"))
                return "Tiket eskaliraj kada problem ukljucuje placanje, bezbednost, podatke korisnika, vise neuspelih pokusaja resavanja ili kada admin nema dovoljno prava da zavrsi zahtev. Pre eskalacije dodaj kratak interni rezime: sta je korisnik prijavio, sta je provereno i koji je sledeci korak.";

            if (normalized.Contains("slik") || normalized.Contains("fotograf"))
                return "Predlog odgovora: Hvala na prijavi. Molimo vas da proverite format i velicinu slike, zatim pokusate ponovo sa stabilnom internet vezom. Ako problem ostane, posaljite naziv objekta, vreme pokusaja i poruku greske kako bismo prosledili tehnickoj podrsci.";

            if (normalized.Contains("odgovor") || normalized.Contains("napisi") || normalized.Contains("tekst"))
                return "Predlog odgovora: Hvala sto ste nam se javili. Provericemo prijavu i javiti vam sledeci korak cim budemo imali vise informacija. Ako mozete, posaljite dodatne detalje kao sto su naziv objekta, vreme kada se problem desio i screenshot greske.";

            if (normalized.Contains("status"))
                return "Statusi tiketa: otvoren znaci da ceka obradu, u toku znaci da ga admin vec proverava, resen znaci da je problem zavrsen, a zatvoren da nema dalje aktivnosti. Ako korisnik doda nove informacije, tiket treba ponovo pregledati.";

            return "Mogu da pomognem oko support tiketa, odgovora korisniku, eskalacije i osnovnih koraka provere. Za ovaj slucaj prikupi: sta korisnik pokusava da uradi, gde se problem javlja, da li postoji poruka greske i screenshot. Ne deli privatne podatke korisnika u odgovoru.";
        }

        private const string SupportAssistantPrompt =
            "Ti si AI asistent za Explorea admin/support stranicu. Odgovaraj na srpskom latinicom, kratko i prakticno. " +
            "Mozes da pomognes oko cestih pitanja: kako otvoriti ili dopuniti tiket, kako opisati problem, sta znace statusi tiketa, " +
            "kada eskalirati tiket, kako proveriti osnovne korake za nalog, objekte, destinacije, dogadjaje, aktivnosti, recenzije i obavestenja. " +
            "Mozes da predlozis tekst odgovora korisniku, listu pitanja za razjasnjenje i sledeci administrativni korak. " +
            "Bezbednosna pravila: ne otkrivaj licne podatke, email adrese, telefone, interne ID-jeve, tokene, lozinke, podatke o drugim korisnicima, " +
            "privatne tikete ili informacije koje nisu date u razgovoru. Ne tvrdi da si proverio bazu, nalog ili tiket ako ti ti podaci nisu eksplicitno dati. " +
            "Ako pitanje trazi privatne korisnicke podatke ili internu informaciju koju ne znas, ljubazno odbij i predlozi da admin proveri odgovarajucu stranicu ili eskalira tiket.";
    }
}
