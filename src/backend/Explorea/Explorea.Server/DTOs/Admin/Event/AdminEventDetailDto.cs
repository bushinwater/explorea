namespace Explorea.API.DTOs.Admin.Event
{
    public class AdminEventDetailDto
    {
        public Guid            Id             { get; set; }
        public string          Name           { get; set; } = null!;
        public string          Slug           { get; set; } = null!;
        public string?         Description    { get; set; }
        public int             TypeId         { get; set; }
        public string?         Type           { get; set; }
        public int?            CityId         { get; set; }
        public string?         City           { get; set; }
        public int?            CountryId      { get; set; }
        public string?         Country        { get; set; }
        public Guid?           DestinationId  { get; set; }
        public string?         Destination    { get; set; }
        public Guid?           PlaceId        { get; set; }
        public string?         Place          { get; set; }
        public DateTimeOffset  StartDatetime  { get; set; }
        public DateTimeOffset  EndDatetime    { get; set; }
        public decimal?        Price          { get; set; }
        public string?         Address        { get; set; }
        public double?         Latitude       { get; set; }
        public double?         Longitude      { get; set; }
        public string?         TicketUrl      { get; set; }
        public decimal         AvgRating      { get; set; }
        public int             Popularity     { get; set; }
        public bool            IsFeatured     { get; set; }
        public List<string>    Images         { get; set; } = new();
        public DateTimeOffset  CreatedAt      { get; set; }
        public DateTimeOffset  UpdatedAt      { get; set; }
    }
}
