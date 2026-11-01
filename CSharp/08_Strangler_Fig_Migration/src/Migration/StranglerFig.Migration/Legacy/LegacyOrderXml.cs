using System.Xml.Serialization;

namespace StranglerFig.Migration.Legacy;

// Mirrors the XML the .NET Framework 2.0 app produces with XmlSerializer.
[XmlRoot("Order")]
public sealed class LegacyOrderXml
{
    public Guid Id { get; set; }

    public string CustomerEmail { get; set; } = string.Empty;

    public decimal Total { get; set; }

    public int Status { get; set; }

    // No time zone in the XML - legacy stores UTC by convention.
    public DateTime CreatedAt { get; set; }

    public DateTime ModifiedAt { get; set; }
}

[XmlRoot("PlaceOrderRequest")]
public sealed class PlaceOrderRequestXml
{
    public string CustomerEmail { get; set; } = string.Empty;

    public decimal Total { get; set; }
}

internal static class LegacyOrderStatus
{
    internal const int Shipped = 1;
}
