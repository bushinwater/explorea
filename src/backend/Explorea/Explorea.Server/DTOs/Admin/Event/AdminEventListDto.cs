namespace Explorea.API.DTOs.Admin.Event
{
    public class AdminEventListDto
    {
        public Guid            Id             { get; set; }
        public string          Name           { get; set; } = null!;
        public string          Slug           { get; set; } = null!;
        public string?         PreviewImageUrl{ get; set; }
        public string?         Type           { get; set; }
        public string?         City           { get; set; }
        public string?         Destination    { get; set; }
        public Guid?           DestinationId  { get; set; }
        public Guid?           PlaceId        { get; set; }
        public DateTimeOffset  StartDatetime  { get; set; }
        public DateTimeOffset  EndDatetime    { get; set; }
        public decimal?        Price          { get; set; }
        public decimal         AvgRating      { get; set; }
        public bool            IsFeatured     { get; set; }
        public DateTimeOffset  CreatedAt      { get; set; }
        public DateTimeOffset  UpdatedAt      { get; set; }
        public DateTimeOffset? DeletedAt      { get; set; }
    }
}
