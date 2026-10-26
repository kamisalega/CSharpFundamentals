namespace StranglerFig.Migration.Seam;

// A record on purpose: the parallel run compares legacy and new results with Equals.
public sealed record OrderDto(Guid Id, string CustomerEmail, decimal Total, string Status, DateTime CreatedAtUtc);
