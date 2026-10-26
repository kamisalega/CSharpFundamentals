using System;
using System.Xml.Serialization;

namespace OrdersLegacy
{
    // C# 2.0: no auto-properties, so public fields - exactly what XmlSerializer liked back then.
    [XmlRoot("Order")]
    public class LegacyOrder
    {
        public Guid Id;
        public string CustomerEmail;
        public decimal Total;

        // 0 = new, 1 = shipped. Magic numbers, as in most legacy systems.
        public int Status;

        // No DateTimeOffset in .NET 2.0: UTC by convention, stored in "timestamp without time zone".
        public DateTime CreatedAt;
        public DateTime ModifiedAt;
    }

    public static class LegacyOrderStatus
    {
        public const int New = 0;
        public const int Shipped = 1;
    }

    [XmlRoot("PlaceOrderRequest")]
    public class PlaceOrderRequest
    {
        public string CustomerEmail;
        public decimal Total;
    }
}
