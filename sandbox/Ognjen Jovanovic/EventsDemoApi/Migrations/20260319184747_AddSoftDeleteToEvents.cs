using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EventsDemoApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSoftDeleteToEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "events",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "events");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "events");
        }
    }
}
