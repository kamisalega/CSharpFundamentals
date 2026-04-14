using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using SalegaTech.Application.Abstractions;
using SalegaTech.Application.Financings;
using System.ComponentModel.DataAnnotations;
using SalegaTech.Application.Events;
using SalegaTech.Common.Domain;
using Wolverine;

namespace SalegaTech.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class SimulationsController(IMessageBus bus, ISimulationResultStore store) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Post([FromBody] SimulationCreation creation, [FromServices] IValidator<SimulateFinancingCommand> validator, CancellationToken ct)
    {
        Guid simulationId = Guid.NewGuid();

        var command = new SimulateFinancingCommand(simulationId, creation.Amount,
            creation.NumberOfMonths, creation.FinancingType, creation.ResidualValue, creation.PartnerCode);

        var validationResult = await validator.ValidateAsync(command, ct);
        if (!validationResult.IsValid)
        {
            return BadRequest(new
            {
                errors = validationResult.Errors.Select(e => new
                {
                    e.PropertyName,
                    e.ErrorMessage
                })
            });
        }
        await bus.PublishAsync(command);

        return Accepted($"/api/simulations/{simulationId}", new { simulationId });
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SimulationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var result = await store.GetAsync(id, ct);

        if (result is null)
        {
            return NotFound(new
            {
                simulationId = id,
                message = "Simulation not found or still pending. Retry in a moment."
            });
        }

        return Ok(result);
    }

    [HttpGet("test")]
    public async Task<IActionResult> Test(CancellationToken ct)
    {
        var command = new SimulateFinancingCommand(
            SimulationId: Guid.NewGuid(),
            Amount: 25000m, NumberOfMonths: 48,
            FinancingType: "LOA", ResidualValue: 8000m, PartnerCode: "CONC001");

        await bus.InvokeAsync(command, ct);
        var response = await store.GetAsync(command.SimulationId, ct);
        return response is null ? NotFound() : Ok(response);
    }
}

public sealed record SimulationCreation(
    decimal Amount,
    int NumberOfMonths,
    string FinancingType,
    decimal ResidualValue,
    string PartnerCode);