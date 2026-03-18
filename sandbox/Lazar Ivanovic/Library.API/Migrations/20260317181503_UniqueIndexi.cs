using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Library.API.Migrations
{
    /// <inheritdoc />
    public partial class UniqueIndexi : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_korisnici_Email",
                table: "korisnici",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_knjige_ISBN",
                table: "knjige",
                column: "ISBN",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_korisnici_Email",
                table: "korisnici");

            migrationBuilder.DropIndex(
                name: "IX_knjige_ISBN",
                table: "knjige");
        }
    }
}
