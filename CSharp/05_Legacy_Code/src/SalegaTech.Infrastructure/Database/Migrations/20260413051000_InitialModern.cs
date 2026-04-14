using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalegaTech.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class InitialModern : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FinancingSimulations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SimulationCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Amount_Value = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    Amount_Currency = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                    ResidualValue_Value = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    ResidualValue_Currency = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                    MonthlyPayment_Value = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    MonthlyPayment_Currency = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                    Rate_ValueAsPercentage = table.Column<decimal>(type: "TEXT", precision: 5, scale: 2, nullable: false),
                    NumberOfInstallments = table.Column<int>(type: "INTEGER", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    SimulationDate = table.Column<DateOnly>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancingSimulations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Partners",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    Label = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Partners", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CreditFiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    FileCode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    SimulationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PartnerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedDate = table.Column<DateOnly>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CreditFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CreditFiles_FinancingSimulations_SimulationId",
                        column: x => x.SimulationId,
                        principalTable: "FinancingSimulations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CreditFiles_Partners_PartnerId",
                        column: x => x.PartnerId,
                        principalTable: "Partners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CreditFiles_FileCode",
                table: "CreditFiles",
                column: "FileCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CreditFiles_PartnerId",
                table: "CreditFiles",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_CreditFiles_SimulationId",
                table: "CreditFiles",
                column: "SimulationId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancingSimulations_SimulationCode",
                table: "FinancingSimulations",
                column: "SimulationCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Partners_Code",
                table: "Partners",
                column: "Code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CreditFiles");

            migrationBuilder.DropTable(
                name: "FinancingSimulations");

            migrationBuilder.DropTable(
                name: "Partners");
        }
    }
}
