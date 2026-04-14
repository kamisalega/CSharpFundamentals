using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SalegaTech.Legacy.Persistance.Migrations
{
    /// <inheritdoc />
    public partial class InitialLegacy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TBL_PARTENAIRE",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CDE_PARTENAIRE = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    LIB_PARTENAIRE = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_PARTENAIRE", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TBL_SIMULATION",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CDE_DOSSIER = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    CDE_PARTENAIRE = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    MNT_FINANCEMENT = table.Column<decimal>(type: "TEXT", nullable: false),
                    TX_INTERET = table.Column<int>(type: "INTEGER", nullable: false),
                    NBR_ECHEANCES = table.Column<int>(type: "INTEGER", nullable: false),
                    MNT_VR = table.Column<decimal>(type: "TEXT", nullable: false),
                    MNT_MENSUALITE = table.Column<decimal>(type: "TEXT", nullable: false),
                    CDE_TYPE = table.Column<int>(type: "INTEGER", nullable: false),
                    CDE_STATUT = table.Column<int>(type: "INTEGER", nullable: false),
                    DT_SIMULATION = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    MSG_ERREUR = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_SIMULATION", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TBL_PARTENAIRE_CDE_PARTENAIRE",
                table: "TBL_PARTENAIRE",
                column: "CDE_PARTENAIRE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TBL_SIMULATION_CDE_DOSSIER",
                table: "TBL_SIMULATION",
                column: "CDE_DOSSIER",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TBL_PARTENAIRE");

            migrationBuilder.DropTable(
                name: "TBL_SIMULATION");
        }
    }
}
