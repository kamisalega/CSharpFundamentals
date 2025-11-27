using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GloboTicket.Admin.Mobile.Models;

namespace GloboTicket.Admin.Mobile.Repositories
{
    public class EventRepository : IEventRepository
    {
        private readonly IHttpClientFactory _httpClientFactory;
        public EventRepository(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<List<EventModel>> GetEvents()
        {
            using HttpClient client = _httpClientFactory.CreateClient("GloboTicketAdminApiClient");
            try
            {
                List<EventModel>? events = await client.GetFromJsonAsync<List<EventModel>>(
                    $"events",
                    new JsonSerializerOptions(JsonSerializerDefaults.Web));
                return events ?? new List<EventModel>();
            }
            catch (Exception)
            {
                return new List<EventModel>();
            }
        }

        public async Task<EventModel?> GetEvent(Guid id)
        {
            using HttpClient client = _httpClientFactory.CreateClient("GloboTicketAdminApiClient");
            try
            {
                EventModel? @event = await client.GetFromJsonAsync<EventModel>(
                    $"events/{id}",
                    new JsonSerializerOptions(JsonSerializerDefaults.Web));
                return @event;
            }
            catch (Exception)
            {
                return null;
            }
        }

        public async Task<bool> UpdateStatus(Guid id, EventStatusModel status)
        {
            using HttpClient client = _httpClientFactory.CreateClient("GloboTicketAdminApiClient");
            try
            {
                var json = JsonSerializer.Serialize(status);
                var content = new StringContent(JsonSerializer.Serialize(status), Encoding.UTF8, "application/json");
                var response = await client.PatchAsync($"events/{id}/status", content);
                if (response.IsSuccessStatusCode)
                {
                    return true;
                }
            }
            catch (Exception)
            {
                return false;
            }
            return false;
        }
    }
}
