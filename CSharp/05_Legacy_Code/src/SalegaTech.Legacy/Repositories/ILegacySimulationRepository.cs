using Microsoft.EntityFrameworkCore;
using SalegaTech.Legacy.Persistance;

namespace SalegaTech.Legacy.Repositories;

public interface ILegacySimulationRepository
{
    Task AddAsync(LegacySimulationRow row, CancellationToken ct = default);
    Task<LegacySimulationRow?> GetByDossierAsync(string cdeDossier, CancellationToken ct = default);
}

public sealed class LegacySimulationRepository : ILegacySimulationRepository
{
    private readonly LegacyDbContext _db;
    public LegacySimulationRepository(LegacyDbContext db) => _db = db;

    public async Task AddAsync(LegacySimulationRow row, CancellationToken ct = default)
    {
        _db.Simulations.Add(row);
        await _db.SaveChangesAsync(ct);
    }

    public Task<LegacySimulationRow?> GetByDossierAsync(string cdeDossier, CancellationToken ct = default) =>
        _db.Simulations.AsNoTracking().FirstOrDefaultAsync(x => x.CDE_DOSSIER == cdeDossier, ct);
}