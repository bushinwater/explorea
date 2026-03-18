using System.ComponentModel;
using ModelContextProtocol.Server;
using Npgsql;

namespace Library.MCP;

[McpServerToolType]
public class LibraryTools
{
    private readonly NpgsqlConnection _konekcija;

    // dependency injection - .NET nam ubacuje konekciju na bazu
    public LibraryTools(NpgsqlConnection konekcija)
    {
        _konekcija = konekcija;
    }

[McpServerTool, Description("Vraća listu svih knjiga u biblioteci sa brojem slobodnih primeraka")]
public async Task<string> GetKnjige()
{
    await _konekcija.OpenAsync();

    var komanda = new NpgsqlCommand(
        @"SELECT ""Title"", ""Author"", ""Genre"", ""AvailableCopies"", ""TotalCopies"" 
          FROM knjige 
          ORDER BY ""Title""",
        _konekcija);

    var rezultat = new System.Text.StringBuilder();
    rezultat.AppendLine("Knjige u biblioteci:");
    rezultat.AppendLine("--------------------");

    await using var citac = await komanda.ExecuteReaderAsync();
    while (await citac.ReadAsync())
    {
        var slobodno = citac.GetInt32(3);
        var ukupno = citac.GetInt32(4);
        var dostupnost = slobodno > 0 ? $"slobodno: {slobodno}/{ukupno}" : "nije dostupno";

        rezultat.AppendLine(
            $"• {citac.GetString(0)} — {citac.GetString(1)} ({citac.GetString(2)}) — {dostupnost}");
    }

    await _konekcija.CloseAsync();
    return rezultat.ToString();
}

[McpServerTool, Description("Proverava da li je određena knjiga dostupna za rezervaciju")]
public async Task<string> ProveriDostupnost([Description("Naslov knjige")] string naslov)
{
    await _konekcija.OpenAsync();

    var komanda = new NpgsqlCommand(
        @"SELECT ""Title"", ""Author"", ""AvailableCopies"", ""TotalCopies"" 
          FROM knjige 
          WHERE LOWER(""Title"") LIKE LOWER(@naslov)",
        _konekcija);

    komanda.Parameters.AddWithValue("naslov", $"%{naslov}%");

    await using var citac = await komanda.ExecuteReaderAsync();

    if (!await citac.ReadAsync())
    {
        await _konekcija.CloseAsync();
        return $"Knjiga sa naslovom '{naslov}' nije pronađena u katalogu.";
    }

    var naziv = citac.GetString(0);
    var autor = citac.GetString(1);
    var slobodno = citac.GetInt32(2);
    var ukupno = citac.GetInt32(3);

    await _konekcija.CloseAsync();

    if (slobodno > 0)
        return $"'{naziv}' od autora {autor} je dostupna — {slobodno} od {ukupno} primeraka slobodno.";
    else
        return $"'{naziv}' od autora {autor} trenutno nije dostupna — svi primerci su rezervisani ili pozajmljeni.";
}

[McpServerTool, Description("Vraća sve rezervacije koje čekaju odobrenje admina")]
public async Task<string> GetPendingRezervacije()
{
    await _konekcija.OpenAsync();

    var komanda = new NpgsqlCommand(@"
        SELECT k.""Name"", knj.""Title"", r.""ReservedAt"", r.""ExpiresAt""
        FROM rezervacije r
        JOIN korisnici k ON r.""UserId"" = k.""Id""
        JOIN knjige knj ON r.""BookId"" = knj.""Id""
        WHERE r.""Status"" = 'pending'
        ORDER BY r.""ReservedAt"" ASC",
        _konekcija);

    var rezultat = new System.Text.StringBuilder();
    rezultat.AppendLine("Rezervacije koje čekaju odobrenje:");
    rezultat.AppendLine("------------------------------------");

    var brojac = 0;
    await using var citac = await komanda.ExecuteReaderAsync();
    while (await citac.ReadAsync())
    {
        brojac++;
        var rezervisano = citac.GetDateTime(2).ToLocalTime().ToString("dd.MM.yyyy HH:mm");
        rezultat.AppendLine(
            $"• {citac.GetString(0)} — '{citac.GetString(1)}' — rezervisano: {rezervisano}");
    }

    await _konekcija.CloseAsync();

    if (brojac == 0)
        return "Nema rezervacija koje čekaju odobrenje.";

    return rezultat.ToString();
}

[McpServerTool, Description("Vraća statistiku biblioteke - broj knjiga, korisnika i rezervacija po statusu")]
public async Task<string> GetStatistika()
{
    await _konekcija.OpenAsync();

    var rezultat = new System.Text.StringBuilder();
    rezultat.AppendLine("Statistika biblioteke:");
    rezultat.AppendLine("----------------------");

    // broj knjiga
    var komandaKnjige = new NpgsqlCommand("SELECT COUNT(*) FROM knjige", _konekcija);
    var brojKnjiga = await komandaKnjige.ExecuteScalarAsync();
    rezultat.AppendLine($"• Ukupno knjiga u katalogu: {brojKnjiga}");

    // broj korisnika
    var komandaKorisnici = new NpgsqlCommand(
        "SELECT COUNT(*) FROM korisnici WHERE \"Role\" = 'User'", _konekcija);
    var brojKorisnika = await komandaKorisnici.ExecuteScalarAsync();
    rezultat.AppendLine($"• Registrovanih korisnika: {brojKorisnika}");

    // rezervacije po statusu
    var komandaRezervacije = new NpgsqlCommand(@"
        SELECT ""Status"", COUNT(*) 
        FROM rezervacije 
        GROUP BY ""Status""", _konekcija);

    await using var citac = await komandaRezervacije.ExecuteReaderAsync();
    while (await citac.ReadAsync())
    {
        var status = citac.GetString(0) switch
        {
            "pending" => "čekaju odobrenje",
            "approved" => "pozajmljene",
            "returned" => "vraćene",
            "cancelled" => "otkazane",
            _ => citac.GetString(0)
        };
        rezultat.AppendLine($"• Rezervacije — {status}: {citac.GetInt32(1)}");
    }

    await _konekcija.CloseAsync();
    return rezultat.ToString();
}

[McpServerTool, Description("Vraća listu trenutno pozajmljenih knjiga sa imenima korisnika")]
public async Task<string> GetPozajmljeneKnjige()
{
    await _konekcija.OpenAsync();

    var komanda = new NpgsqlCommand(@"
        SELECT k.""Name"", k.""Email"", knj.""Title"", knj.""Author"", r.""BorrowedAt""
        FROM rezervacije r
        JOIN korisnici k ON r.""UserId"" = k.""Id""
        JOIN knjige knj ON r.""BookId"" = knj.""Id""
        WHERE r.""Status"" = 'approved'
        ORDER BY r.""BorrowedAt"" ASC",
        _konekcija);

    var rezultat = new System.Text.StringBuilder();
    rezultat.AppendLine("Trenutno pozajmljene knjige:");
    rezultat.AppendLine("-----------------------------");

    var brojac = 0;
    await using var citac = await komanda.ExecuteReaderAsync();
    while (await citac.ReadAsync())
    {
        brojac++;
        var pozajmljeno = citac.GetDateTime(4).ToLocalTime().ToString("dd.MM.yyyy");
        rezultat.AppendLine(
            $"• '{citac.GetString(2)}' ({citac.GetString(3)}) — pozajmio: {citac.GetString(0)} ({citac.GetString(1)}) — od: {pozajmljeno}");
    }

    await _konekcija.CloseAsync();

    if (brojac == 0)
        return "Trenutno nema pozajmljenih knjiga.";

    return rezultat.ToString();
}}