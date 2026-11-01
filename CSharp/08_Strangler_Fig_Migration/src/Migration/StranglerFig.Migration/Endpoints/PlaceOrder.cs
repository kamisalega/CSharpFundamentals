namespace StranglerFig.Migration.Endpoints;

public sealed record PlaceOrderRequest(string CustomerEmail, decimal Total);
