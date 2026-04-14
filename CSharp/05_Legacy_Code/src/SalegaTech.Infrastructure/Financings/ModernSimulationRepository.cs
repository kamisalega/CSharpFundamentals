using Microsoft.EntityFrameworkCore;
using SalegaTech.Domain.Entities;
using SalegaTech.Domain.Interfaces;
using SalegaTech.Infrastructure.Database;

namespace SalegaTech.Infrastructure.Financings
{
    public sealed class ModernSimulationRepository(ModernDbContext db) : IModernSimulationRepository
    {
        public async Task<FinancingSimulation?> GetByCodeAsync(string simulationCode,
            CancellationToken cancellation = default)
        {
            return await db.Simulations.AsNoTracking()
                .FirstOrDefaultAsync(x => x.SimulationCode == simulationCode, cancellation);
        }

        public async Task AddAsync(FinancingSimulation simulation, CancellationToken cancellation = default)
        {
            db.Simulations.Add(simulation);
            await db.SaveChangesAsync(cancellation);
        }
    }
}