using System.Net;
using System.Net.Http.Headers;
using System.Xml;
using System.Xml.Serialization;
using StranglerFig.Migration.Seam;

namespace StranglerFig.Migration.Legacy;

// Anti-corruption layer over the legacy HTTP API: XML, magic status numbers and zone-less UTC dates
// are translated here and never reach the rest of the system.
internal sealed class LegacyOrdersClient(HttpClient http) : IOrderService
{
    private static readonly XmlSerializer OrderSerializer = new(typeof(LegacyOrderXml));
    private static readonly XmlSerializer RequestSerializer = new(typeof(PlaceOrderRequestXml));

    // XML from another system: no DTDs, no external entities.
    private static readonly XmlReaderSettings SafeReaderSettings = new()
    {
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null
    };

    public async Task<OrderDto?> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await http.GetAsync(new Uri($"orders/{orderId}", UriKind.Relative), cancellationToken);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();

        return ToDto(await ReadOrderAsync(response, cancellationToken));
    }

    public async Task<OrderDto> PlaceOrderAsync(string customerEmail, decimal total, CancellationToken cancellationToken = default)
    {
        // A stream, not a StringWriter: StringWriter declares encoding="utf-16", and the .NET 2.0
        // XmlSerializer rejects a UTF-16 declaration without a byte order mark.
        using var body = new MemoryStream();
        RequestSerializer.Serialize(body, new PlaceOrderRequestXml { CustomerEmail = customerEmail, Total = total });

        using var content = new ByteArrayContent(body.ToArray());
        content.Headers.ContentType = new MediaTypeHeaderValue("application/xml") { CharSet = "utf-8" };

        using HttpResponseMessage response = await http.PostAsync(new Uri("orders", UriKind.Relative), content, cancellationToken);
        response.EnsureSuccessStatusCode();

        return ToDto(await ReadOrderAsync(response, cancellationToken));
    }

    public async Task<bool> ShipOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        // Empty body instead of null: Mono's HttpListener rejects a POST without Content-Length (411).
        using var content = new StringContent(string.Empty);
        using HttpResponseMessage response = await http.PostAsync(
            new Uri($"orders/{orderId}/ship", UriKind.Relative),
            content,
            cancellationToken);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }

        response.EnsureSuccessStatusCode();

        return true;
    }

    internal static DateTime FromLegacyUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    internal static string ToStatusName(int status) => status == LegacyOrderStatus.Shipped ? "Shipped" : "Pending";

    private static async Task<LegacyOrderXml> ReadOrderAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        await using Stream stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = XmlReader.Create(stream, SafeReaderSettings);

        return (LegacyOrderXml)OrderSerializer.Deserialize(reader)!;
    }

    private static OrderDto ToDto(LegacyOrderXml order) =>
        new(order.Id, order.CustomerEmail, order.Total, ToStatusName(order.Status), FromLegacyUtc(order.CreatedAt));
}
